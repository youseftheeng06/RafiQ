package com.example.demo.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class AiChatService {
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.ai.openrouter-api-key:}")
    private String openRouterApiKey;

    @Value("${app.ai.openrouter-model:z-ai/glm-4.5-air:free}")
    private String openRouterModel;

    public Map<String, Object> chat(String message) {
        return Map.of(
                "reply", generateReply("You are a helpful AI assistant for the RafiQ platform.", message),
                "provider", "openrouter",
                "model", openRouterModel
        );
    }

    public String generateReply(String systemPrompt, String message) {
        String trimmedMessage = message == null ? "" : message.trim();
        if (trimmedMessage.isBlank()) {
            throw new RuntimeException("Message is required");
        }

        if (openRouterApiKey == null || openRouterApiKey.isBlank()) {
            throw new RuntimeException("AI API key is not configured");
        }

        String endpoint = "https://openrouter.ai/api/v1/chat/completions";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(openRouterApiKey);
        headers.set("HTTP-Referer", "http://localhost:5500");
        headers.set("X-Title", "RafiQ AI Assistant");

        Map<String, Object> payload = Map.of(
                "model", openRouterModel,
                "stream", false,
                "messages", List.of(
                        Map.of(
                                "role", "system",
                                "content", systemPrompt
                        ),
                        Map.of(
                                "role", "user",
                                "content", trimmedMessage
                        )
                )
        );

        ResponseEntity<String> response = restTemplate.exchange(
                endpoint,
                HttpMethod.POST,
                new HttpEntity<>(payload, headers),
                String.class
        );
        String responseBody = response.getBody();

        return extractReply(responseBody);
    }

    private String extractReply(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode textNode = root.path("choices").path(0).path("message").path("content");
            if (!textNode.isMissingNode() && !textNode.asText().isBlank()) {
                return textNode.asText();
            }
        } catch (Exception ex) {
            throw new RuntimeException("Failed to parse AI response");
        }

        throw new RuntimeException("AI response did not contain a reply");
    }
}
