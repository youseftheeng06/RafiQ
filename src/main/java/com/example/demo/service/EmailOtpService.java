package com.example.demo.service;

import java.time.LocalDateTime;
import java.util.Random;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.model.LoginOtp;
import com.example.demo.model.User;
import com.example.demo.repository.LoginOtpRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class EmailOtpService {
    private final EmailService emailService;
    private final LoginOtpRepository loginOtpRepository;
    private final Random random = new Random();

    @Transactional
    public void sendOtp(User user) {
        String code = String.format("%05d", random.nextInt(100000));
        String email = normalizeEmail(user.getEmail());

        LoginOtp otp = loginOtpRepository.findByEmail(email).orElseGet(LoginOtp::new);
        otp.setEmail(email);
        otp.setCode(code);
        otp.setExpiresAt(LocalDateTime.now().plusMinutes(10));
        loginOtpRepository.save(otp);

        emailService.sendLoginOtpEmail(user.getEmail(), user.getName(), code);
    }

    @Transactional
    public void verifyOtp(String email, String otpCode) {
        String normalizedEmail = normalizeEmail(email);
        LoginOtp savedOtp = loginOtpRepository.findByEmail(normalizedEmail).orElse(null);

        if (savedOtp == null) {
            throw new RuntimeException("No login code was requested for this email");
        }

        if (savedOtp.getExpiresAt().isBefore(LocalDateTime.now())) {
            loginOtpRepository.delete(savedOtp);
            throw new RuntimeException("Verification code expired");
        }

        String normalizedCode = otpCode == null ? "" : otpCode.trim();
        if (!savedOtp.getCode().equals(normalizedCode)) {
            throw new RuntimeException("Invalid verification code");
        }

        loginOtpRepository.delete(savedOtp);
    }

    @Transactional
    public void clearOtp(String email) {
        loginOtpRepository.deleteByEmail(normalizeEmail(email));
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }
}
