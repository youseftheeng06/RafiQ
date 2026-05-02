package com.example.demo.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.example.demo.dto.LoginInitiationResponse;
import com.example.demo.model.User;
import com.example.demo.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service @RequiredArgsConstructor
public class AuthService {
    private final EmailService emailService;
    private final EmailOtpService emailOtpService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public User register(User user) 
    {
        if (userRepository.findByEmail(user.getEmail()).isPresent()) 
        {
            throw new RuntimeException("Email already exists");
        }

        String role = (user.getRole() == null) ? "DEVELOPER" : user.getRole();
        String staffId = generateStaffId(role);
        
        user.setStaffId(staffId);
        user.setRole(role);
        user.setActive(true);
        
        user.setPassword(passwordEncoder.encode(user.getPassword()));

        User savedUser = userRepository.save(user);
        emailService.sendStaffIdEmail(savedUser.getEmail(), savedUser.getName(), staffId, savedUser.getRole());

        return savedUser;
    }

    public LoginInitiationResponse initiateLogin(String email, String rawPassword, String username, String staffId) {
        User user = validatePrimaryCredentials(email, rawPassword, username, staffId);
        emailOtpService.sendOtp(user);
        return new LoginInitiationResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.getStaffId(),
                maskEmail(user.getEmail()),
                "We sent a one-time code to your email"
        );
    }

    public User verifyLogin(String email, String rawPassword, String username, String staffId, String otpCode) {
        User user = validatePrimaryCredentials(email, rawPassword, username, staffId);
        emailOtpService.verifyOtp(user.getEmail(), otpCode);
        return user;
    }

    public User login(String email, String rawPassword, String username, String staffId) {
        return validatePrimaryCredentials(email, rawPassword, username, staffId);
    }

    public void cancelLogin(String email) {
        emailOtpService.clearOtp(email);
    }

    private User validatePrimaryCredentials(String email, String rawPassword, String username, String staffId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!user.getStaffId().equals(staffId)) {
            throw new RuntimeException("Invalid Staff ID");
        }

        if (!user.getName().equals(username)) {
            throw new RuntimeException("Invalid Username");
        }

        if (!passwordEncoder.matches(rawPassword, user.getPassword())) {
            throw new RuntimeException("Invalid Password");
        }

        return user;
    }

    public User loginWithOAuth(String email, String displayName) {
        if (email == null || email.isBlank()) {
            throw new RuntimeException("OAuth email is required");
        }

        return userRepository.findByEmail(email)
                .map(existingUser -> {
                    if (displayName != null && !displayName.isBlank()) {
                        existingUser.setName(displayName);
                    }
                    existingUser.setActive(true);
                    return userRepository.save(existingUser);
                })
                .orElseGet(() -> {
                    String resolvedName = (displayName == null || displayName.isBlank())
                            ? email.substring(0, email.indexOf('@'))
                            : displayName;

                    User oauthUser = User.builder()
                            .name(resolvedName)
                            .email(email)
                            .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                            .role("DEVELOPER")
                            .active(true)
                            .staffId(generateStaffId("DEVELOPER"))
                            .build();

                    User savedUser = userRepository.save(oauthUser);
                    emailService.sendStaffIdEmail(
                            savedUser.getEmail(),
                            savedUser.getName(),
                            savedUser.getStaffId(),
                            savedUser.getRole()
                    );
                    return savedUser;
                });
    }

    public String buildOauthSuccessQuery(User user) {
        return String.format(
                "oauth=success&id=%s&name=%s&email=%s&role=%s&staffId=%s",
                user.getId(),
                encode(user.getName()),
                encode(user.getEmail()),
                encode(user.getRole()),
                encode(user.getStaffId())
        );
    }

    private String generateStaffId(String role) {
        String safeRole = (role == null || role.isBlank()) ? "DEVELOPER" : role;
        String prefix = safeRole.substring(0, Math.min(3, safeRole.length())).toUpperCase();

        String staffId;
        do {
            String randomNum = String.valueOf((int) (Math.random() * 9000) + 1000);
            staffId = prefix + "-" + randomNum;
        } while (userRepository.findByStaffId(staffId).isPresent());

        return staffId;
    }

    private String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private String maskEmail(String email) {
        if (email == null || email.isBlank() || !email.contains("@")) {
            return "your email";
        }

        String[] parts = email.split("@", 2);
        String local = parts[0];
        String domain = parts[1];

        if (local.length() <= 2) {
            return local.charAt(0) + "***@" + domain;
        }

        return local.substring(0, 2) + "***@" + domain;
    }
}
