package com.sitetrack;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
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

/** End-to-end API checks against a real (embedded) PostgreSQL with the Flyway schema. The database starts empty; the test creates the people, team and site type it needs. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {"app.admin.mobile=9000000009", "app.admin.password=SiteTrack123!"})
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
    static long siteTypeId = -1;

    /** Creates the sample people, one team and one site type once (the schema ships no sample data). */
    @BeforeEach
    void seedOnce() {
        if (siteTypeId > 0) return;
        String admin = login("+919000000009");
        record P(String name, String mobile, String role) {}
        for (P p : List.of(new P("Kavita Shah", "9000000001", "COORDINATOR"), new P("Rakesh Solanki", "9000000002", "SUPERVISOR"),
                new P("Anita Desai", "9000000003", "DESIGN_ENGINEER"), new P("Vikram Rao", "9000000004", "PROCUREMENT_MANAGER"),
                new P("Mehul Parmar", "9000000005", "SUPERVISOR")))
            post(admin, "/setup/employees", Map.of("name", p.name(), "mobile", p.mobile(), "roles", List.of(p.role()), "password", PASSWORD));
        post(admin, "/setup/teams", Map.of("name", "Test Team", "contactName", "Lead", "mobile", "9825000000", "notes", ""));
        siteTypeId = post(admin, "/setup/site-types", Map.of("name", "Test Type", "description", "Test",
                "stages", List.of(Map.of("name", "Only", "requiredRoles", List.of("SUPERVISOR")))));
    }

    RestClient client() { return RestClient.builder().baseUrl("http://localhost:" + port + "/api").build(); }

    @SuppressWarnings("unchecked")
    String login(String mobile) {
        Map<String, Object> body = client().post().uri("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("mobile", mobile, "password", PASSWORD)).retrieve().body(Map.class);
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
        String admin = login("+919000000009");
        String coordinator = login("+919000000001");
        String supervisor = login("+919000000002");
        // the logins for the two other operational roles exist
        assertNotNull(login("+919000000003"));
        assertNotNull(login("+919000000004"));

        Map<String, Object> setup = get(admin, "/setup", Map.class);
        List<Map<String, Object>> employees = (List<Map<String, Object>>) setup.get("employees");
        long supervisorA = idOf(employees, "+919000000002");
        long supervisorB = idOf(employees, "Mehul Parmar");
        long designer = idOf(employees, "+919000000003");
        long coordinatorId = idOf(employees, "+919000000001");

        long projectA = post(admin, "/projects", Map.of("name", "Project A", "customerName", "Acme", "customerMobile", "9999999999", "coordinatorId", coordinatorId));
        long projectB = post(admin, "/projects", Map.of("name", "Project B", "customerName", "Acme", "customerMobile", "9999999999", "coordinatorId", coordinatorId));
        long site = post(admin, "/projects/" + projectA + "/sites", Map.of("name", "Site 1", "siteTypeId", siteTypeId, "stages", List.of(
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
        assertEquals(404, send(HttpMethod.PUT, admin, "/sites/" + site + "/project", Map.of("projectId", projectB)));
        long throwaway = post(admin, "/projects/" + projectB + "/sites", Map.of("name", "Throwaway", "siteTypeId", siteTypeId, "stages", List.of(
                Map.of("name", "Only", "requiredRoles", List.of("SUPERVISOR")))));
        assertEquals(403, send(HttpMethod.DELETE, coordinator, "/sites/" + throwaway, null));
        assertEquals(200, send(HttpMethod.DELETE, admin, "/sites/" + throwaway, null));
        assertEquals(404, send(HttpMethod.GET, admin, "/sites/" + throwaway, null));
        // assignments are unchanged
        stages = (List<Map<String, Object>>) get(admin, "/sites/" + site, Map.class).get("stages");
        assertEquals(supervisorA, assignee(stages.get(0), "SUPERVISOR"));

        // evidence must be an image or a PDF
        assertEquals(400, upload(admin, stage1, "notes.txt", "text/plain"));
        assertEquals(400, upload(admin, stage1, "run.exe", "application/octet-stream"));
        assertEquals(200, upload(admin, stage1, "photo.png", "image/png"));
        assertEquals(200, upload(admin, stage1, "sheet.xlsx", "application/octet-stream"));
        assertEquals(200, upload(admin, stage1, "report.docx", "application/octet-stream"));
        assertEquals(200, upload(admin, stage1, "old.xls", "application/octet-stream"));
        assertEquals(200, upload(admin, stage1, "old.doc", "application/octet-stream"));
        assertEquals(200, upload(admin, stage1, "plan.pdf", "application/pdf"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void teamCanBeRequiredPerStage() {
        String admin = login("+919000000009");
        String coordinator = login("+919000000001");
        Map<String, Object> setup = get(admin, "/setup", Map.class);
        List<Map<String, Object>> teams = (List<Map<String, Object>>) setup.get("teams");
        long teamId = ((Number) teams.get(0).get("id")).longValue();
        long coordinatorId = idOf((List<Map<String, Object>>) setup.get("employees"), "+919000000001");
        // a Team is not a valid employee role
        assertEquals(400, send(HttpMethod.POST, admin, "/setup/employees", Map.of("name", "Bad Role", "mobile", "9000000055", "roles", List.of("TEAM"), "password", "Sample1234!")));
        long project = post(admin, "/projects", Map.of("name", "Team Project", "customerName", "Acme", "customerMobile", "9999999999", "coordinatorId", coordinatorId));
        long site = post(admin, "/projects/" + project + "/sites", Map.of("name", "Team Site", "siteTypeId", siteTypeId, "stages", List.of(
                Map.of("name", "Civil", "requiredRoles", List.of("TEAM", "SUPERVISOR")))));
        Map<String, Object> detail = get(admin, "/sites/" + site, Map.class);
        Map<String, Object> stage = ((List<Map<String, Object>>) detail.get("stages")).get(0);
        long stageId = ((Number) stage.get("id")).longValue();
        String uri = "/sites/" + site + "/stages/" + stageId + "/assignments";
        assertEquals(400, send(HttpMethod.PUT, admin, uri, Map.of("roleAssignments", Map.of("TEAM", 999999))));
        assertEquals(200, send(HttpMethod.PUT, coordinator, uri, Map.of("roleAssignments", Map.of("TEAM", teamId))));
        stage = ((List<Map<String, Object>>) get(admin, "/sites/" + site, Map.class).get("stages")).get(0);
        Map<String, Object> teamAssignment = ((List<Map<String, Object>>) stage.get("assignments")).stream()
                .filter(a -> "TEAM".equals(a.get("role"))).findFirst().orElseThrow();
        assertEquals(teamId, ((Number) teamAssignment.get("employeeId")).longValue());
        assertNotNull(teamAssignment.get("employeeName"));
        // clearing works
        Map<String, Object> clear = new java.util.HashMap<>(); clear.put("TEAM", null);
        assertEquals(200, send(HttpMethod.PUT, admin, uri, Map.of("roleAssignments", clear)));
        stage = ((List<Map<String, Object>>) get(admin, "/sites/" + site, Map.class).get("stages")).get(0);
        assertNull(((List<Map<String, Object>>) stage.get("assignments")).stream().filter(a -> "TEAM".equals(a.get("role"))).findFirst().orElseThrow().get("employeeId"));
    }

    static byte[] sampleBytes(String filename) {
        String f = filename.toLowerCase();
        byte[] body = new byte[64];
        byte[] magic = f.endsWith(".png") ? new byte[]{(byte) 0x89, 'P', 'N', 'G'}
                : f.endsWith(".pdf") ? "%PDF".getBytes()
                : (f.endsWith(".xlsx") || f.endsWith(".docx")) ? new byte[]{'P', 'K', 3, 4}
                : (f.endsWith(".xls") || f.endsWith(".doc")) ? new byte[]{(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0}
                : new byte[]{'d', 'a', 't', 'a'};
        System.arraycopy(magic, 0, body, 0, magic.length);
        return body;
    }

    int upload(String token, long stage, String filename, String type) {
        MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
        parts.add("file", new ByteArrayResource(sampleBytes(filename)) {
            @Override public String getFilename() { return filename; }
        });
        try {
            return client().post().uri("/stages/" + stage + "/evidence").header("Authorization", "Bearer " + token)
                    .contentType(MediaType.MULTIPART_FORM_DATA).body(parts).retrieve().toBodilessEntity().getStatusCode().value();
        } catch (HttpClientErrorException e) { return e.getStatusCode().value(); }
    }

    @SuppressWarnings("unchecked")
    long idOf(List<Map<String, Object>> employees, String email) {
        return employees.stream().filter(e -> email.equals(e.get("mobile")) || email.equals(e.get("name"))).mapToLong(e -> ((Number) e.get("id")).longValue()).findFirst().orElseThrow();
    }

    @SuppressWarnings("unchecked")
    long assignee(Map<String, Object> stage, String role) {
        return ((List<Map<String, Object>>) stage.get("assignments")).stream().filter(a -> role.equals(a.get("role")))
                .mapToLong(a -> ((Number) a.get("employeeId")).longValue()).findFirst().orElse(-1);
    }
}
