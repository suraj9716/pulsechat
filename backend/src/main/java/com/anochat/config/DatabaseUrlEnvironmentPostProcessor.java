package com.anochat.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.HashMap;
import java.util.Map;

/**
 * Maps Render/Heroku-style DATABASE_URL and REDIS_URL into Spring Boot properties.
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    private static final String SOURCE = "cloudUrlEnv";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Map<String, Object> props = new HashMap<>();

        String databaseUrl = environment.getProperty("DATABASE_URL");
        if (databaseUrl != null && !databaseUrl.isBlank()) {
            UrlEnvParser.PostgresConfig pg = UrlEnvParser.parsePostgresUrl(databaseUrl);
            props.put("spring.datasource.url", pg.jdbcUrl());
            if (pg.username() != null) {
                props.put("spring.datasource.username", pg.username());
            }
            if (pg.password() != null) {
                props.put("spring.datasource.password", pg.password());
            }
        }

        String redisUrl = environment.getProperty("REDIS_URL");
        if (redisUrl != null && !redisUrl.isBlank()) {
            UrlEnvParser.RedisConfig redis = UrlEnvParser.parseRedisUrl(redisUrl);
            props.put("spring.data.redis.host", redis.host());
            props.put("spring.data.redis.port", redis.port());
            if (redis.password() != null) {
                props.put("spring.data.redis.password", redis.password());
            }
            if (redis.ssl()) {
                props.put("spring.data.redis.ssl.enabled", true);
            }
        }

        if (!props.isEmpty()) {
            environment.getPropertySources().addFirst(new MapPropertySource(SOURCE, props));
        }
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
