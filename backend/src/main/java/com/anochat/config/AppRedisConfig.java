package com.anochat.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;

@Configuration
public class AppRedisConfig {

    private static final Logger log = LoggerFactory.getLogger(AppRedisConfig.class);

    @Bean
    @Primary
    public RedisConnectionFactory redisConnectionFactory(Environment env) {
        String redisUrl = env.getProperty("REDIS_URL");
        if (redisUrl != null && !redisUrl.isBlank()) {
            UrlEnvParser.RedisConfig redis = UrlEnvParser.parseRedisUrl(redisUrl);
            log.info("Redis via REDIS_URL (host: {})", redis.host());
            return lettuce(redis.host(), redis.port(), redis.password(), redis.ssl());
        }

        String host = env.getProperty("REDIS_HOST", "localhost");
        int port = env.getProperty("REDIS_PORT", Integer.class, 6379);
        String password = env.getProperty("REDIS_PASSWORD", "");

        if (env.acceptsProfiles(Profiles.of("prod")) && isLocalhost(host)) {
            throw new IllegalStateException(
                    "Redis not configured for production. Add REDIS_URL from Upstash to Render Environment.");
        }

        log.info("Redis via REDIS_HOST={}:{}", host, port);
        return lettuce(host, port, password.isBlank() ? null : password, false);
    }

    private static boolean isLocalhost(String host) {
        return host == null
                || host.isBlank()
                || "localhost".equalsIgnoreCase(host)
                || "127.0.0.1".equals(host);
    }

    private static LettuceConnectionFactory lettuce(String host, int port, String password, boolean ssl) {
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration(host, port);
        if (password != null && !password.isBlank()) {
            config.setPassword(RedisPassword.of(password));
        }
        LettuceClientConfiguration.LettuceClientConfigurationBuilder builder =
                LettuceClientConfiguration.builder();
        if (ssl) {
            builder.useSsl();
        }
        return new LettuceConnectionFactory(config, builder.build());
    }
}
