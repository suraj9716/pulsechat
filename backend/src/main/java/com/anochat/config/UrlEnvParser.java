package com.anochat.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

final class UrlEnvParser {

    private UrlEnvParser() {}

    record PostgresConfig(String jdbcUrl, String username, String password) {}

    record RedisConfig(String host, int port, String password, boolean ssl) {}

    static PostgresConfig parsePostgresUrl(String databaseUrl) {
        URI uri = URI.create(normalizePostgresScheme(databaseUrl));

        String username = null;
        String password = null;
        if (uri.getUserInfo() != null) {
            String[] parts = uri.getUserInfo().split(":", 2);
            username = decode(parts[0]);
            if (parts.length > 1) {
                password = decode(parts[1]);
            }
        }

        StringBuilder jdbcUrl = new StringBuilder("jdbc:postgresql://")
                .append(uri.getHost());
        if (uri.getPort() > 0) {
            jdbcUrl.append(':').append(uri.getPort());
        }
        jdbcUrl.append(uri.getPath());
        if (uri.getQuery() != null && !uri.getQuery().isBlank()) {
            jdbcUrl.append('?').append(uri.getQuery());
        }

        return new PostgresConfig(jdbcUrl.toString(), username, password);
    }

    static RedisConfig parseRedisUrl(String redisUrl) {
        String normalized = redisUrl.replace("redis://", "http://").replace("rediss://", "https://");
        URI uri = URI.create(normalized);

        String password = null;
        if (uri.getUserInfo() != null) {
            String[] parts = uri.getUserInfo().split(":", 2);
            password = parts.length > 1 ? decode(parts[1]) : decode(parts[0]);
        }

        int port = uri.getPort() > 0 ? uri.getPort() : 6379;
        boolean ssl = redisUrl.startsWith("rediss://");
        return new RedisConfig(uri.getHost(), port, password, ssl);
    }

    private static String normalizePostgresScheme(String url) {
        if (url.startsWith("postgres://")) {
            return "postgresql://" + url.substring("postgres://".length());
        }
        return url;
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }
}
