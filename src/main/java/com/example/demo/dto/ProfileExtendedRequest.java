package com.example.demo.dto;

import java.util.List;
import java.util.Map;

public record ProfileExtendedRequest(
        String bio,
        List<String> skills,
        List<Map<String, String>> experiences,
        Map<String, String> socialLinks
) {
}
