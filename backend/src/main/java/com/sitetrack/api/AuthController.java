package com.sitetrack.api;

import com.sitetrack.security.AppPrincipal;
import com.sitetrack.security.TokenService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final JdbcClient jdbc;
    private final PasswordEncoder passwords;
    private final TokenService tokens;

    private static final int MAX_FAILURES = 8;
    private static final long WINDOW_MS = 15 * 60 * 1000L;
    private final java.util.concurrent.ConcurrentHashMap<String, long[]> failures = new java.util.concurrent.ConcurrentHashMap<>();

    private void checkThrottle(String key) {
        long[] f = failures.get(key);
        if (f != null && System.currentTimeMillis() - f[1] < WINDOW_MS && f[0] >= MAX_FAILURES)
            throw new ApiException(429, "Too many failed sign-in attempts. Try again in 15 minutes.");
    }

    private void recordFailure(String key) {
        long now = System.currentTimeMillis();
        if (failures.size() > 5000) failures.entrySet().removeIf(e -> now - e.getValue()[1] > WINDOW_MS);
        failures.compute(key, (k, v) -> v == null || now - v[1] >= WINDOW_MS ? new long[]{1, now} : new long[]{v[0] + 1, now});
    }

    public AuthController(JdbcClient jdbc, PasswordEncoder passwords, TokenService tokens) {
        this.jdbc = jdbc;
        this.passwords = passwords;
        this.tokens = tokens;
    }

    @PostMapping("/change-password")
    public void changePassword(@Valid @RequestBody ChangePasswordRequest request,
                               @org.springframework.security.core.annotation.AuthenticationPrincipal com.sitetrack.security.AppPrincipal principal) {
        String key = "pw:" + principal.id();
        checkThrottle(key);
        if (request.newPassword().length() < 10 || request.newPassword().length() > 72)
            throw new ApiException(400, "New password must be 10 to 72 characters");
        String hash = jdbc.sql("select password_hash from app_users where id=:id and active=true").param("id", principal.id())
                .query(String.class).optional().orElseThrow(() -> new ApiException(401, "Session expired. Please sign in again."));
        if (!passwords.matches(request.currentPassword(), hash)) {
            recordFailure(key);
            throw new ApiException(400, "Current password is incorrect");
        }
        if (passwords.matches(request.newPassword(), hash)) throw new ApiException(400, "New password must be different from the current one");
        jdbc.sql("update app_users set password_hash=:h where id=:id").param("h", passwords.encode(request.newPassword())).param("id", principal.id()).update();
        failures.remove(key);
    }

    public record ChangePasswordRequest(@jakarta.validation.constraints.NotBlank String currentPassword,
                                        @jakarta.validation.constraints.NotBlank String newPassword) {}

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody LoginRequest request) {
        String mobile = Mobile.normalizeOrNull(request.mobile());
        String throttleKey = mobile == null ? "invalid:" + request.mobile().trim() : mobile;
        checkThrottle(throttleKey);
        UserRow user = jdbc.sql("""
                select u.id, u.employee_id, u.name, u.mobile, u.password_hash,
                  case when u.role='ADMIN' then array['ADMIN']::varchar[]
                       else coalesce(array_agg(er.role_code order by er.role_code)
                            filter (where er.role_code is not null), array[]::varchar[]) end roles
                from app_users u left join employee_roles er on er.employee_id=u.employee_id
                where u.mobile=:mobile and u.active=true
                group by u.id
                """).param("mobile", mobile == null ? "" : mobile).query((rs, rowNum) -> new UserRow(
                        rs.getLong("id"), (Long) rs.getObject("employee_id"), rs.getString("name"),
                        rs.getString("mobile"), rs.getString("password_hash"),
                        List.of((String[]) rs.getArray("roles").getArray()))).optional()
                .orElse(null);
        if (user == null || !passwords.matches(request.password(), user.passwordHash())) {
            recordFailure(throttleKey);
            throw new ApiException(401, "Mobile number or password is incorrect");
        }
        failures.remove(throttleKey);
        AppPrincipal principal = new AppPrincipal(user.id(), user.employeeId(), user.name(), user.mobile(), user.roles());
        return Map.of("token", tokens.issue(principal), "user", principal);
    }

    public record LoginRequest(@NotBlank String mobile, @NotBlank String password) {}
    public record UserRow(long id, Long employeeId, String name, String mobile, String passwordHash, List<String> roles) {}
}
