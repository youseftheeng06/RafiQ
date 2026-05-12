package com.example.demo.dto;

import java.util.List;
import java.util.Map;

public record UserPreferencesRequest(
        Map<String, String> chatBackgrounds,
        List<Map<String, String>> aiHistory
) {
}
