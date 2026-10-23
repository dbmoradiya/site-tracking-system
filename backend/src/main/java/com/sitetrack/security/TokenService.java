package com.sitetrack.security;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class TokenService {
    private final ObjectMapper objectMapper;
    private final byte[] secret;

    public TokenService(ObjectMapper objectMapper, @Value("${app.jwt-secret}") String secret) {
        this.objectMapper = objectMapper;
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    public String issue(AppPrincipal principal) {
        try {
            Map<String, Object> claims = new LinkedHashMap<>();
            claims.put("id", principal.id());
            claims.put("employeeId", principal.employeeId());
            claims.put("name", principal.name());
            claims.put("mobile", principal.mobile());
            claims.put("roles", principal.roles());
            claims.put("exp", Instant.now().plusSeconds(12 * 60 * 60).getEpochSecond());
            String payload = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(objectMapper.writeValueAsBytes(claims));
            return payload + "." + sign(payload);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not create access token", ex);
        }
    }

    public AppPrincipal parse(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 2 || !constantTimeEquals(sign(parts[0]), parts[1])) {
                return null;
            }
            Map<String, Object> claims = objectMapper.readValue(
                    Base64.getUrlDecoder().decode(parts[0]), new TypeReference<>() {});
            if (((Number) claims.get("exp")).longValue() < Instant.now().getEpochSecond()) return null;
            Object employeeId = claims.get("employeeId");
            return new AppPrincipal(
                    ((Number) claims.get("id")).longValue(),
                    employeeId == null ? null : ((Number) employeeId).longValue(),
                    (String) claims.get("name"),
                    (String) claims.get("mobile"),
                    objectMapper.convertValue(claims.get("roles"), new TypeReference<List<String>>() {}));
        } catch (Exception ignored) {
            return null;
        }
    }

    private String sign(String value) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret, "HmacSHA256"));
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    }

    private boolean constantTimeEquals(String left, String right) {
        return java.security.MessageDigest.isEqual(
                left.getBytes(StandardCharsets.US_ASCII), right.getBytes(StandardCharsets.US_ASCII));
    }
}
