package com.example.demo.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.dto.LoginInitiationResponse;
import com.example.demo.model.User;
import com.example.demo.service.AuthService;

import lombok.RequiredArgsConstructor;


@RestController @RequestMapping("/api/auth") @RequiredArgsConstructor @CrossOrigin(origins = "*")
public class AuthController 
{

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<User> register(@RequestBody User user) 
    {
        return ResponseEntity.ok(authService.register(user));
    }

    // أول اند بوينت في اللوجين يراجع البيانات ويبعت كود على الإيميل
    @PostMapping("/login/initiate")
    public ResponseEntity<LoginInitiationResponse> initiateLogin
    (
        @RequestParam String email,
        @RequestParam String password,
        @RequestParam String username,
        @RequestParam String staffId
    )
    {
        return ResponseEntity.ok(authService.initiateLogin(email, password, username, staffId));
    }

    @PostMapping("/login")
    public ResponseEntity<User> login
    (
        @RequestParam String email, 
        @RequestParam String password,
        @RequestParam String username,
        @RequestParam String staffId
    ) 
    {
        return ResponseEntity.ok(authService.login(email, password, username, staffId));
    }

    // تاني اند بوينت يستقبل كود الـ OTP ولو صح يرجع المستخدم
    @PostMapping("/login/verify")
    public ResponseEntity<User> verifyLogin
    (
        @RequestParam String email,
        @RequestParam String password,
        @RequestParam String username,
        @RequestParam String staffId,
        @RequestParam String otpCode
    )
    {
        return ResponseEntity.ok(authService.verifyLogin(email, password, username, staffId, otpCode));
    }


    @PostMapping("/login/cancel")
    public ResponseEntity<Map<String, Object>> cancelLogin(@RequestParam String email)
    {
        authService.cancelLogin(email);
        return ResponseEntity.ok(Map.of("cancelled", true));
    }
}
