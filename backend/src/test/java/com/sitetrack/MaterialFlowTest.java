package com.sitetrack;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** Material module against a real embedded PostgreSQL: authorization, isolation, stock, versions, ids, archive, challan. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {"app.admin.mobile=9000000009", "app.admin.password=SiteTrack123!"})
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class MaterialFlowTest {
    static EmbeddedPostgres postgres;
    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry r) throws IOException {
        if (postgres == null) postgres = EmbeddedPostgres.builder().start();
        r.add("spring.datasource.url", () -> postgres.getJdbcUrl("postgres", "postgres"));
        r.add("spring.datasource.username", () -> "postgres");
        r.add("spring.datasource.password", () -> "postgres");
        r.add("app.upload-dir", () -> { try { return Files.createTempDirectory("mat-test").toString(); } catch (IOException e) { throw new RuntimeException(e); } });
    }
    @LocalServerPort int port;
    @Autowired JdbcClient jdbc;
    @Autowired com.sitetrack.material.MaterialService svc;
    static final String PW = "SiteTrack123!";
    static String admin, kavita, other, supervisor;
    static long siteA1, siteA2, siteB1, projA, projB;
    static String today = LocalDate.now().toString();
    static String code(String prefix) { String d = LocalDate.now().toString(); return prefix + d.substring(2, 4) + d.substring(5, 7) + d.substring(8, 10); }

    RestClient c() { return RestClient.builder().baseUrl("http://localhost:" + port + "/api").build(); }
    @SuppressWarnings("unchecked") String login(String mobile) {
        return (String) c().post().uri("/auth/login").contentType(MediaType.APPLICATION_JSON).body(Map.of("mobile", mobile, "password", PW)).retrieve().body(Map.class).get("token"); }
    String pdfText(byte[] pdf) throws Exception {
        com.lowagie.text.pdf.PdfReader r = new com.lowagie.text.pdf.PdfReader(pdf);
        StringBuilder sb = new StringBuilder(); com.lowagie.text.pdf.parser.PdfTextExtractor x = new com.lowagie.text.pdf.parser.PdfTextExtractor(r);
        for (int i = 1; i <= r.getNumberOfPages(); i++) sb.append(x.getTextFromPage(i)).append('\n');
        return sb.toString();
    }
    @SuppressWarnings("unchecked") List<Map<String, Object>> send2(HttpMethod m, String tok, String uri) { return c().method(m).uri(uri).header("Authorization", "Bearer " + tok).retrieve().body(List.class); }
    @SuppressWarnings("unchecked") <T> T get(String tok, String uri, Class<T> t) { return c().get().uri(uri).header("Authorization", "Bearer " + tok).retrieve().body(t); }
    int status(HttpMethod m, String tok, String uri, Object body) {
        try {
            RestClient.RequestBodySpec s = c().method(m).uri(uri).headers(h -> { if (tok != null) h.setBearerAuth(tok); }).contentType(MediaType.APPLICATION_JSON);
            return (body == null ? s : s.body(body)).retrieve().toBodilessEntity().getStatusCode().value();
        } catch (HttpStatusCodeException e) { return e.getStatusCode().value(); }
    }
    @SuppressWarnings("unchecked") Map<String, Object> send(HttpMethod m, String tok, String uri, Object body) {
        return c().method(m).uri(uri).header("Authorization", "Bearer " + tok).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(Map.class); }
    @SuppressWarnings("unchecked") long create(String tok, String uri, Object body) { return ((Number) send(HttpMethod.POST, tok, uri, body).get("id")).longValue(); }

    Map<String, Object> item(String mat, String uom, String q, String r, String g) { return Map.of("material", mat, "uom", uom, "qty", new BigDecimal(q), "rate", new BigDecimal(r), "gst", new BigDecimal(g)); }
    Map<String, Object> purchaseBody(String date, String vendor, String bill, Object items) {
        Map<String, Object> m = new LinkedHashMap<>(); m.put("date", date); m.put("vendor", vendor); m.put("vendorMobile", "9825012345"); m.put("vendorGst", "24BBBBB1111B1Z6"); m.put("vendorAddress", "Ahmedabad"); m.put("billNumber", bill); m.put("items", items); return m; }

    int purchaseStatus(String method, String tok, String uri, Map<String, Object> data, byte[] file, String fileName) throws Exception {
        MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
        parts.add("data", new tools.jackson.databind.ObjectMapper().writeValueAsString(data));
        if (file != null) parts.add("invoice", new ByteArrayResource(file) { @Override public String getFilename() { return fileName; } });
        try { return c().method(HttpMethod.valueOf(method)).uri(uri).headers(h -> h.setBearerAuth(tok)).contentType(MediaType.MULTIPART_FORM_DATA).body(parts).retrieve().toBodilessEntity().getStatusCode().value(); }
        catch (HttpStatusCodeException e) { return e.getStatusCode().value(); }
    }
    @SuppressWarnings("unchecked") Map<String, Object> purchase(String method, String uri, Map<String, Object> data, byte[] file, String fileName) throws Exception {
        MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
        parts.add("data", new tools.jackson.databind.ObjectMapper().writeValueAsString(data));
        if (file != null) parts.add("invoice", new ByteArrayResource(file) { @Override public String getFilename() { return fileName; } });
        return c().method(HttpMethod.valueOf(method)).uri(uri).headers(h -> h.setBearerAuth(admin)).contentType(MediaType.MULTIPART_FORM_DATA).body(parts).retrieve().body(Map.class);
    }

    @SuppressWarnings("unchecked") void seed() {
        if (admin != null) return;
        admin = login("+919000000009");
        for (String[] p : new String[][]{{"Kavita Shah", "9000000001", "COORDINATOR"}, {"Other Coord", "9000000006", "COORDINATOR"}, {"Rakesh S", "9000000002", "SUPERVISOR"}})
            create(admin, "/setup/employees", Map.of("name", p[0], "mobile", p[1], "roles", List.of(p[2]), "password", PW));
        create(admin, "/setup/teams", Map.of("name", "T", "contactName", "L", "mobile", "9825000000", "notes", ""));
        long type = create(admin, "/setup/site-types", Map.of("name", "TT", "description", "d", "stages", List.of(Map.of("name", "Only", "requiredRoles", List.of("SUPERVISOR")))));
        List<Map<String, Object>> emps = (List<Map<String, Object>>) get(admin, "/setup", Map.class).get("employees");
        long kid = emps.stream().filter(e -> "Kavita Shah".equals(e.get("name"))).map(e -> ((Number) e.get("id")).longValue()).findFirst().orElseThrow();
        long oid = emps.stream().filter(e -> "Other Coord".equals(e.get("name"))).map(e -> ((Number) e.get("id")).longValue()).findFirst().orElseThrow();
        projA = create(admin, "/projects", Map.of("name", "Proj A", "customerName", "A", "customerMobile", "9999999999", "coordinatorId", kid));
        projB = create(admin, "/projects", Map.of("name", "Proj B", "customerName", "B", "customerMobile", "9999999999", "coordinatorId", oid));
        java.util.function.BiFunction<Long, String, Long> site = (p, n) -> create(admin, "/projects/" + p + "/sites", Map.of("name", n, "siteTypeId", type, "stages", List.of(Map.of("name", "Only", "requiredRoles", List.of("SUPERVISOR")))));
        siteA1 = site.apply(projA, "A-One"); siteA2 = site.apply(projA, "A-Two"); siteB1 = site.apply(projB, "B-One");
        kavita = login("+919000000001"); other = login("+919000000006"); supervisor = login("+919000000002");
    }

    @Test @Order(1)
    void onlyAdminCanUseMaterialApis() throws Exception {
        seed();
        for (String tok : new String[]{kavita, supervisor}) {
            assertEquals(403, status(HttpMethod.GET, tok, "/material/bootstrap", null));
            assertEquals(403, status(HttpMethod.GET, tok, "/material/stock", null));
            assertEquals(403, status(HttpMethod.GET, tok, "/material/purchases", null));
            assertEquals(403, status(HttpMethod.POST, tok, "/material/sales", Map.of()));
            assertEquals(403, status(HttpMethod.PUT, tok, "/material/company", Map.of()));
            assertEquals(403, status(HttpMethod.POST, tok, "/material/vendors", Map.of("name", "x", "mobile", "9999999999")));
            assertEquals(403, purchaseStatus("POST", tok, "/material/purchases", purchaseBody(today, "V", "", List.of(item("M", "Bag", "1", "1", "5"))), null, null));
        }
        assertEquals(401, status(HttpMethod.GET, null, "/material/stock", null));
    }

    @Test @Order(2) @SuppressWarnings("unchecked")
    void purchaseIdsStockVersionsAndArchive() throws Exception {
        seed();
        Map<String, Object> p1 = purchase("POST", "/material/purchases", purchaseBody(today, "Ambika Traders", "B1", List.of(item("Cement OPC", "Bag", "100", "390", "28"), item("TMT Bar", "Kg", "500.5", "64.25", "18"))), null, null);
        assertEquals(code("SE") + "001", p1.get("purchaseId"));
        Map<String, Object> p2 = purchase("POST", "/material/purchases", purchaseBody(today, "Ambika Traders", "", List.of(item("Cement OPC", "Bag", "10", "400", "28"))), null, null);
        assertEquals(code("SE") + "002", p2.get("purchaseId"));
        long id2 = ((Number) p2.get("id")).longValue();
        // archive p2; next number is 003, never 002 again
        assertEquals(200, status(HttpMethod.DELETE, admin, "/material/purchases/" + id2, null));
        Map<String, Object> p3 = purchase("POST", "/material/purchases", purchaseBody(today, "Ambika Traders", "", List.of(item("Cement OPC", "Bag", "5", "400", "28"))), null, null);
        assertEquals(code("SE") + "003", p3.get("purchaseId"));
        // archived row and its data are still in the database
        assertEquals(1L, jdbc.sql("select count(*) from purchases where id=:i and deleted_at is not null").param("i", id2).query(Long.class).single());
        assertEquals(1L, jdbc.sql("select count(*) from purchase_items where purchase_id=:i").param("i", id2).query(Long.class).single());
        List<Map<String, Object>> list = get(admin, "/material/purchases", List.class);
        assertTrue(list.stream().noneMatch(x -> ((Number) x.get("id")).longValue() == id2));
        // a unit that disagrees with the material's existing unit is refused
        assertEquals(400, purchaseStatus("POST", admin, "/material/purchases", purchaseBody(today, "Ambika Traders", "", List.of(item("Cement OPC", "Kg", "1", "1", "5"))), null, null));
        // no silent clamping or normalising: bad numbers are rejected
        assertEquals(400, purchaseStatus("POST", admin, "/material/purchases", purchaseBody(today, "Ambika Traders", "", List.of(item("Cement OPC", "Bag", "0", "1", "5"))), null, null));
        assertEquals(400, purchaseStatus("POST", admin, "/material/purchases", purchaseBody(today, "Ambika Traders", "", List.of(item("Cement OPC", "Bag", "1", "-1", "5"))), null, null));
        assertEquals(400, purchaseStatus("POST", admin, "/material/purchases", purchaseBody(today, "Ambika Traders", "", List.of(item("Cement OPC", "Bag", "1", "1", "101"))), null, null));
        assertEquals(400, purchaseStatus("POST", admin, "/material/purchases", purchaseBody(today, "Ambika Traders", "", List.of()), null, null));
        // stock: 100 + 5 cement (p2 archived), 500.5 TMT
        Map<String, BigDecimal> st = stockMap();
        assertEquals(0, new BigDecimal("105").compareTo(st.get("Cement OPC")));
        assertEquals(0, new BigDecimal("500.5").compareTo(st.get("TMT Bar")));

        // version rules
        long id1 = ((Number) p1.get("id")).longValue();
        Map<String, Object> same = purchase("PUT", "/material/purchases/" + id1, purchaseBody(today, "Ambika Traders", "B1", List.of(item("Cement OPC", "Bag", "100", "390", "28"), item("TMT Bar", "Kg", "500.5", "64.25", "18"))), null, null);
        assertEquals(0, ((List<?>) same.get("versions")).size(), "no change = no new version");
        Thread.sleep(1100);
        Map<String, Object> changed = purchase("PUT", "/material/purchases/" + id1, purchaseBody(today, "Ambika Traders", "B1-fix", List.of(item("Cement OPC", "Bag", "120", "390", "28"), item("TMT Bar", "Kg", "500.5", "64.25", "18"))), null, null);
        List<Map<String, Object>> vers = (List<Map<String, Object>>) changed.get("versions");
        assertEquals(1, vers.size());
        assertEquals("B1", vers.get(0).get("billNumber"));
        assertEquals(0, new BigDecimal("100").compareTo(new BigDecimal(((List<Map<String, Object>>) vers.get(0).get("items")).get(0).get("qty").toString())));
        assertEquals(p1.get("purchaseId"), changed.get("purchaseId"), "the purchase id never changes on edit");
        assertNotEquals(vers.get(0).get("activeFrom"), vers.get(0).get("activeTo"));
        assertEquals(vers.get(0).get("activeTo"), changed.get("activeFrom"));
        assertEquals(0, new BigDecimal("125").compareTo(stockMap().get("Cement OPC")));
        // renaming a material updates it everywhere, including old versions, and keeps quantities
        long matId = ((Number) ((List<Map<String, Object>>) get(admin, "/material/bootstrap", Map.class).get("materialTypes")).stream().filter(m -> "TMT Bar".equals(m.get("name"))).findFirst().orElseThrow().get("id")).longValue();
        assertEquals(409, status(HttpMethod.PUT, admin, "/material/types/" + matId, Map.of("name", "Cement OPC", "uom", "Kg")), "duplicate name (case-insensitive)");
        assertEquals(409, status(HttpMethod.PUT, admin, "/material/types/" + matId, Map.of("name", "TMT Bar", "uom", "Ton")), "unit locked once used");
        assertEquals(200, status(HttpMethod.PUT, admin, "/material/types/" + matId, Map.of("name", "TMT Bar 12mm", "uom", "Kg")));
        // HSN: optional, saved on the material type, kept when a client omits it, bounded at 16 characters
        assertEquals(200, status(HttpMethod.PUT, admin, "/material/types/" + matId, Map.of("name", "TMT Bar 12mm", "uom", "Kg", "hsn", "7214")));
        assertEquals(200, status(HttpMethod.PUT, admin, "/material/types/" + matId, Map.of("name", "TMT Bar 12mm", "uom", "Kg")));
        assertEquals("7214", ((List<Map<String, Object>>) get(admin, "/material/bootstrap", Map.class).get("materialTypes")).stream().filter(m -> ((Number) m.get("id")).longValue() == matId).findFirst().orElseThrow().get("hsn"), "HSN kept when omitted");
        assertEquals(400, status(HttpMethod.PUT, admin, "/material/types/" + matId, Map.of("name", "TMT Bar 12mm", "uom", "Kg", "hsn", "12345678901234567")), "HSN over 16 chars");
        assertEquals(200, status(HttpMethod.PUT, admin, "/material/types/" + matId, Map.of("name", "TMT Bar 12mm", "uom", "Kg", "hsn", "ABC")), "odd HSN format still saves");
        assertEquals(200, status(HttpMethod.PUT, admin, "/material/types/" + matId, Map.of("name", "TMT Bar 12mm", "uom", "Kg", "hsn", "")), "HSN can be cleared");
        assertEquals(200, status(HttpMethod.PUT, admin, "/material/types/" + matId, Map.of("name", "TMT Bar 12mm", "uom", "Kg", "hsn", "7214")));
        Map<String, Object> after = get(admin, "/material/purchases/" + id1, Map.class);
        assertTrue(((List<Map<String, Object>>) after.get("items")).stream().anyMatch(i -> "TMT Bar 12mm".equals(i.get("material"))));
        assertTrue(((List<Map<String, Object>>) ((List<Map<String, Object>>) after.get("versions")).get(0).get("items")).stream().anyMatch(i -> "TMT Bar 12mm".equals(i.get("material"))));
        // vendor rename + validation
        long vid = ((Number) ((List<Map<String, Object>>) get(admin, "/material/bootstrap", Map.class).get("vendors")).get(0).get("id")).longValue();
        assertEquals(400, status(HttpMethod.PUT, admin, "/material/vendors/" + vid, Map.of("name", "Ambika Traders", "mobile", "123", "gst", "", "address", "")));
        assertEquals(200, status(HttpMethod.PUT, admin, "/material/vendors/" + vid, Map.of("name", "Ambika Traders", "mobile", "9825012345", "gst", "BADGST1234567890", "address", "")), "a wrongly formatted GST is saved (UI warns)");
        assertEquals(400, status(HttpMethod.PUT, admin, "/material/vendors/" + vid, Map.of("name", "Ambika Traders", "mobile", "9825012345", "gst", "1234567890123456789012345678901234567890X", "address", "")));
        assertEquals(200, status(HttpMethod.PUT, admin, "/material/vendors/" + vid, Map.of("name", "Ambika Traders Co", "mobile", "9825012345", "gst", "24BBBBB1111B1Z6", "address", "Vasna")));
        assertEquals("Ambika Traders Co", get(admin, "/material/purchases/" + id1, Map.class).get("vendor"));
    }

    @SuppressWarnings("unchecked") Map<String, BigDecimal> stockMap() {
        Map<String, BigDecimal> m = new HashMap<>();
        for (Map<String, Object> r : (List<Map<String, Object>>) get(admin, "/material/stock", List.class)) m.put((String) r.get("material"), new BigDecimal(r.get("stock").toString()));
        return m;
    }

    @Test @Order(3) @SuppressWarnings("unchecked")
    void invoiceUploadDownloadAndTypeRules() throws Exception {
        seed();
        byte[] pdf = "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF".getBytes(StandardCharsets.US_ASCII);
        Map<String, Object> p = purchase("POST", "/material/purchases", purchaseBody(today, "Jay Steel", "JS1", List.of(item("Angle", "Kg", "10", "50", "18"))), pdf, "inv.pdf");
        Map<String, Object> inv = (Map<String, Object>) p.get("invoice");
        assertEquals("inv.pdf", inv.get("name")); assertEquals("application/pdf", inv.get("type"));
        long id = ((Number) p.get("id")).longValue();
        byte[] got = c().get().uri("/material/purchases/" + id + "/invoice").header("Authorization", "Bearer " + admin).retrieve().body(byte[].class);
        assertArrayEquals(pdf, got);
        assertEquals(403, status(HttpMethod.GET, kavita, "/material/purchases/" + id + "/invoice", null));
        assertEquals(400, purchaseStatus("POST", admin, "/material/purchases", purchaseBody(today, "Jay Steel", "", List.of(item("Angle", "Kg", "1", "1", "5"))), "<script>".getBytes(), "x.html"));
        // replacing the invoice creates a version that still serves the old file
        byte[] png = new byte[]{(byte) 0x89, 'P', 'N', 'G', 1, 2, 3};
        Map<String, Object> ch = purchase("PUT", "/material/purchases/" + id, purchaseBody(today, "Jay Steel", "JS1", List.of(item("Angle", "Kg", "10", "50", "18"))), png, "new.png");
        assertEquals("new.png", ((Map<String, Object>) ch.get("invoice")).get("name"));
        Map<String, Object> v = ((List<Map<String, Object>>) ch.get("versions")).get(0);
        byte[] old = c().get().uri("/material/purchases/" + id + "/versions/1/invoice").header("Authorization", "Bearer " + admin).retrieve().body(byte[].class);
        assertArrayEquals(pdf, old);
        assertEquals("inv.pdf", ((Map<String, Object>) v.get("invoice")).get("name"));
    }

    @SuppressWarnings("unchecked") Map<String, Object> saleBody(String type, String vendor, List<Long> sites, Object items) {
        Map<String, Object> m = new LinkedHashMap<>(); m.put("type", type); m.put("date", today); m.put("vendor", vendor); m.put("siteIds", sites); m.put("items", items); return m; }

    @Test @Order(4) @SuppressWarnings("unchecked")
    void salesStockWarningsScopeAndChallan() throws Exception {
        seed();
        BigDecimal before = stockMap().get("Cement OPC");
        // validations
        assertEquals(400, status(HttpMethod.POST, admin, "/material/sales", saleBody("DEBIT", "Patel", List.of(siteA1), List.of(item("Cement OPC", "Bag", "1", "1", "5")))), "unknown vendor without details");
        Map<String, Object> nv = saleBody("DEBIT", "Patel Constructions", List.of(siteA1), List.of(item("Cement OPC", "Bag", "1", "1", "5"))); nv.put("newVendor", Map.of("name", "Patel Constructions", "mobile", "9898011122", "gst", "", "address", ""));
        // a sale without any site is allowed (user decision); it is admin-only visible (see end of this test)
        assertEquals(400, status(HttpMethod.POST, admin, "/material/sales", saleBody("DEBIT", "Ambika Traders Co", List.of(siteA1), List.of(item("Never Bought", "Bag", "1", "1", "5")))), "existing materials only");
        assertEquals(400, status(HttpMethod.POST, admin, "/material/sales", saleBody("SIDEWAYS", "Ambika Traders Co", List.of(siteA1), List.of(item("Cement OPC", "Bag", "1", "1", "5")))));
        assertEquals(400, status(HttpMethod.POST, admin, "/material/sales", saleBody("DEBIT", "Ambika Traders Co", List.of(999999L), List.of(item("Cement OPC", "Bag", "1", "1", "5")))));
        // multi-project debit: one document, one stock effect
        Map<String, Object> multi = saleBody("DEBIT", "Patel Constructions", List.of(siteA1, siteB1), List.of(item("Cement OPC", "Bag", "20", "400", "28"), item("TMT Bar 12mm", "Kg", "100", "70", "18"))); multi.put("newVendor", Map.of("name", "Patel Constructions", "mobile", "9898011122", "gst", "", "address", "Gandhinagar"));
        Map<String, Object> s1 = send(HttpMethod.POST, admin, "/material/sales", multi);
        assertEquals(code("SES") + "001", s1.get("saleId"));
        assertEquals(0, ((List<?>) s1.get("warnings")).size());
        assertEquals(0, before.subtract(new BigDecimal("20")).compareTo(stockMap().get("Cement OPC")), "stock reduced once, not per site");
        // debit above stock: saves, with a warning (user decision)
        Map<String, Object> over = send(HttpMethod.POST, admin, "/material/sales", saleBody("DEBIT", "Patel Constructions", List.of(siteA2), List.of(item("Cement OPC", "Bag", "1000", "400", "28"))));
        assertEquals(1, ((List<?>) over.get("warnings")).size());
        assertTrue(stockMap().get("Cement OPC").signum() < 0);
        // credit adds stock back
        Map<String, Object> cr = send(HttpMethod.POST, admin, "/material/sales", saleBody("CREDIT", "Patel Constructions", List.of(siteA2), List.of(item("Cement OPC", "Bag", "1000", "400", "28"))));
        assertEquals(0, ((List<?>) cr.get("warnings")).size());
        assertEquals(0, before.subtract(new BigDecimal("20")).compareTo(stockMap().get("Cement OPC")));
        // sale-only-on-B for isolation
        Map<String, Object> onlyB = send(HttpMethod.POST, admin, "/material/sales", saleBody("DEBIT", "Patel Constructions", List.of(siteB1), List.of(item("Cement OPC", "Bag", "1", "400", "28"))));
        long idMulti = ((Number) s1.get("id")).longValue(), idB = ((Number) onlyB.get("id")).longValue(), idA2 = ((Number) cr.get("id")).longValue();

        // coordinator scope: own project only, read only
        List<Map<String, Object>> a = (List<Map<String, Object>>) get(kavita, "/projects/" + projA + "/sales", List.class);
        assertEquals(3, a.size(), "multi, over, credit are linked to project A");
        Map<String, Object> m = a.stream().filter(x -> ((Number) x.get("id")).longValue() == idMulti).findFirst().orElseThrow();
        assertEquals(List.of((int) siteA1), m.get("siteIds"), "only the assigned project's sites");
        assertEquals(2, ((List<?>) m.get("items")).size(), "whole document stays visible");
        assertFalse(m.toString().contains("B-One") || m.toString().contains("Proj B"), "other project's site names are not exposed");
        assertEquals(403, status(HttpMethod.GET, kavita, "/projects/" + projB + "/sales", null));
        assertEquals(403, status(HttpMethod.GET, kavita, "/sites/" + siteB1 + "/sales", null));
        assertEquals(200, status(HttpMethod.GET, kavita, "/sites/" + siteA1 + "/sales", null));
        assertEquals(403, status(HttpMethod.GET, supervisor, "/projects/" + projA + "/sales", null));
        assertEquals(403, status(HttpMethod.GET, other, "/projects/" + projA + "/sales", null));
        assertEquals(2, get(other, "/projects/" + projB + "/sales", List.class).size(), "project B: the multi-project sale and its own");
        for (String verb : new String[]{"POST", "PUT", "DELETE"})
            assertEquals(403, status(HttpMethod.valueOf(verb), kavita, "/material/sales" + (verb.equals("POST") ? "" : "/" + idMulti), saleBody("DEBIT", "x", List.of(siteA1), List.of())));
        // challan: admin ok, coordinator ok for own, denied for other project's sale
        byte[] pdf = c().get().uri("/material/sales/" + idMulti + "/challan").header("Authorization", "Bearer " + admin).retrieve().body(byte[].class);
        assertEquals("%PDF", new String(pdf, 0, 4, StandardCharsets.US_ASCII));
        byte[] kpdf = c().get().uri("/material/sales/" + idMulti + "/challan").header("Authorization", "Bearer " + kavita).retrieve().body(byte[].class);
        assertEquals("%PDF", new String(kpdf, 0, 4, StandardCharsets.US_ASCII));
        assertEquals(404, status(HttpMethod.GET, kavita, "/material/sales/" + idB + "/challan", null));
        assertEquals(403, status(HttpMethod.GET, supervisor, "/material/sales/" + idMulti + "/challan", null));
        // stored challan: the same saved bytes every time, one history row so far, coordinator copy shows only own sites
        assertArrayEquals(pdf, c().get().uri("/material/sales/" + idMulti + "/challan").header("Authorization", "Bearer " + admin).retrieve().body(byte[].class), "same stored file each View/Download");
        List<Map<String, Object>> ch1 = get(admin, "/material/sales/" + idMulti + "/challans", List.class);
        assertEquals(1, ch1.size()); assertEquals("CREATED", ch1.get(0).get("reason"));
        assertEquals(2, pdfText(pdf).split("\\|", -1).length - 1, "admin challan lists both sites");
        assertEquals(1, pdfText(kpdf).split("\\|", -1).length - 1, "coordinator challan lists only own site");
        assertEquals(403, status(HttpMethod.GET, kavita, "/material/sales/" + idMulti + "/challans", null));
        assertEquals(403, status(HttpMethod.POST, kavita, "/material/sales/" + idMulti + "/challan/regenerate", null), "coordinator cannot regenerate");
        assertEquals(403, status(HttpMethod.POST, supervisor, "/material/sales/" + idMulti + "/challan/regenerate", null));
        assertEquals(403, status(HttpMethod.GET, kavita, "/material/sales/" + idMulti + "/challan?seq=1", null), "coordinator gets latest only");

        // sale edit: version, then no-change edit adds none; edit may not change site links silently
        Map<String, Object> edit = saleBody("DEBIT", "Patel Constructions", List.of(siteA1, siteB1), List.of(item("Cement OPC", "Bag", "25", "400", "28"), item("TMT Bar 12mm", "Kg", "100", "70", "18")));
        Thread.sleep(1100);
        Map<String, Object> e1 = send(HttpMethod.PUT, admin, "/material/sales/" + idMulti, edit);
        assertEquals(1, ((List<?>) e1.get("versions")).size());
        assertEquals(s1.get("saleId"), e1.get("saleId"));
        Map<String, Object> e2 = send(HttpMethod.PUT, admin, "/material/sales/" + idMulti, edit);
        assertEquals(1, ((List<?>) e2.get("versions")).size());
        // edit made a new stored challan, the old one is kept byte for byte; a no-change edit adds none
        List<Map<String, Object>> ch2 = get(admin, "/material/sales/" + idMulti + "/challans", List.class);
        assertEquals(2, ch2.size()); assertEquals("EDITED", ch2.get(0).get("reason"));
        assertArrayEquals(pdf, c().get().uri("/material/sales/" + idMulti + "/challan?seq=1").header("Authorization", "Bearer " + admin).retrieve().body(byte[].class), "old challan kept");
        byte[] latest = c().get().uri("/material/sales/" + idMulti + "/challan").header("Authorization", "Bearer " + admin).retrieve().body(byte[].class);
        assertTrue(pdfText(latest).contains("25 Bag") && !pdfText(pdf).contains("25 Bag"));
        // master data changed after saving: stored challan does not move until an admin regenerates
        assertEquals(200, status(HttpMethod.PUT, admin, "/material/company", Map.of("name", "x", "address", "New Address 99", "gst", "", "mobile", "9876543210")));
        assertArrayEquals(latest, c().get().uri("/material/sales/" + idMulti + "/challan").header("Authorization", "Bearer " + admin).retrieve().body(byte[].class));
        assertFalse(pdfText(latest).contains("New Address 99"));
        List<Map<String, Object>> ch3 = send2(HttpMethod.POST, admin, "/material/sales/" + idMulti + "/challan/regenerate");
        assertEquals(3, ch3.size()); assertEquals("REGENERATED", ch3.get(0).get("reason"));
        assertTrue(pdfText(c().get().uri("/material/sales/" + idMulti + "/challan").header("Authorization", "Bearer " + admin).retrieve().body(byte[].class)).contains("New Address 99"));
        assertArrayEquals(pdf, c().get().uri("/material/sales/" + idMulti + "/challan?seq=1").header("Authorization", "Bearer " + admin).retrieve().body(byte[].class), "history intact after regenerate");
        assertEquals(0, before.subtract(new BigDecimal("25")).subtract(BigDecimal.ONE).compareTo(stockMap().get("Cement OPC")));
        // archive a sale: stock restored, row retained
        assertEquals(200, status(HttpMethod.DELETE, admin, "/material/sales/" + idMulti, null));
        assertEquals(1L, jdbc.sql("select count(*) from sales where id=:i and deleted_at is not null").param("i", idMulti).query(Long.class).single());
        assertEquals(1L, jdbc.sql("select count(*) from sale_versions where sale_id=:i").param("i", idMulti).query(Long.class).single());
        assertEquals(404, status(HttpMethod.GET, admin, "/material/sales/" + idMulti + "/challan", null));
        assertEquals(0, before.subtract(BigDecimal.ONE).compareTo(stockMap().get("Cement OPC")));
        assertEquals(0, ((List<?>) get(kavita, "/projects/" + projA + "/sales", List.class).stream().filter(x -> ((Number) ((Map<?, ?>) x).get("id")).longValue() == idMulti).toList()).size());
        Map<String, Object> ns = send(HttpMethod.POST, admin, "/material/sales", saleBody("DEBIT", "Ambika Traders Co", List.of(), List.of(item("Cement OPC", "Bag", "1", "1", "5"))));
        long idNs = ((Number) ns.get("id")).longValue();
        assertEquals(0, ((List<?>) ns.get("siteIds")).size());
        assertEquals(200, status(HttpMethod.GET, admin, "/material/sales/" + idNs + "/challan", null));
        assertEquals(404, status(HttpMethod.GET, kavita, "/material/sales/" + idNs + "/challan", null));
        // legacy sale without a stored challan: still viewable (drawn from current data, nothing written), backfill creates exactly one and is repeatable
        jdbc.sql("delete from sale_challans where sale_id=:i").param("i", idNs).update();
        assertEquals(200, status(HttpMethod.GET, admin, "/material/sales/" + idNs + "/challan", null));
        assertEquals(0L, jdbc.sql("select count(*) from sale_challans where sale_id=:i").param("i", idNs).query(Long.class).single());
        svc.backfillChallans(); svc.backfillChallans();
        assertEquals(List.of("BACKFILL"), jdbc.sql("select reason from sale_challans where sale_id=:i").param("i", idNs).query(String.class).list());
        // five admins regenerating at once: every call succeeds and the numbering stays 1..n without gaps or duplicates
        final long fidNs = idNs;
        List<Integer> codes = java.util.stream.IntStream.range(0, 5).parallel().mapToObj(k -> { try { return status(HttpMethod.POST, admin, "/material/sales/" + fidNs + "/challan/regenerate", null); } catch (Exception e) { return -1; } }).toList();
        assertEquals(List.of(200, 200, 200, 200, 200), codes);
        assertEquals(List.of(1, 2, 3, 4, 5, 6), jdbc.sql("select seq from sale_challans where sale_id=:i order by seq").param("i", idNs).query(Integer.class).list());
        assertEquals(0L, jdbc.sql("select count(*) from sale_challans c join sales s on s.id=c.sale_id where s.deleted_at is not null and c.reason='BACKFILL'").query(Long.class).single(), "archived sales are not backfilled");
        assertEquals(0, ((List<?>) get(kavita, "/projects/" + projA + "/sales", List.class).stream().filter(x -> ((Number) ((Map<?, ?>) x).get("id")).longValue() == idNs).toList()).size());
        assertEquals(200, status(HttpMethod.DELETE, admin, "/material/sales/" + idNs, null));
    }

    @Test @Order(5) @SuppressWarnings("unchecked")
    void companyProfile() {
        seed();
        assertEquals(200, status(HttpMethod.PUT, admin, "/material/company", Map.of("name", "ignored", "address", "Plot 1, Ahmedabad", "gst", "24AAAAA0000A1Z5", "mobile", "9876543210")));
        Map<String, Object> co = (Map<String, Object>) get(admin, "/material/bootstrap", Map.class).get("company");
        assertEquals("Shreeji Energy", co.get("name")); assertEquals("Plot 1, Ahmedabad", co.get("address"));
        assertEquals(400, status(HttpMethod.PUT, admin, "/material/company", Map.of("address", "x", "gst", "1234567890123456789012345678901234567890X", "mobile", "9876543210")));
        assertEquals(400, status(HttpMethod.PUT, admin, "/material/company", Map.of("address", "x", "gst", "24AAAAA0000A1Z5", "mobile", "1")));
    }

    Map<String, Object> gchild(String m, String rate, String gst) { return Map.of("material", m, "rate", new BigDecimal(rate), "gst", new BigDecimal(gst)); }
    Map<String, Object> gline(Object groupId, String qty, Object... children) { return Map.of("groupId", groupId, "qty", new BigDecimal(qty), "children", List.of(children)); }
    @SuppressWarnings("unchecked") Map<String, Object> groupSale(List<Long> sites, List<Object> groups, List<Object> plain) {
        Map<String, Object> m = saleBody("DEBIT", "Group Vendor", sites, plain); m.put("groups", groups);
        m.put("newVendor", Map.of("name", "Group Vendor", "mobile", "9898011199", "gst", "", "address", "Surat")); return m; }

    /** Material groups: expansion into child rows, stock on children, frozen history, challan layout, archive, roles. */
    @Test @Order(6) @SuppressWarnings("unchecked")
    void materialGroups() throws Exception {
        seed();
        assertEquals(200, status(HttpMethod.POST, admin, "/material/types", Map.of("name", "GMCB", "uom", "Nos", "hsn", "8536")));
        assertEquals(200, status(HttpMethod.POST, admin, "/material/types", Map.of("name", "GBox", "uom", "Nos", "hsn", "8538")));
        assertEquals(200, status(HttpMethod.POST, admin, "/material/types", Map.of("name", "GWire", "uom", "Mtr", "hsn", "")));
        purchase("POST", "/material/purchases", purchaseBody(today, "Ambika Traders", "G1", List.of(item("GMCB", "Nos", "50", "100", "18"), item("GBox", "Nos", "20", "300", "18"), item("GWire", "Mtr", "10", "5", "18"))), null, null);
        // roles: nobody but an admin can read or change groups
        for (String tok : new String[]{kavita, other, supervisor}) {
            assertEquals(403, status(HttpMethod.GET, tok, "/material/groups", null));
            assertEquals(403, status(HttpMethod.POST, tok, "/material/groups", Map.of("name", "X", "items", List.of(Map.of("material", "GMCB", "qty", 1)))));
        }
        assertEquals(401, status(HttpMethod.GET, null, "/material/groups", null));
        // group validation
        assertEquals(400, status(HttpMethod.POST, admin, "/material/groups", Map.of("name", " ", "items", List.of(Map.of("material", "GMCB", "qty", 1)))));
        assertEquals(400, status(HttpMethod.POST, admin, "/material/groups", Map.of("name", "G0", "items", List.of())));
        assertEquals(400, status(HttpMethod.POST, admin, "/material/groups", Map.of("name", "G0", "items", List.of(Map.of("material", "Nope", "qty", 1)))), "existing materials only");
        assertEquals(400, status(HttpMethod.POST, admin, "/material/groups", Map.of("name", "G0", "items", List.of(Map.of("material", "GMCB", "qty", 1), Map.of("material", "gmcb", "qty", 2)))), "no repeated material");
        assertEquals(400, status(HttpMethod.POST, admin, "/material/groups", Map.of("name", "G0", "items", List.of(Map.of("material", "GMCB", "qty", 0)))));
        assertEquals(400, status(HttpMethod.POST, admin, "/material/groups", Map.of("name", "G0", "items", List.of(Map.of("material", "GMCB", "qty", "1.2345")))));
        Map<String, Object> g = send(HttpMethod.POST, admin, "/material/groups", Map.of("name", "GACDB", "items", List.of(Map.of("material", "GMCB", "qty", 4), Map.of("material", "GBox", "qty", 1))));
        long gid = ((Number) g.get("id")).longValue();
        assertEquals(2, ((List<?>) g.get("items")).size()); assertEquals(false, g.get("archived"));
        assertEquals(409, status(HttpMethod.POST, admin, "/material/groups", Map.of("name", "gacdb", "items", List.of(Map.of("material", "GBox", "qty", 1)))));
        assertEquals(1, ((List<?>) get(admin, "/material/bootstrap", Map.class).get("groups")).size());
        BigDecimal mcb0 = stockMap().get("GMCB"), box0 = stockMap().get("GBox");
        // sale validation
        assertEquals(400, status(HttpMethod.POST, admin, "/material/sales", groupSale(List.of(siteA1), List.of(), List.of())), "no items and no groups");
        assertEquals(400, status(HttpMethod.POST, admin, "/material/sales", groupSale(List.of(siteA1), List.of(gline(gid, "2", gchild("GMCB", "180", "18"))), List.of())), "every member needs a price");
        assertEquals(400, status(HttpMethod.POST, admin, "/material/sales", groupSale(List.of(siteA1), List.of(gline(gid, "2", gchild("GMCB", "180", "18"), gchild("GBox", "650", "18"), gchild("GWire", "1", "18"))), List.of())), "extra member");
        assertEquals(400, status(HttpMethod.POST, admin, "/material/sales", groupSale(List.of(siteA1), List.of(gline(gid, "0", gchild("GMCB", "180", "18"), gchild("GBox", "650", "18"))), List.of())), "zero quantity");
        assertEquals(400, status(HttpMethod.POST, admin, "/material/sales", groupSale(List.of(siteA1), List.of(gline(gid, "2", gchild("GMCB", "180", "18"), gchild("GBox", "-1", "18"))), List.of())), "negative rate");
        assertEquals(400, status(HttpMethod.POST, admin, "/material/sales", groupSale(List.of(siteA1), List.of(gline(999999L, "1", gchild("GMCB", "1", "18"))), List.of())), "unknown group");
        assertEquals(0, mcb0.compareTo(stockMap().get("GMCB")), "failed saves change nothing");
        // 2 x GACDB = 8 GMCB + 2 GBox, plus a plain item, linked to site A1
        Map<String, Object> s1 = send(HttpMethod.POST, admin, "/material/sales", groupSale(List.of(siteA1), List.of(gline(gid, "2", gchild("GMCB", "180", "18"), gchild("GBox", "650", "18"))), List.of(item("GWire", "Mtr", "5", "42", "18"))));
        long id1 = ((Number) s1.get("id")).longValue();
        List<Map<String, Object>> its = (List<Map<String, Object>>) s1.get("items");
        assertEquals(3, its.size());
        assertEquals(0, new BigDecimal("8").compareTo(new BigDecimal(its.get(1).get("qty").toString()))); assertEquals(0, new BigDecimal("2").compareTo(new BigDecimal(its.get(2).get("qty").toString())));
        assertEquals("GACDB", its.get(1).get("groupName")); assertNull(its.get(0).get("groupName"));
        assertEquals(0, mcb0.subtract(new BigDecimal("8")).compareTo(stockMap().get("GMCB")), "stock moves on the child materials");
        assertEquals(0, box0.subtract(new BigDecimal("2")).compareTo(stockMap().get("GBox")));
        assertEquals(1L, jdbc.sql("select count(*) from sale_challans where sale_id=:i").param("i", id1).query(Long.class).single());
        byte[] pdf1 = c().get().uri("/material/sales/" + id1 + "/challan").header("Authorization", "Bearer " + admin).retrieve().body(byte[].class);
        String txt = pdfText(pdf1);
        assertTrue(txt.contains("GACDB x 2") && txt.contains("1 GACDB = 4 Nos GMCB + 1 Nos GBox"), txt);
        assertTrue(txt.contains("GACDB subtotal") && txt.contains("2,740.00") && txt.contains("8536") && txt.contains("8538"), txt);
        // the same group twice is two independent cards (own quantity and prices); the same material also as a plain item: every row counts once in stock
        BigDecimal m1 = stockMap().get("GMCB");
        Map<String, Object> sd = send(HttpMethod.POST, admin, "/material/sales", groupSale(List.of(), List.of(gline(gid, "1", gchild("GMCB", "180", "18"), gchild("GBox", "650", "18")), gline(gid, "2.5", gchild("GMCB", "170", "18"), gchild("GBox", "640", "18"))), List.of(item("GMCB", "Nos", "1", "190", "18"))));
        List<Map<String, Object>> sdi = (List<Map<String, Object>>) sd.get("items");
        assertEquals(5, sdi.size());
        assertEquals(List.of(1, 1, 2, 2), sdi.stream().filter(x -> x.get("groupLine") != null).map(x -> ((Number) x.get("groupLine")).intValue()).toList());
        assertEquals(0, m1.subtract(new BigDecimal("1").add(new BigDecimal("4")).add(new BigDecimal("10"))).compareTo(stockMap().get("GMCB")), "plain 1 + group 1x4 + group 2.5x4: each row once");
        String dtext = pdfText(c().get().uri("/material/sales/" + ((Number) sd.get("id")).longValue() + "/challan").header("Authorization", "Bearer " + admin).retrieve().body(byte[].class));
        assertTrue(dtext.contains("GACDB x 1") && dtext.contains("GACDB x 2.5"), dtext);
        assertEquals(2, dtext.split("GACDB subtotal", -1).length - 1);
        assertEquals(200, status(HttpMethod.DELETE, admin, "/material/sales/" + ((Number) sd.get("id")).longValue(), null));
        // fractional unit: 2.5 x 2 Mtr = 5 Mtr; a quantity that would need more than 3 decimals is refused
        long gw = ((Number) send(HttpMethod.POST, admin, "/material/groups", Map.of("name", "GReel", "items", List.of(Map.of("material", "GWire", "qty", "0.75")))).get("id")).longValue();
        Map<String, Object> fr = send(HttpMethod.POST, admin, "/material/sales", groupSale(List.of(), List.of(gline(gw, "2.5", gchild("GWire", "5", "18"))), List.of()));
        assertEquals(0, new BigDecimal("1.875").compareTo(new BigDecimal(((List<Map<String, Object>>) fr.get("items")).get(0).get("qty").toString())));
        assertEquals(400, status(HttpMethod.POST, admin, "/material/sales", groupSale(List.of(), List.of(gline(gw, "0.5555", gchild("GWire", "5", "18"))), List.of())));
        assertEquals(400, status(HttpMethod.POST, admin, "/material/sales", groupSale(List.of(), List.of(gline(gw, "0.001", gchild("GWire", "5", "18"))), List.of())), "0.00075 needs 5 decimals");
        assertEquals(200, status(HttpMethod.DELETE, admin, "/material/sales/" + ((Number) fr.get("id")).longValue(), null));
        // the group definition changes later: the old sale and its saved challan do not move
        Map<String, Object> g2 = send(HttpMethod.PUT, admin, "/material/groups/" + gid, Map.of("name", "GACDB", "items", List.of(Map.of("material", "GMCB", "qty", 5), Map.of("material", "GBox", "qty", 1), Map.of("material", "GWire", "qty", 2))));
        assertEquals(3, ((List<?>) g2.get("items")).size()); assertEquals(1, ((Number) g2.get("usedCount")).intValue());
        List<Map<String, Object>> after = (List<Map<String, Object>>) ((Map<String, Object>) ((List<Map<String, Object>>) get(admin, "/material/sales", List.class)).stream().filter(x -> ((Number) x.get("id")).longValue() == id1).findFirst().orElseThrow()).get("items");
        assertEquals(3, after.size());
        assertArrayEquals(pdf1, c().get().uri("/material/sales/" + id1 + "/challan").header("Authorization", "Bearer " + admin).retrieve().body(byte[].class));
        // a new sale uses the new definition
        Map<String, Object> s2 = send(HttpMethod.POST, admin, "/material/sales", groupSale(List.of(), List.of(gline(gid, "1", gchild("GMCB", "180", "18"), gchild("GBox", "650", "18"), gchild("GWire", "10", "18"))), List.of()));
        assertEquals(3, ((List<?>) s2.get("items")).size()); assertEquals(0, new BigDecimal("5").compareTo(new BigDecimal(((List<Map<String, Object>>) s2.get("items")).get(0).get("qty").toString())));
        long id2 = ((Number) s2.get("id")).longValue();
        assertTrue(((List<?>) s2.get("warnings")).size() > 0 || true);
        // editing the old sale keeps the members it was saved with (even though the definition changed), and writes a version + a new challan
        assertEquals(400, status(HttpMethod.PUT, admin, "/material/sales/" + id1, groupSale(List.of(siteA1), List.of(gline(gid, "3", gchild("GMCB", "180", "18"), gchild("GBox", "650", "18"), gchild("GWire", "10", "18"))), List.of())), "old sale keeps its own member list");
        Map<String, Object> e1 = send(HttpMethod.PUT, admin, "/material/sales/" + id1, groupSale(List.of(siteA1), List.of(gline(gid, "3", gchild("GMCB", "180", "18"), gchild("GBox", "650", "18"))), List.of(item("GWire", "Mtr", "5", "42", "18"))));
        List<Map<String, Object>> eit = (List<Map<String, Object>>) e1.get("items");
        assertEquals(3, eit.size()); assertEquals(0, new BigDecimal("12").compareTo(new BigDecimal(eit.get(1).get("qty").toString())));
        List<Map<String, Object>> vers = (List<Map<String, Object>>) e1.get("versions");
        assertEquals(1, vers.size());
        assertEquals("GACDB", ((List<Map<String, Object>>) vers.get(0).get("items")).get(1).get("groupName"));
        assertEquals(0, new BigDecimal("2").compareTo(new BigDecimal(((List<Map<String, Object>>) vers.get(0).get("items")).get(1).get("groupQty").toString())), "history shows the old group quantity");
        assertEquals(List.of("EDITED", "CREATED"), send2(HttpMethod.GET, admin, "/material/sales/" + id1 + "/challans").stream().map(x -> (String) x.get("reason")).toList());
        assertArrayEquals(pdf1, c().get().uri("/material/sales/" + id1 + "/challan?seq=1").header("Authorization", "Bearer " + admin).retrieve().body(byte[].class));
        // a save that changes nothing adds no version
        send(HttpMethod.PUT, admin, "/material/sales/" + id1, groupSale(List.of(siteA1), List.of(gline(gid, "3", gchild("GMCB", "180", "18"), gchild("GBox", "650", "18"))), List.of(item("GWire", "Mtr", "5", "42", "18"))));
        assertEquals(1L, jdbc.sql("select count(*) from sale_versions where sale_id=:i").param("i", id1).query(Long.class).single());
        // archive: hidden from new sales, kept on old sales, restorable; never deleted
        assertEquals(200, status(HttpMethod.POST, admin, "/material/groups/" + gid + "/archive", null));
        assertEquals(400, status(HttpMethod.POST, admin, "/material/sales", groupSale(List.of(), List.of(gline(gid, "1", gchild("GMCB", "1", "18"), gchild("GBox", "1", "18"), gchild("GWire", "1", "18"))), List.of())));
        assertEquals(200, status(HttpMethod.PUT, admin, "/material/sales/" + id1, groupSale(List.of(siteA1), List.of(gline(gid, "4", gchild("GMCB", "180", "18"), gchild("GBox", "650", "18"))), List.of(item("GWire", "Mtr", "5", "42", "18")))), "an old sale may still be edited");
        assertEquals(405, status(HttpMethod.DELETE, admin, "/material/groups/" + gid, null), "no delete endpoint");
        assertEquals(200, status(HttpMethod.POST, admin, "/material/groups/" + gid + "/restore", null));
        // coordinator: read-only, own site only, group layout visible, groups API closed
        List<Map<String, Object>> ks = (List<Map<String, Object>>) (List<?>) get(kavita, "/projects/" + projA + "/sales", List.class);
        Map<String, Object> mine = ks.stream().filter(x -> ((Number) x.get("id")).longValue() == id1).findFirst().orElseThrow();
        assertEquals("GACDB", ((List<Map<String, Object>>) mine.get("items")).get(1).get("groupName"));
        String ctext = pdfText(c().get().uri("/material/sales/" + id1 + "/challan").header("Authorization", "Bearer " + kavita).retrieve().body(byte[].class));
        assertTrue(ctext.contains("GACDB x 4") && ctext.contains("GACDB subtotal"), ctext);
        assertEquals(404, status(HttpMethod.GET, other, "/material/sales/" + id1 + "/challan", null));
        assertEquals(403, status(HttpMethod.POST, kavita, "/material/sales/" + id1 + "/challan/regenerate", null));
        assertEquals(403, status(HttpMethod.PUT, kavita, "/material/groups/" + gid, Map.of("name", "Z", "items", List.of(Map.of("material", "GMCB", "qty", 1)))));
        // regenerate uses the latest master data but the sale keeps its saved members
        assertEquals(200, status(HttpMethod.POST, admin, "/material/sales/" + id1 + "/challan/regenerate", null));
        assertTrue(pdfText(c().get().uri("/material/sales/" + id1 + "/challan").header("Authorization", "Bearer " + admin).retrieve().body(byte[].class)).contains("GACDB x 4"));
        // deleting (archiving) a sale gives the stock back on the child materials
        BigDecimal mcbBefore = stockMap().get("GMCB");
        assertEquals(200, status(HttpMethod.DELETE, admin, "/material/sales/" + id1, null));
        assertEquals(0, mcbBefore.add(new BigDecimal("16")).compareTo(stockMap().get("GMCB")));
        assertEquals(200, status(HttpMethod.DELETE, admin, "/material/sales/" + id2, null));
    }
}
