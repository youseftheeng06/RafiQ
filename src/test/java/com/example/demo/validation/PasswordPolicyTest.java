package com.example.demo.validation;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class PasswordPolicyTest {

    @Test
    void acceptsNineCharMixedComplexPassword() {
        assertNull(PasswordPolicy.validateOrNull("RegStr0!x")); // length 10
        assertNull(PasswordPolicy.validateOrNull("AbCdef1#g")); // 9 chars exactly
    }

    @Test
    void rejectsEightOrFewerCharacters() {
        assertNotNull(PasswordPolicy.validateOrNull("Ab1!bbbb")); // exactly 8
        assertNotNull(PasswordPolicy.validateOrNull(""));
    }

    @Test
    void rejectsMissingClass() {
        assertNotNull(PasswordPolicy.validateOrNull("abcdefghi!")); // no upper, no digit
        assertNotNull(PasswordPolicy.validateOrNull("abcdefghI!")); // no digit
        assertNotNull(PasswordPolicy.validateOrNull("ABCDEFGH1!")); // no lower
        assertNotNull(PasswordPolicy.validateOrNull("Abcdefghij")); // no symbol or digit mis - has no digit
        assertNotNull(PasswordPolicy.validateOrNull("Abcdefghi1")); // no symbol
    }
}
