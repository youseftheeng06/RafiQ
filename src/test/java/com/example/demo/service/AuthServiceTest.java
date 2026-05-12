package com.example.demo.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.demo.model.User;
import com.example.demo.repository.LoginOtpRepository;
import com.example.demo.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private EmailService emailService;

    @Mock
    private EmailOtpService emailOtpService;

    @Mock
    private LoginOtpRepository loginOtpRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AuthService authService;

    @Test
    void registerCreatesUserWhenEmailDoesNotExist() {
        User registrationRequest = User.builder()
                .name("New Name")
                .email(" Restored@Example.com ")
                .password("Plain-pass1!")
                .role("TEAM_LEADER")
                .build();

        when(userRepository.findByEmail("restored@example.com")).thenReturn(Optional.empty());
        when(userRepository.findByStaffId(any())).thenReturn(Optional.empty());
        when(passwordEncoder.encode("Plain-pass1!")).thenReturn("encoded-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User savedUser = authService.register(registrationRequest);

        assertEquals("New Name", savedUser.getName());
        assertEquals("restored@example.com", savedUser.getEmail());
        assertEquals("encoded-password", savedUser.getPassword());
        assertEquals("TEAM_LEADER", savedUser.getRole());
        assertTrue(savedUser.getStaffId().startsWith("TEA-"));
        assertTrue(savedUser.isActive());
        verify(emailService).sendStaffIdEmail(
                eq("restored@example.com"),
                eq("New Name"),
                eq(savedUser.getStaffId()),
                eq("TEAM_LEADER")
        );
    }

    @Test
    void registerRejectsActiveUserWithSameEmail() {
        User existingUser = User.builder()
                .id(8L)
                .email("active@example.com")
                .active(true)
                .build();

        User registrationRequest = User.builder()
                .name("Another User")
                .email("active@example.com")
                .password("Plain-pass1!")
                .build();

        when(userRepository.findByEmail("active@example.com")).thenReturn(Optional.of(existingUser));

        RuntimeException exception = assertThrows(RuntimeException.class, () -> authService.register(registrationRequest));

        assertEquals("Email already exists", exception.getMessage());
        verify(userRepository, never()).save(any());
    }

    @Test
    void registerRejectsInactiveUserWithSameEmail() {
        User existingUser = User.builder()
                .id(9L)
                .email("inactive@example.com")
                .active(false)
                .build();

        User registrationRequest = User.builder()
                .name("Another User")
                .email("inactive@example.com")
                .password("Plain-pass1!")
                .build();

        when(userRepository.findByEmail("inactive@example.com")).thenReturn(Optional.of(existingUser));

        RuntimeException exception = assertThrows(RuntimeException.class, () -> authService.register(registrationRequest));

        assertEquals("Email already exists", exception.getMessage());
        verify(userRepository, never()).save(any());
    }

    @Test
    void registerRejectsWeakPassword() {
        User registrationRequest = User.builder()
                .name("Weak User")
                .email("weak@example.com")
                .password("short")
                .role("DEVELOPER")
                .build();

        RuntimeException exception = assertThrows(RuntimeException.class, () -> authService.register(registrationRequest));

        assertTrue(exception.getMessage().toLowerCase().contains("password"));
        verify(userRepository, never()).save(any());
    }
}
