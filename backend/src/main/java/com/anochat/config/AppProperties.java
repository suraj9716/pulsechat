package com.anochat.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;


@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private Jwt jwt = new Jwt();
    private RateLimit rateLimit = new RateLimit();
    private Cors cors = new Cors();

    @Getter
    @Setter
    public static class Jwt {
        private String secret;
        private long accessTokenValidityMs = 900_000;
        private long refreshTokenValidityMs = 604_800_000;
        private String issuer = "ano-chat";
    }

    @Getter
    @Setter
    public static class RateLimit {
        private int requestsPerMinute = 60;
        private int burst = 100;
    }

    @Getter
    @Setter
    public static class Cors {
        private String allowedOrigins = "http://localhost:4200";
        private String allowedMethods = "GET,POST,PUT,DELETE,PATCH,OPTIONS";
        private String allowedHeaders = "*";
        private boolean allowCredentials = true;
        private long maxAge = 3600;
    }
}
