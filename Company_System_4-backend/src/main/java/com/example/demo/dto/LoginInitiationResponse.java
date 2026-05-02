package com.example.demo.dto;

public record LoginInitiationResponse(
        Long id,
        String name,
        String email,
        String role,
        String staffId,
        String deliveryTarget,
        String message
) {
}
