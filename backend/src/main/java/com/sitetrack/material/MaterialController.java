package com.sitetrack.material;

import tools.jackson.databind.ObjectMapper;
import com.sitetrack.api.ApiException;
import com.sitetrack.material.MaterialDtos.*;
import com.sitetrack.security.AppPrincipal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.*;

@RestController
@RequestMapping("/api")
public class MaterialController {
    private static final Set<String> INVOICE_TYPES = Set.of("application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif");
    private final MaterialService svc;
    private final JdbcClient jdbc;
    private final ObjectMapper json;
    private final Path uploadDir;

    public MaterialController(MaterialService svc, JdbcClient jdbc, ObjectMapper json, @Value("${app.upload-dir}") String uploadDir) {
        this.svc = svc; this.jdbc = jdbc; this.json = json; this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    // ----- admin: reference data -----
    @GetMapping("/material/bootstrap") @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> bootstrap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("materialTypes", svc.materialTypes()); m.put("vendors", svc.vendors()); m.put("company", svc.company());
        m.put("purchases", svc.purchases(null)); m.put("sales", svc.sales(null, null, false, null, null));
        m.put("stock", svc.stock()); m.put("sites", svc.allSites()); return m;
    }
    @PostMapping("/material/types") @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> addType(@RequestBody MaterialTypeIn in) { return svc.saveMaterialType(null, in); }
    @PutMapping("/material/types/{id}") @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> editType(@PathVariable long id, @RequestBody MaterialTypeIn in) { return svc.saveMaterialType(id, in); }
    @PostMapping("/material/vendors") @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> addVendor(@RequestBody VendorIn in) { return svc.saveVendor(null, in); }
    @PutMapping("/material/vendors/{id}") @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> editVendor(@PathVariable long id, @RequestBody VendorIn in) { return svc.saveVendor(id, in); }
    @PutMapping("/material/company") @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> editCompany(@RequestBody CompanyIn in) { return svc.saveCompany(in); }
    @GetMapping("/material/stock") @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String, Object>> stock() { return svc.stock(); }

    // ----- admin: purchases -----
    @GetMapping("/material/purchases") @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String, Object>> purchases() { return svc.purchases(null); }
    @GetMapping("/material/purchases/{id}") @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> purchase(@PathVariable long id) { return svc.purchase(id); }

    @PostMapping(value = "/material/purchases", consumes = MediaType.MULTIPART_FORM_DATA_VALUE) @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> createPurchase(@RequestParam("data") String data, @RequestPart(value = "invoice", required = false) MultipartFile file, @AuthenticationPrincipal AppPrincipal user) throws IOException {
        PurchaseIn in = json.readValue(data, PurchaseIn.class);
        MaterialService.StoredInvoice inv = store(file);
        try { return svc.createPurchase(in, inv, user); } catch (RuntimeException e) { discard(inv); throw e; }
    }
    @PutMapping(value = "/material/purchases/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE) @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> updatePurchase(@PathVariable long id, @RequestParam("data") String data, @RequestPart(value = "invoice", required = false) MultipartFile file, @AuthenticationPrincipal AppPrincipal user) throws IOException {
        PurchaseIn in = json.readValue(data, PurchaseIn.class);
        MaterialService.StoredInvoice inv = store(file);
        try { return svc.updatePurchase(id, in, inv, user); } catch (RuntimeException e) { discard(inv); throw e; }
    }
    @DeleteMapping("/material/purchases/{id}") @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> deletePurchase(@PathVariable long id, @AuthenticationPrincipal AppPrincipal user) { return Map.of("deleted", true, "warnings", svc.deletePurchase(id, user)); }
    @GetMapping("/material/purchases/{id}/invoice") @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<FileSystemResource> invoice(@PathVariable long id) { return file(svc.purchaseInvoice(id, 0)); }
    @GetMapping("/material/purchases/{id}/versions/{v}/invoice") @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<FileSystemResource> versionInvoice(@PathVariable long id, @PathVariable int v) { return file(svc.purchaseInvoice(id, v)); }

    // ----- admin: sales -----
    @GetMapping("/material/sales") @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String, Object>> sales() { return svc.sales(null, null, false, null, null); }
    @PostMapping("/material/sales") @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> createSale(@RequestBody SaleIn in, @AuthenticationPrincipal AppPrincipal user) { return svc.createSale(in, user); }
    @PutMapping("/material/sales/{id}") @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> updateSale(@PathVariable long id, @RequestBody SaleIn in, @AuthenticationPrincipal AppPrincipal user) { return svc.updateSale(id, in, user); }
    @DeleteMapping("/material/sales/{id}") @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> deleteSale(@PathVariable long id, @AuthenticationPrincipal AppPrincipal user) { return Map.of("deleted", true, "warnings", svc.deleteSale(id, user)); }

