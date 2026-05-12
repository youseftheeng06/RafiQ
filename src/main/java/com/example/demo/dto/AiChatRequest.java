package com.example.demo.dto;

public record AiChatRequest(
        String message,
        Long userId
) {
}
