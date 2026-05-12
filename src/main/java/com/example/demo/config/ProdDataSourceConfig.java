package com.example.demo.config;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.sql.DataSource;

import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.util.StringUtils;

import com.zaxxer.hikari.HikariDataSource;

/**
 * Render / Railway PostgreSQL: {@code DATABASE_URL} is often {@code postgres://user:pass@host/db}.
 * Railway also sets {@code PGHOST}, {@code PGUSER}, etc. Spring expects {@code jdbc:postgresql://...}.
 */
@Configuration
@Profile("prod")
public class ProdDataSourceConfig {

    @Bean
    @Primary
    public DataSource dataSource(Environment env) {
        String jdbcUrl = env.getProperty("spring.datasource.url", "");
        String username = env.getProperty("spring.datasource.username", "");
        String password = env.getProperty("spring.datasource.password", "");

        HikariDataSource ds = new HikariDataSource();
        ds.setDriverClassName("org.postgresql.Driver");

        if (StringUtils.hasText(jdbcUrl) && jdbcUrl.startsWith("jdbc:postgresql:")) {
            ds.setJdbcUrl(jdbcUrl);
            ds.setUsername(username);
            ds.setPassword(password);
            return ds;
        }

        String databaseUrl = env.getProperty("DATABASE_URL", "");
        if (StringUtils.hasText(databaseUrl)) {
            Map<String, String> p = parsePostgresDatabaseUrl(databaseUrl.trim());
            ds.setJdbcUrl(p.get("url"));
            ds.setUsername(p.get("username"));
            ds.setPassword(p.get("password"));
            return ds;
        }

        String pgHost = env.getProperty("PGHOST", "");
        if (StringUtils.hasText(pgHost)) {
            String pgPort = env.getProperty("PGPORT", "5432");
            String pgDb = env.getProperty("PGDATABASE", "postgres");
            String pgUser = env.getProperty("PGUSER", "");
            String pgPass = env.getProperty("PGPASSWORD", "");
            String built = "jdbc:postgresql://" + pgHost + ":" + pgPort + "/" + pgDb;
            ds.setJdbcUrl(built);
            ds.setUsername(pgUser);
            ds.setPassword(pgPass);
            return ds;
        }

        throw new IllegalStateException(
                "Production database not configured. Set one of: "
                        + "spring.datasource.url (jdbc:postgresql://...), DATABASE_URL (postgres://...), "
                        + "or PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD.");
    }

    static Map<String, String> parsePostgresDatabaseUrl(String databaseUrl) {
        String normalized = databaseUrl;
        if (normalized.startsWith("postgres://")) {
            normalized = "http://" + normalized.substring("postgres://".length());
        } else if (normalized.startsWith("postgresql://")) {
            normalized = "http://" + normalized.substring("postgresql://".length());
        } else {
            throw new IllegalArgumentException("DATABASE_URL must start with postgres:// or postgresql://");
        }

        URI uri = URI.create(normalized);
        String userInfo = uri.getRawUserInfo();
        if (userInfo == null || !userInfo.contains(":")) {
            throw new IllegalArgumentException("DATABASE_URL is missing user:password");
        }
        int split = userInfo.indexOf(':');
        String user = java.net.URLDecoder.decode(userInfo.substring(0, split), StandardCharsets.UTF_8);
        String pass = java.net.URLDecoder.decode(userInfo.substring(split + 1), StandardCharsets.UTF_8);

        String host = uri.getHost();
        int port = uri.getPort() > 0 ? uri.getPort() : 5432;
        String path = uri.getRawPath();
        if (path == null || path.length() <= 1) {
            throw new IllegalArgumentException("DATABASE_URL is missing database name in path");
        }
        String database = path.startsWith("/") ? path.substring(1) : path;

        String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + "/" + database;
        if (uri.getRawQuery() != null && !uri.getRawQuery().isBlank()) {
            jdbcUrl += "?" + uri.getRawQuery();
        }

        Map<String, String> out = new LinkedHashMap<>();
        out.put("url", jdbcUrl);
        out.put("username", user);
        out.put("password", pass);
        return out;
    }
}
