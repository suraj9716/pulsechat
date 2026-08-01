package com.anochat.config;

import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import javax.sql.DataSource;

@Configuration
public class AppDataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(AppDataSourceConfig.class);

    @Bean
    @Primary
    public DataSource dataSource(Environment env) {
        String databaseUrl = env.getProperty("DATABASE_URL");
        if (databaseUrl != null && !databaseUrl.isBlank()) {
            UrlEnvParser.PostgresConfig pg = UrlEnvParser.parsePostgresUrl(databaseUrl);
            log.info("PostgreSQL via DATABASE_URL");
            return hikari(pg.jdbcUrl(), pg.username(), pg.password());
        }

        String host = env.getProperty("POSTGRES_HOST", "localhost");
        String port = env.getProperty("POSTGRES_PORT", "5432");
        String db = env.getProperty("POSTGRES_DB", "postgres");
        String user = env.getProperty("POSTGRES_USER", "postgres");
        String pass = env.getProperty("POSTGRES_PASSWORD", "root");

        if (env.acceptsProfiles(Profiles.of("prod")) && isLocalhost(host)) {
            throw new IllegalStateException(
                    "Database not configured for production. On Render: "
                            + "1) Create PostgreSQL, 2) Backend service -> Environment -> "
                            + "Add from Database -> select Postgres (adds DATABASE_URL), "
                            + "3) Redeploy with Clear build cache.");
        }

        log.info("PostgreSQL via POSTGRES_HOST={}:{}", host, port);
        return hikari(
                "jdbc:postgresql://" + host + ":" + port + "/" + db,
                user,
                pass);
    }

    private static boolean isLocalhost(String host) {
        return host == null
                || host.isBlank()
                || "localhost".equalsIgnoreCase(host)
                || "127.0.0.1".equals(host);
    }

    private static HikariDataSource hikari(String jdbcUrl, String username, String password) {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(jdbcUrl);
        ds.setUsername(username);
        ds.setPassword(password);
        ds.setMaximumPoolSize(10);
        ds.setMinimumIdle(5);
        ds.setConnectionTimeout(30_000);
        return ds;
    }
}