    // ----- read-only linked sales: admin, or the coordinator of the project -----
    @GetMapping("/projects/{projectId}/sales")
    public List<Map<String, Object>> projectSales(@PathVariable long projectId, @AuthenticationPrincipal AppPrincipal user) {
        requireCoordinator(user, "select count(*) from projects where id=:id and coordinator_id=:e", projectId);
        return svc.sales(null, user.employeeId(), !user.hasRole("ADMIN"), projectId, null);
    }
    @GetMapping("/sites/{siteId}/sales")
    public List<Map<String, Object>> siteSales(@PathVariable long siteId, @AuthenticationPrincipal AppPrincipal user) {
        requireCoordinator(user, "select count(*) from sites s join projects p on p.id=s.project_id where s.id=:id and p.coordinator_id=:e", siteId);
        return svc.sales(null, user.employeeId(), !user.hasRole("ADMIN"), null, siteId);
    }
    @GetMapping("/material/sales/{id}/challan")
    public ResponseEntity<byte[]> challan(@PathVariable long id, @RequestParam(value = "seq", required = false) Integer seq, @AuthenticationPrincipal AppPrincipal user) {
        if (!user.hasRole("ADMIN") && (user.employeeId() == null
                || jdbc.sql("select count(*) from projects where coordinator_id=:e").param("e", user.employeeId()).query(Long.class).single() == 0))
            throw new ApiException(403, "Not allowed");
        byte[] pdf = svc.challanPdf(id, user, seq);
        Map<String, Object> sale = svc.saleFull(id, user);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(sale.get("saleId") + ".pdf").build().toString()).body(pdf);
    }

    @GetMapping("/material/sales/{id}/challans") @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String, Object>> challans(@PathVariable long id) { svc.saleFull(id, null); return svc.challanHistory(id); }
    @PostMapping("/material/sales/{id}/challan/regenerate") @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String, Object>> regenerate(@PathVariable long id, @AuthenticationPrincipal AppPrincipal user) { return svc.regenerateChallan(id, user); }

    private void requireCoordinator(AppPrincipal user, String sql, long id) {
        if (user.hasRole("ADMIN")) return;
        boolean ok = user.employeeId() != null && jdbc.sql(sql).param("id", id).param("e", user.employeeId()).query(Long.class).single() > 0;
        if (!ok) throw new ApiException(403, "You can see sales only for your own projects");
    }

    private MaterialService.StoredInvoice store(MultipartFile f) throws IOException {
        if (f == null || f.isEmpty()) return null;
        String type = f.getContentType() == null ? "" : f.getContentType().toLowerCase();
        if (!INVOICE_TYPES.contains(type)) throw new ApiException(400, "Invoice must be a PDF or an image (PNG, JPG, WEBP, GIF)");
        String orig = Optional.ofNullable(f.getOriginalFilename()).orElse("invoice").replaceAll("[^A-Za-z0-9._ -]", "_");
        if (orig.length() > 120) orig = orig.substring(orig.length() - 120);
        Path dir = uploadDir.resolve("invoices"); Files.createDirectories(dir);
        Path target = dir.resolve(UUID.randomUUID() + "-" + orig).normalize();
        if (!target.startsWith(dir)) throw new ApiException(400, "Bad file name");
        Files.copy(f.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        return new MaterialService.StoredInvoice(orig, type, uploadDir.relativize(target).toString());
    }
    private void discard(MaterialService.StoredInvoice inv) { if (inv != null) try { Files.deleteIfExists(uploadDir.resolve(inv.path())); } catch (IOException ignored) {} }

    private ResponseEntity<FileSystemResource> file(Map<String, Object> inv) {
        Path p = uploadDir.resolve((String) inv.get("path")).normalize();
        if (!p.startsWith(uploadDir) || !Files.exists(p)) throw new ApiException(404, "File not found");
        return ResponseEntity.ok().contentType(MediaType.parseMediaType((String) inv.get("type")))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename((String) inv.get("name")).build().toString())
                .header("X-Content-Type-Options", "nosniff").body(new FileSystemResource(p));
    }
}
