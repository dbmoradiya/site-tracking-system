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

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final JdbcClient jdbc;
    private final PasswordEncoder passwords;
    private final TokenService tokens;

    public AuthController(JdbcClient jdbc, PasswordEncoder passwords, TokenService tokens) {
        this.jdbc = jdbc;
        this.passwords = passwords;
        this.tokens = tokens;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody LoginRequest request) {
        UserRow user = jdbc.sql("""
                select id, employee_id, name, email, password_hash, role
                from app_users where lower(email)=lower(:email) and active=true
                """).param("email", request.email()).query(UserRow.class).optional()
                .orElseThrow(() -> new ApiException(401, "Email or password is incorrect"));
        if (!passwords.matches(request.password(), user.passwordHash())) {
            throw new ApiException(401, "Email or password is incorrect");
        }
        AppPrincipal principal = new AppPrincipal(user.id(), user.employeeId(), user.name(), user.email(), user.role());
        return Map.of("token", tokens.issue(principal), "user", principal);
    }

    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}
    public record UserRow(long id, Long employeeId, String name, String email, String passwordHash, String role) {}
}
