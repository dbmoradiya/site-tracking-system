package com.sitetrack;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Production startup checks and first-Admin creation. Active only with the "prod" profile.
 * The application refuses to start with a weak or default JWT secret, and creates the first
 * Admin from environment variables when no Admin exists yet.
 */
@Configuration
@Profile("prod")
class ProductionBootstrap {
    @Bean
    ApplicationRunner productionChecks(JdbcClient jdbc, PasswordEncoder encoder,
                                       @Value("${app.jwt-secret}") String jwtSecret,
                                       @Value("${app.allowed-origin-patterns}") String origins,
                                       @Value("${app.bootstrap-admin.email}") String adminEmail,
                                       @Value("${app.bootstrap-admin.name}") String adminName,
                                       @Value("${app.bootstrap-admin.password}") String adminPassword) {
        return args -> {
            if (jwtSecret.length() < 32 || jwtSecret.contains("change-me") || jwtSecret.contains("change-this") || jwtSecret.contains("development"))
                throw new IllegalStateException("APP_JWT_SECRET must be a random value of at least 32 characters");
            if (origins.isBlank() || origins.contains("*") && !origins.contains("://"))
                throw new IllegalStateException("APP_ALLOWED_ORIGIN_PATTERNS must list the public site URL, for example https://sitetrack.example.com");
            long admins = jdbc.sql("select count(*) from app_users where role='ADMIN'").query(Long.class).single();
            if (admins > 0) return;
            if (adminEmail.isBlank() || adminPassword.length() < 12)
                throw new IllegalStateException("No Admin exists. Set APP_BOOTSTRAP_ADMIN_EMAIL and APP_BOOTSTRAP_ADMIN_PASSWORD (at least 12 characters) for the first start");
            jdbc.sql("insert into app_users(employee_id,name,email,password_hash,role) values (null,:name,:email,:hash,'ADMIN')")
                    .param("name", adminName).param("email", adminEmail.trim().toLowerCase()).param("hash", encoder.encode(adminPassword)).update();
        };
    }
}
