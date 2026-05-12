package com.example.demo.validation;

import java.util.Locale;
import java.util.Set;

/**
 * Bounds untrusted signup text so payloads cannot overwhelm persistence or embed control bytes.
 * JPA binds parameters (no concatenated SQL), but tightening inputs reduces abuse surface if native
 * queries are added later.
 */
public final class UserRegistrationSanitizer {

    private static final int NAME_MAX_LEN = 120;
    /** RFC 5321 local+domain rough upper bound. */
    private static final int EMAIL_MAX_LEN = 254;

    private static final Set<String> ALLOWED_ROLES = Set.of(
            "DEVELOPER",
            "TEAM_LEADER",
            "MANAGER");

    private UserRegistrationSanitizer() {
    }

    public static String requireSafeRegistrationName(String name) {
        if (name == null || name.isBlank()) {
            throw new RuntimeException("Name is required");
        }
        String trimmed = name.trim();
        rejectControlCharacters(trimmed, "Name");
        if (trimmed.length() > NAME_MAX_LEN) {
            throw new RuntimeException("Name is too long");
        }
        return trimmed;
    }

    public static void requireSignupEmailBounded(String normalizedEmail) {
        if (normalizedEmail.length() > EMAIL_MAX_LEN) {
            throw new RuntimeException("Email is too long");
        }
        if (containsControlCharacter(normalizedEmail)) {
            throw new RuntimeException("Email contains invalid characters");
        }
    }

    /** Returns a persisted role slug (whitelist only — blocks crafted role strings). */
    public static String requireAllowedSignupRole(String role) {
        if (role == null || role.isBlank()) {
            return "DEVELOPER";
        }
        String key = role.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_ROLES.contains(key)) {
            throw new RuntimeException("Invalid role");
        }
        return key;
    }

    private static void rejectControlCharacters(String text, String fieldLabel) {
        if (containsControlCharacter(text)) {
            throw new RuntimeException(fieldLabel + " contains invalid characters");
        }
    }

    private static boolean containsControlCharacter(String s) {
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\u0000' || (c >= '\u0001' && c <= '\u001F')) {
                return true;
            }
            if (c >= '\u007F' && c <= '\u009F') {
                return true;
            }
        }
        return false;
    }
}
