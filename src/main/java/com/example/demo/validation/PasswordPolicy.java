package com.example.demo.validation;

/** Enforces signup / password-change complexity (server-side, required). */
public final class PasswordPolicy {

    /** Strictly greater than eight characters. */
    public static final int MIN_LENGTH = 9;
    /** Avoid extremely large payloads to the password encoder layer. */
    public static final int MAX_LENGTH = 128;

    private PasswordPolicy() {
    }

    public static String validateOrNull(String plain) {
        if (plain == null || plain.isBlank()) {
            return "Password is required";
        }
        if (plain.length() > MAX_LENGTH) {
            return "Password is too long";
        }
        if (plain.length() < MIN_LENGTH) {
            return "Password must be more than 8 characters (" + MIN_LENGTH + " or more)";
        }
        boolean hasUpper = plain.chars().anyMatch(Character::isUpperCase);
        boolean hasLower = plain.chars().anyMatch(Character::isLowerCase);
        boolean hasDigit = plain.chars().anyMatch(Character::isDigit);
        boolean hasSymbol = plain.codePoints()
                .anyMatch(cp ->
                        !Character.isLetterOrDigit(cp) && !Character.isWhitespace(cp));
        if (!hasUpper) {
            return "Password must include at least one uppercase letter";
        }
        if (!hasLower) {
            return "Password must include at least one lowercase letter";
        }
        if (!hasDigit) {
            return "Password must include at least one number";
        }
        if (!hasSymbol) {
            return "Password must include at least one symbol (for example ! @ # %)";
        }
        if (containsNullByte(plain)) {
            return "Password contains invalid characters";
        }
        return null;
    }

    public static void requireStrongPlainPassword(String plain) {
        String message = validateOrNull(plain);
        if (message != null) {
            throw new RuntimeException(message);
        }
    }

    private static boolean containsNullByte(String s) {
        return s.indexOf('\0') >= 0;
    }
}
