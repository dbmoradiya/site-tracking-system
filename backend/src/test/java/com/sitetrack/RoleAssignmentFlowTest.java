package com.sitetrack;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** End-to-end API checks against a real (embedded) PostgreSQL with the Flyway schema and seed data. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RoleAssignmentFlowTest {
    static EmbeddedPostgres postgres;

    @BeforeAll
    static void start() throws IOException { postgres = EmbeddedPostgres.builder().start(); }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) throws IOException {
        if (postgres == null) postgres = EmbeddedPostgres.builder().start();
        registry.add("DB_URL", () -> postgres.getJdbcUrl("postgres", "postgres"));
        registry.add("DB_USERNAME", () -> "postgres");
        registry.add("DB_PASSWORD", () -> "postgres");
        registry.add("spring.datasource.url", () -> postgres.getJdbcUrl("postgres", "postgres"));
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
        registry.add("app.upload-dir", () -> {
            try { return Files.createTempDirectory("sitetrack-test").toString(); } catch (IOException e) { throw new RuntimeException(e); }
        });
    }

    @LocalServerPort int port;
    static final String PASSWORD = "SiteTrack123!";

    RestClient client() { return RestClient.builder().baseUrl("http://localhost:" + port + "/api").build(); }

    @SuppressWarnings("unchecked")
    String login(String email) {
        Map<String, Object> body = client().post().uri("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("email", email, "password", PASSWORD)).retrieve().body(Map.class);
        return (String) body.get("token");
    }

    @SuppressWarnings("unchecked")
    <T> T get(String token, String uri, Class<T> type) {
        return client().get().uri(uri).header("Authorization", "Bearer " + token).retrieve().body(type);
    }

    int send(HttpMethod method, String token, String uri, Object body) {
        try {
            RestClient.RequestBodySpec spec = client().method(method).uri(uri).header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON);
            ResponseEntity<Void> response = (body == null ? spec : spec.body(body)).retrieve().toBodilessEntity();
            return response.getStatusCode().value();
        } catch (HttpClientErrorException e) { return e.getStatusCode().value(); }
    }

    @SuppressWarnings("unchecked")
    long post(String token, String uri, Object body) {
        Map<String, Object> result = client().post().uri(uri).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(Map.class);
        return ((Number) result.get("id")).longValue();
    }

    @SuppressWarnings("unchecked")
    @Test
    void perStageAssignmentsSiteEditMoveAndEvidenceRules() {
        String admin = login("admin@sitetrack.local");
        String coordinator = login("coordinator@sitetrack.local");
        String supervisor = login("supervisor@sitetrack.local");
        // seeded logins for the two other operational roles exist
        assertNotNull(login("design@sitetrack.local"));
        assertNotNull(login("procurement@sitetrack.local"));

        Map<String, Object> setup = get(admin, "/setup", Map.class);
        List<Map<String, Object>> employees = (List<Map<String, Object>>) setup.get("employees");
        long supervisorA = idOf(employees, "supervisor@sitetrack.local");
        long supervisorB = idOf(employees, "mehul@sitetrack.local");
        long designer = idOf(employees, "design@sitetrack.local");
        long coordinatorId = idOf(employees, "coordinator@sitetrack.local");

        long projectA = post(admin, "/projects", Map.of("name", "Project A", "customerName", "Acme", "customerMobile", "9999999999", "coordinatorId", coordinatorId));
        long projectB = post(admin, "/projects", Map.of("name", "Project B", "customerName", "Acme", "customerMobile", "9999999999", "coordinatorId", coordinatorId));
        long site = post(admin, "/projects/" + projectA + "/sites", Map.of("name", "Site 1", "siteTypeId", 1, "stages", List.of(
                Map.of("name", "Design", "requiredRoles", List.of("DESIGN_ENGINEER", "SUPERVISOR")),
                Map.of("name", "Build", "dependsOnPosition", 1, "requiredRoles", List.of("SUPERVISOR")),
                Map.of("name", "Handover", "dependsOnPosition", 2, "requiredRoles", List.of()))));

        Map<String, Object> detail = get(admin, "/sites/" + site, Map.class);
        List<Map<String, Object>> stages = (List<Map<String, Object>>) detail.get("stages");
        assertEquals(3, stages.size());
        assertEquals(2, ((List<?>) stages.get(0).get("assignments")).size());
        assertEquals(0, ((List<?>) stages.get(2).get("assignments")).size(), "a stage with no roles has no assignment fields");
        long stage1 = ((Number) stages.get(0).get("id")).longValue();
        long stage2 = ((Number) stages.get(1).get("id")).longValue();
        long stage3 = ((Number) stages.get(2).get("id")).longValue();
        String base = "/sites/" + site + "/stages/";

        // coordinator and admin may assign; the same role can differ per stage
        assertEquals(200, send(HttpMethod.PUT, coordinator, base + stage1 + "/assignments", Map.of("roleAssignments", Map.of("DESIGN_ENGINEER", designer, "SUPERVISOR", supervisorA))));
        assertEquals(200, send(HttpMethod.PUT, admin, base + stage2 + "/assignments", Map.of("roleAssignments", Map.of("SUPERVISOR", supervisorB))));
        // an operational role cannot assign, and invalid requests are rejected
        assertEquals(403, send(HttpMethod.PUT, supervisor, base + stage1 + "/assignments", Map.of("roleAssignments", Map.of("SUPERVISOR", supervisorB))));
        assertEquals(400, send(HttpMethod.PUT, admin, base + stage2 + "/assignments", Map.of("roleAssignments", Map.of("DESIGN_ENGINEER", designer))));
        assertEquals(400, send(HttpMethod.PUT, admin, base + stage2 + "/assignments", Map.of("roleAssignments", Map.of("SUPERVISOR", designer))));
        assertEquals(400, send(HttpMethod.PUT, admin, base + stage3 + "/assignments", Map.of("roleAssignments", Map.of("SUPERVISOR", supervisorA))));

        stages = (List<Map<String, Object>>) get(admin, "/sites/" + site, Map.class).get("stages");
        assertEquals(supervisorA, assignee(stages.get(0), "SUPERVISOR"));
        assertEquals(supervisorB, assignee(stages.get(1), "SUPERVISOR"));

        // only Admin edits Site details or moves a Site
        assertEquals(403, send(HttpMethod.PUT, coordinator, "/sites/" + site, Map.of("name", "Hacked")));
        assertEquals(200, send(HttpMethod.PUT, admin, "/sites/" + site, Map.of("name", "Site 1 renamed", "address", "Plot 7", "targetDate", "2027-01-31")));
        detail = get(admin, "/sites/" + site, Map.class);
        assertEquals("Site 1 renamed", detail.get("name"));
        assertEquals("2027-01-31", detail.get("targetDate"));
        assertEquals(403, send(HttpMethod.PUT, coordinator, "/sites/" + site + "/project", Map.of("projectId", projectB)));
        assertEquals(200, send(HttpMethod.PUT, admin, "/sites/" + site + "/project", Map.of("projectId", projectB)));
        assertEquals(projectB, ((Number) get(admin, "/sites/" + site, Map.class).get("projectId")).longValue());
        // assignments survive the move
        stages = (List<Map<String, Object>>) get(admin, "/sites/" + site, Map.class).get("stages");
        assertEquals(supervisorA, assignee(stages.get(0), "SUPERVISOR"));

        // evidence must be an image or a PDF
        assertEquals(400, upload(admin, stage1, "notes.txt", "text/plain"));
        assertEquals(400, upload(admin, stage1, "run.exe", "application/octet-stream"));
        assertEquals(200, upload(admin, stage1, "photo.png", "image/png"));
        assertEquals(200, upload(admin, stage1, "plan.pdf", "application/pdf"));
    }

    int upload(String token, long stage, String filename, String type) {
        MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
        parts.add("file", new ByteArrayResource("data".getBytes()) {
            @Override public String getFilename() { return filename; }
        });
        try {
            return client().post().uri("/stages/" + stage + "/evidence").header("Authorization", "Bearer " + token)
                    .contentType(MediaType.MULTIPART_FORM_DATA).body(parts).retrieve().toBodilessEntity().getStatusCode().value();
        } catch (HttpClientErrorException e) { return e.getStatusCode().value(); }
    }

    @SuppressWarnings("unchecked")
    long idOf(List<Map<String, Object>> employees, String email) {
        return employees.stream().filter(e -> email.equals(e.get("email"))).mapToLong(e -> ((Number) e.get("id")).longValue()).findFirst().orElseThrow();
    }

    @SuppressWarnings("unchecked")
    long assignee(Map<String, Object> stage, String role) {
        return ((List<Map<String, Object>>) stage.get("assignments")).stream().filter(a -> role.equals(a.get("role")))
                .mapToLong(a -> ((Number) a.get("employeeId")).longValue()).findFirst().orElse(-1);
    }
}
