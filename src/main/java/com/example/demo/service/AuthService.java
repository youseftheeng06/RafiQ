package com.example.demo.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Random;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.dto.LoginInitiationResponse;
import com.example.demo.model.LoginOtp;
import com.example.demo.model.User;
import com.example.demo.repository.LoginOtpRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.validation.PasswordPolicy;
import com.example.demo.validation.UserRegistrationSanitizer;

import lombok.RequiredArgsConstructor;

@Service @RequiredArgsConstructor
public class AuthService {
    private final EmailService emailService;
    private final EmailOtpService emailOtpService;
    private final LoginOtpRepository loginOtpRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final Random random = new Random();

    @Transactional
    public User register(User user) 
    {
        String normalizedEmail = normalizeEmail(user.getEmail());
        user.setEmail(normalizedEmail);
        UserRegistrationSanitizer.requireSignupEmailBounded(normalizedEmail);
        PasswordPolicy.requireStrongPlainPassword(user.getPassword());
        user.setName(UserRegistrationSanitizer.requireSafeRegistrationName(user.getName()));

        if (userRepository.findByEmail(normalizedEmail).isPresent()) {
            throw new RuntimeException("Email already exists");
        }

        applyRegistrationDetails(user, user);

        User savedUser = userRepository.save(user);
        emailService.sendStaffIdEmail(savedUser.getEmail(), savedUser.getName(), savedUser.getStaffId(), savedUser.getRole());

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

    @Transactional
    public String requestPasswordReset(String email) {
        User user = userRepository.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> new RuntimeException("User not found"));
        ensureUserIsActive(user);

        sendPasswordResetCode(user);
        return maskEmail(user.getEmail());
    }

    @Transactional
    public void verifyPasswordReset(String email, String otpCode) {
        User user = userRepository.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> new RuntimeException("User not found"));
        ensureUserIsActive(user);
        verifyPasswordResetCode(email, otpCode);
    }

    @Transactional
    public void resetPassword(String email, String otpCode, String newPassword) {
        PasswordPolicy.requireStrongPlainPassword(newPassword);

        User user = userRepository.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> new RuntimeException("User not found"));
        ensureUserIsActive(user);

        verifyPasswordResetCode(email, otpCode);
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        loginOtpRepository.deleteByEmail(normalizeEmail(email));
    }

    private User validatePrimaryCredentials(String email, String rawPassword, String username, String staffId) {
        User user = userRepository.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> new RuntimeException("User not found"));
        ensureUserIsActive(user);

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

        String normalizedEmail = normalizeEmail(email);

        return userRepository.findByEmail(normalizedEmail)
                .map(existingUser -> {
                    if (displayName != null && !displayName.isBlank()) {
                        existingUser.setName(displayName);
                    }
                    existingUser.setEmail(normalizedEmail);
                    existingUser.setActive(true);
                    return userRepository.save(existingUser);
                })
                .orElseGet(() -> {
                    String resolvedName = (displayName == null || displayName.isBlank())
                            ? normalizedEmail.substring(0, normalizedEmail.indexOf('@'))
                            : displayName;

                    User oauthUser = User.builder()
                            .name(resolvedName)
                            .email(normalizedEmail)
                            .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                            .role("DEVELOPER")
                            .active(true)
                            .staffId(generateStaffId("DEVELOPER"))
                            .build();

                    User savedUser = userRepository.save(oauthUser);
                    try {
                        emailService.sendStaffIdEmail(
                                savedUser.getEmail(),
                                savedUser.getName(),
                                savedUser.getStaffId(),
                                savedUser.getRole()
                        );
                    } catch (RuntimeException ex) {
                    }
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

    private User applyRegistrationDetails(User targetUser, User registrationInput) {
        String role = UserRegistrationSanitizer.requireAllowedSignupRole(registrationInput.getRole());

        targetUser.setName(registrationInput.getName());
        targetUser.setEmail(normalizeEmail(registrationInput.getEmail()));
        targetUser.setPassword(passwordEncoder.encode(registrationInput.getPassword()));
        targetUser.setRole(role);
        targetUser.setStaffId(generateStaffId(role));
        targetUser.setActive(true);

        return targetUser;
    }

    private void ensureUserIsActive(User user) {
        if (!user.isActive()) {
            throw new RuntimeException("Account is inactive");
        }
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

    private void sendPasswordResetCode(User user) {
        String code = String.format("%05d", random.nextInt(100000));
        String email = normalizeEmail(user.getEmail());

        LoginOtp otp = loginOtpRepository.findByEmail(email).orElseGet(LoginOtp::new);
        otp.setEmail(email);
        otp.setCode(code);
        otp.setExpiresAt(LocalDateTime.now().plusMinutes(10));
        loginOtpRepository.save(otp);

        emailService.sendPasswordResetOtpEmail(user.getEmail(), user.getName(), code);
    }

    private void verifyPasswordResetCode(String email, String otpCode) {
        String normalizedEmail = normalizeEmail(email);
        LoginOtp savedOtp = loginOtpRepository.findByEmail(normalizedEmail).orElse(null);

        if (savedOtp == null) {
            throw new RuntimeException("No password reset code was requested for this email");
        }

        if (savedOtp.getExpiresAt().isBefore(LocalDateTime.now())) {
            loginOtpRepository.delete(savedOtp);
            throw new RuntimeException("Password reset code expired");
        }

        String normalizedCode = otpCode == null ? "" : otpCode.trim();
        if (!savedOtp.getCode().equals(normalizedCode)) {
            throw new RuntimeException("Invalid password reset code");
        }
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
