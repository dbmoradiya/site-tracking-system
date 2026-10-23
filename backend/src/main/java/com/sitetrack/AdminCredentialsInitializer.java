package com.sitetrack;

import com.sitetrack.api.Mobile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Optional recovery/setup knobs, applied at startup when the variables are set:
 * APP_ADMIN_MOBILE sets the Admin login mobile number, APP_ADMIN_PASSWORD resets the Admin password.
 * Remove the variables after use. Nothing is applied when they are empty.
 */
@Configuration
class AdminCredentialsInitializer {
    @Bean
    ApplicationRunner adminCredentials(JdbcClient jdbc, PasswordEncoder encoder,
                                       @Value("${app.admin.mobile:}") String rawMobile,
                                       @Value("${app.admin.password:}") String password) {
        return args -> {
            if (!rawMobile.isBlank() && password.isBlank() && LegacyDemoData.legacyAdminExists(jdbc))
                throw new IllegalStateException("The Admin still has a built-in password. Set APP_ADMIN_PASSWORD (10 to 72 characters) together with APP_ADMIN_MOBILE.");
            if (!rawMobile.isBlank()) {
                String mobile = Mobile.normalizeOrNull(rawMobile);
                if (mobile == null) throw new IllegalStateException("APP_ADMIN_MOBILE is not a valid mobile number");
                jdbc.sql("update app_users set mobile=:m where id=(select min(id) from app_users where role='ADMIN')").param("m", mobile).update();
            }
            if (!password.isBlank()) {
                if (password.length() < 10 || password.length() > 72) throw new IllegalStateException("APP_ADMIN_PASSWORD must be 10 to 72 characters");
                jdbc.sql("update app_users set password_hash=:h where id=(select min(id) from app_users where role='ADMIN')").param("h", encoder.encode(password)).update();
            }
        };
    }
}
