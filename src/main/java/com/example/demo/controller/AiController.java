package com.example.demo.controller;

import com.example.demo.dto.AiChatRequest;
import com.example.demo.service.AiAssistantService;
import com.example.demo.service.AiChatService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AiController {
    private final AiAssistantService aiAssistantService;

    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> chat(@RequestBody AiChatRequest request) {
        return ResponseEntity.ok(aiAssistantService.respond(request.message(), request.userId()));
    }
}
