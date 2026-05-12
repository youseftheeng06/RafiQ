package com.example.demo.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;

import org.junit.jupiter.api.Test;

class ProdDataSourceConfigTest {

    @Test
    void parsesPostgresUrlWithPort() {
        Map<String, String> m = ProdDataSourceConfig.parsePostgresDatabaseUrl(
                "postgres://user:secret@db.example.com:5432/rafiq");
        assertEquals("jdbc:postgresql://db.example.com:5432/rafiq", m.get("url"));
        assertEquals("user", m.get("username"));
        assertEquals("secret", m.get("password"));
    }

    @Test
    void parsesPostgresqlSchemeAndDefaultPort() {
        Map<String, String> m = ProdDataSourceConfig.parsePostgresDatabaseUrl(
                "postgresql://app:p%40ss@host.internal/mydb");
        assertEquals("jdbc:postgresql://host.internal:5432/mydb", m.get("url"));
        assertEquals("app", m.get("username"));
        assertEquals("p@ss", m.get("password"));
    }

    @Test
    void preservesQueryParams() {
        Map<String, String> m = ProdDataSourceConfig.parsePostgresDatabaseUrl(
                "postgres://u:p@h:5432/db?sslmode=require");
        assertEquals("jdbc:postgresql://h:5432/db?sslmode=require", m.get("url"));
    }
}
