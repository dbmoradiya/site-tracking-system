package com.sitetrack;

import com.sitetrack.api.Mobile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * APP_ADMIN_MOBILE / APP_ADMIN_PASSWORD (any profile).
 * With no Admin yet, both together create the first Admin. With an Admin, the mobile number
 * and the password are updated. Remove the variables after use. Nothing is applied when empty.
 */
@Configuration
class AdminCredentialsInitializer {
    private static final Logger log = LoggerFactory.getLogger(AdminCredentialsInitializer.class);

    @Bean
    ApplicationRunner adminCredentials(JdbcClient jdbc, PasswordEncoder encoder,
                                       @Value("${app.admin.mobile:}") String rawMobile,
                                       @Value("${app.admin.password:}") String password) {
        return args -> {
            String mobile = null;
            if (!rawMobile.isBlank()) {
                mobile = Mobile.normalizeOrNull(rawMobile);
                if (mobile == null) throw new IllegalStateException("APP_ADMIN_MOBILE is not a valid mobile number");
            }
            if (!password.isBlank() && (password.length() < 10 || password.length() > 72))
                throw new IllegalStateException("APP_ADMIN_PASSWORD must be 10 to 72 characters");
            boolean hasAdmin = jdbc.sql("select count(*) from app_users where role='ADMIN'").query(Long.class).single() > 0;
            if (!hasAdmin) {
                if (mobile != null && !password.isBlank()) {
                    jdbc.sql("insert into app_users(employee_id,name,mobile,password_hash,role) values (null,'Administrator',:m,:h,'ADMIN')")
                            .param("m", mobile).param("h", encoder.encode(password)).update();
                } else if (mobile != null || !password.isBlank()) {
                    throw new IllegalStateException("There is no Admin yet. Set both APP_ADMIN_MOBILE and APP_ADMIN_PASSWORD to create it.");
                } else {
                    log.warn("There is no Admin account. Set APP_ADMIN_MOBILE and APP_ADMIN_PASSWORD to create one.");
                }
                return;
            }
            if (mobile != null)
                jdbc.sql("update app_users set mobile=:m where id=(select min(id) from app_users where role='ADMIN')").param("m", mobile).update();
            if (!password.isBlank())
                jdbc.sql("update app_users set password_hash=:h where id=(select min(id) from app_users where role='ADMIN')").param("h", encoder.encode(password)).update();
        };
    }
}
