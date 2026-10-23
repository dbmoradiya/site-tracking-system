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
                                       @Value("${app.bootstrap-admin.mobile}") String adminMobile,
                                       @Value("${app.bootstrap-admin.name}") String adminName,
                                       @Value("${app.bootstrap-admin.password}") String adminPassword,
                                       @Value("${app.bootstrap-admin.clear-demo-data:false}") boolean clearDemoData) {
        return args -> {
            if (jwtSecret.length() < 32 || jwtSecret.contains("change-me") || jwtSecret.contains("change-this") || jwtSecret.contains("development"))
                throw new IllegalStateException("APP_JWT_SECRET must be a random value of at least 32 characters");
            if (origins.isBlank() || origins.contains("*") && !origins.contains("://"))
                throw new IllegalStateException("APP_ALLOWED_ORIGIN_PATTERNS must list the public site URL, for example https://sitetrack.example.com");
            boolean legacyAdmin = LegacyDemoData.legacyAdminExists(jdbc);
            if (legacyAdmin) {
                boolean untouched = LegacyDemoData.looksUntouched(jdbc);
                if (untouched && !clearDemoData)
                    throw new IllegalStateException("This database still holds the built-in sample data. Nothing was deleted. For a brand-new production database set APP_BOOTSTRAP_CLEAR_DEMO_DATA=true for the first start to remove it. For a database with real data, do not use this profile on it until the Admin has a password of its own.");
                if (untouched) {
                    LegacyDemoData.deleteSampleData(jdbc);
                    legacyAdmin = false;
                }
            }
            long admins = jdbc.sql("select count(*) from app_users where role='ADMIN'").query(Long.class).single();
            if (admins > 0 && !legacyAdmin) return;
            String mobile = com.sitetrack.api.Mobile.normalizeOrNull(adminMobile);
            if (mobile == null || adminPassword.length() < 12)
                throw new IllegalStateException(legacyAdmin
                        ? "The Admin still has a built-in password. Set APP_BOOTSTRAP_ADMIN_MOBILE and APP_BOOTSTRAP_ADMIN_PASSWORD (at least 12 characters) to replace it. Existing data is kept."
                        : "No Admin exists. Set APP_BOOTSTRAP_ADMIN_MOBILE (valid mobile number) and APP_BOOTSTRAP_ADMIN_PASSWORD (at least 12 characters) for the first start");
            if (legacyAdmin) {
                jdbc.sql("update app_users set mobile=:mobile,password_hash=:hash where role='ADMIN' and password_hash=:old")
                        .param("mobile", mobile).param("hash", encoder.encode(adminPassword)).param("old", LegacyDemoData.KNOWN_HASH).update();
                return;
            }
            jdbc.sql("insert into app_users(employee_id,name,mobile,password_hash,role) values (null,:name,:mobile,:hash,'ADMIN')")
                    .param("name", adminName).param("mobile", mobile).param("hash", encoder.encode(adminPassword)).update();
        };
    }
}
