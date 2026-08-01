package com.anochat.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class CloudEnvDiagnostics {

    private static final Logger log = LoggerFactory.getLogger(CloudEnvDiagnostics.class);

    private final Environment environment;

    public CloudEnvDiagnostics(Environment environment) {
        this.environment = environment;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void logCloudEnv() {
        boolean hasDatabaseUrl = isSet("DATABASE_URL");
        boolean hasPostgresHost = isSet("POSTGRES_HOST");
        boolean hasRedisUrl = isSet("REDIS_URL");
        boolean hasRedisHost = isSet("REDIS_HOST");

        log.info(
                "Cloud env: DATABASE_URL={}, POSTGRES_HOST={}, REDIS_URL={}, REDIS_HOST={}, profile={}",
                hasDatabaseUrl,
                hasPostgresHost ? mask(environment.getProperty("POSTGRES_HOST")) : false,
                hasRedisUrl,
                hasRedisHost ? mask(environment.getProperty("REDIS_HOST")) : false,
                String.join(",", environment.getActiveProfiles())
        );

        if (!hasDatabaseUrl && !hasPostgresHost) {
            log.error(
                    "No database configured. On Render: Postgres -> Connect -> Add DATABASE_URL to backend service, then redeploy."
            );
        }
    }

    private boolean isSet(String key) {
        String value = environment.getProperty(key);
        return value != null && !value.isBlank();
    }

    private static String mask(String value) {
        if (value == null || value.length() <= 8) {
            return "***";
        }
        return value.substring(0, 4) + "..." + value.substring(value.length() - 4);
    }
}
