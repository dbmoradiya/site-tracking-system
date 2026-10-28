package com.sitetrack.material;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import com.sitetrack.api.ApiException;
import com.sitetrack.material.MaterialDtos.*;
import com.sitetrack.security.AppPrincipal;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Material module data rules. Admin-only writes; coordinator reads are scoped by project coordinator id. */
@Service
public class MaterialService {
    static final Pattern GSTIN = Pattern.compile("^\\d{2}[A-Z]{5}\\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$");
    static final Set<String> UOMS_ANY = null; // units are free text from the UI list; only length is checked
    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public MaterialService(JdbcClient jdbc, ObjectMapper json) { this.jdbc = jdbc; this.json = json; }

    // ---------- helpers ----------
    static ApiException bad(String m) { return new ApiException(400, m); }
    static BigDecimal r2(BigDecimal v) { return v.setScale(2, RoundingMode.HALF_UP); }
    static String iso(Object t) {
        if (t == null) return null;
        java.time.Instant i = t instanceof Timestamp ts ? ts.toInstant() : ((OffsetDateTime) t).toInstant();
        return i.atZone(ZoneId.of("Asia/Kolkata")).toLocalDateTime().withNano(0).toString();
    }
    static String s(String v) { return v == null ? "" : v.trim(); }

    /** Same arithmetic as the UI: SGST is the rounded-down half of the GST amount, CGST the rest. */
    public static Map<String, BigDecimal> calc(Item l) {
        BigDecimal sub = r2(l.qty().multiply(l.rate()));
        BigDecimal gstAmt = r2(sub.multiply(l.gst()).divide(BigDecimal.valueOf(100)));
        BigDecimal sgst = gstAmt.multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(2), 0, RoundingMode.FLOOR).movePointLeft(2).setScale(2, RoundingMode.HALF_UP);
        BigDecimal cgst = r2(gstAmt.subtract(sgst));
        Map<String, BigDecimal> m = new LinkedHashMap<>();
        m.put("subtotal", sub); m.put("sgst", sgst); m.put("cgst", cgst); m.put("total", r2(sub.add(gstAmt)));
        return m;
    }

    private void validateItems(List<Item> items) {
        if (items == null || items.isEmpty()) throw bad("Add at least one item");
        validateEach(items);
    }

    private void validateEach(List<Item> items) {
        for (Item l : items) {
            if (l == null || s(l.material()).isEmpty()) throw bad("Material name is required");
            if (s(l.uom()).isEmpty() || l.uom().length() > 32) throw bad("Unit is required");
            if (l.qty() == null || l.qty().signum() <= 0 || l.qty().scale() > 3 && l.qty().stripTrailingZeros().scale() > 3) throw bad("Quantity must be greater than 0 (up to 3 decimals)");
            if (l.qty().compareTo(new BigDecimal("99999999999")) > 0) throw bad("Quantity is too large");
            if (l.rate() == null || l.rate().signum() < 0 || l.rate().stripTrailingZeros().scale() > 2) throw bad("Rate must be 0 or more (up to 2 decimals)");
            if (l.rate().compareTo(new BigDecimal("99999999999")) > 0) throw bad("Rate is too large");
            if (l.gst() == null || l.gst().signum() < 0 || l.gst().compareTo(BigDecimal.valueOf(100)) > 0) throw bad("GST % must be between 0 and 100");
        }
    }

    private LocalDate date(String d) {
        try { return LocalDate.parse(d); } catch (DateTimeParseException | NullPointerException e) { throw bad("Date is invalid"); }
    }

    private void checkVendorFields(String mobile, String gst) {
        if (!mobile.matches("\\d{10}")) throw bad("Vendor mobile must be 10 digits");
        if (gst.length() > 40) throw bad("GST number can be at most 40 characters"); // wrong format is only a warning in the UI
    }

    // ---------- reference data ----------
    public List<Map<String, Object>> materialTypes() {
        return jdbc.sql("""
                select m.id,m.name,m.uom,m.hsn,
                 (select count(*) from purchase_items pi join purchases p on p.id=pi.purchase_id where pi.material_type_id=m.id and p.deleted_at is null)
                +(select count(*) from sale_items si join sales sa on sa.id=si.sale_id where si.material_type_id=m.id and sa.deleted_at is null) used
                from material_types m order by lower(m.name)""").query((rs, n) -> {
            Map<String, Object> r = new LinkedHashMap<>(); r.put("id", rs.getLong("id")); r.put("name", rs.getString("name"));
            r.put("uom", rs.getString("uom")); r.put("hsn", rs.getString("hsn") == null ? "" : rs.getString("hsn")); r.put("usedCount", rs.getLong("used")); return r; }).list();
    }

    @Transactional
    public Map<String, Object> saveMaterialType(Long id, MaterialTypeIn in) {
        String name = s(in.name()), uom = s(in.uom()), hsn = s(in.hsn());
        boolean keepHsn = in.hsn() == null; // an older client that does not send HSN must not wipe it
        if (hsn.length() > 16) throw bad("HSN code can be at most 16 characters"); // format is only a warning in the UI
        if (name.isEmpty() || name.length() > 180) throw bad("Material type name is required");
        if (uom.isEmpty() || uom.length() > 32) throw bad("Unit is required");
        Long dupe = jdbc.sql("select id from material_types where lower(name)=lower(:n)").param("n", name).query(Long.class).optional().orElse(null);
        if (id == null) {
            if (dupe != null) throw new ApiException(409, "Material type already exists");
            id = jdbc.sql("insert into material_types(name,uom,hsn) values(:n,:u,:h) returning id").param("n", name).param("u", uom).param("h", hsn).query(Long.class).single();
        } else {
            final Long finalId = id;
            Map<String, Object> cur = jdbc.sql("select name,uom from material_types where id=:id").param("id", id).query().singleRow();
            if (dupe != null && !dupe.equals(id)) throw new ApiException(409, "Material type already exists");
            boolean used = materialTypes().stream().anyMatch(m -> ((Long) m.get("id")).equals(finalId) && ((Long) m.get("usedCount")) > 0);
            if (used && !cur.get("uom").equals(uom)) throw new ApiException(409, "Unit is locked because purchases or sales already use this material");
            jdbc.sql("update material_types set name=:n,uom=:u,hsn=case when :k then hsn else :h end where id=:id").param("n", name).param("u", uom).param("k", keepHsn).param("h", hsn).param("id", id).update();
        }
        long fid = id;
        return materialTypes().stream().filter(m -> ((Long) m.get("id")) == fid).findFirst().orElseThrow();
    }

    public List<Map<String, Object>> vendors() {
        return jdbc.sql("""
                select v.id,v.name,v.mobile,v.gst,v.address,
                 (select count(*) from purchases p where p.vendor_id=v.id and p.deleted_at is null) purchases,
                 (select count(*) from sales s where s.vendor_id=v.id and s.deleted_at is null) sales
                from material_vendors v order by lower(v.name)""").query((rs, n) -> {
            Map<String, Object> r = new LinkedHashMap<>(); r.put("id", rs.getLong("id")); r.put("name", rs.getString("name"));
            r.put("mobile", rs.getString("mobile")); r.put("gst", rs.getString("gst")); r.put("address", rs.getString("address"));
            r.put("purchases", rs.getLong("purchases")); r.put("sales", rs.getLong("sales")); return r; }).list();
    }

    @Transactional
    public Map<String, Object> saveVendor(Long id, VendorIn in) {
        String name = s(in.name()), mobile = s(in.mobile()), gst = s(in.gst()).toUpperCase(), addr = s(in.address());
        if (name.isEmpty() || name.length() > 180) throw bad("Vendor name is required");
        checkVendorFields(mobile, gst);
        Long dupe = jdbc.sql("select id from material_vendors where lower(name)=lower(:n)").param("n", name).query(Long.class).optional().orElse(null);
        if (dupe != null && !dupe.equals(id)) throw new ApiException(409, "Vendor already exists");
        if (id == null) id = jdbc.sql("insert into material_vendors(name,mobile,gst,address) values(:n,:m,:g,:a) returning id")
                .param("n", name).param("m", mobile).param("g", gst).param("a", addr).query(Long.class).single();
        else {
            int c = jdbc.sql("update material_vendors set name=:n,mobile=:m,gst=:g,address=:a where id=:id").param("n", name).param("m", mobile).param("g", gst).param("a", addr).param("id", id).update();
            if (c == 0) throw new ApiException(404, "Vendor not found");
        }
        long fid = id;
        return vendors().stream().filter(v -> ((Long) v.get("id")) == fid).findFirst().orElseThrow();
    }

    public Map<String, Object> company() {
        return jdbc.sql("select name,address,gst,mobile from company_profile where id=1").query().singleRow();
    }

    @Transactional
    public Map<String, Object> saveCompany(CompanyIn in) {
        String address = s(in.address()), gst = s(in.gst()).toUpperCase(), mobile = s(in.mobile());
        if (address.isEmpty()) throw bad("Company address is required");
        if (gst.length() > 40) throw bad("GST number can be at most 40 characters"); // wrong format is only a warning in the UI
        if (!mobile.matches("\\d{10}")) throw bad("Mobile must be 10 digits");
        jdbc.sql("update company_profile set address=:a,gst=:g,mobile=:m,updated_at=now() where id=1").param("a", address).param("g", gst).param("m", mobile).update();
        return company();
    }

    private long ensureVendor(String name, String mobile, String gst, String address, boolean mayCreate) {
        name = s(name);
        if (name.isEmpty()) throw bad("Vendor is required");
        Long id = jdbc.sql("select id from material_vendors where lower(name)=lower(:n)").param("n", name).query(Long.class).optional().orElse(null);
        if (id != null) return id;
        if (!mayCreate) throw bad("Unknown vendor");
        String g = s(gst).toUpperCase(), m = s(mobile);
        checkVendorFields(m, g);
        return jdbc.sql("insert into material_vendors(name,mobile,gst,address) values(:n,:m,:g,:a) returning id")
                .param("n", name).param("m", m).param("g", g).param("a", s(address)).query(Long.class).single();
    }

    /** Purchases may introduce new material types (the form creates them). A known name must keep its unit. */
    private long ensureMaterial(Item l, boolean mayCreate) {
        String name = s(l.material()), uom = s(l.uom());
        Map<String, Object> row = jdbc.sql("select id,uom from material_types where lower(name)=lower(:n)").param("n", name).query().listOfRows().stream().findFirst().orElse(null);
        if (row != null) {
            if (!row.get("uom").equals(uom)) throw bad("Unit for '" + name + "' is " + row.get("uom") + ", not " + uom);
            return (Long) row.get("id");
        }
        if (!mayCreate) throw bad("Unknown material '" + name + "'. Sales can use existing materials only");
        return jdbc.sql("insert into material_types(name,uom) values(:n,:u) returning id").param("n", name).param("u", uom).query(Long.class).single();
    }

    private String nextCode(String kind, String prefix, LocalDate d) {
        int n = jdbc.sql("""
                insert into material_doc_counters(kind,day,last_no) values(:k,:d,1)
                on conflict (kind,day) do update set last_no=material_doc_counters.last_no+1 returning last_no
                """).param("k", kind).param("d", d).query(Integer.class).single();
        return prefix + String.format("%02d%02d%02d", d.getYear() % 100, d.getMonthValue(), d.getDayOfMonth()) + String.format("%03d", n);
    }

    // ---------- stock ----------
    public List<Map<String, Object>> stock() {
        return jdbc.sql("""
                select m.id,m.name,m.uom,m.hsn,
                 coalesce((select sum(pi.qty) from purchase_items pi join purchases p on p.id=pi.purchase_id where pi.material_type_id=m.id and p.deleted_at is null),0) purchased,
                 coalesce((select sum(si.qty) from sale_items si join sales s on s.id=si.sale_id where si.material_type_id=m.id and s.sale_type='DEBIT' and s.deleted_at is null),0) debit,
                 coalesce((select sum(si.qty) from sale_items si join sales s on s.id=si.sale_id where si.material_type_id=m.id and s.sale_type='CREDIT' and s.deleted_at is null),0) credit
                from material_types m order by lower(m.name)""").query((rs, n) -> {
            Map<String, Object> r = new LinkedHashMap<>(); r.put("id", rs.getLong("id")); r.put("material", rs.getString("name")); r.put("uom", rs.getString("uom")); r.put("hsn", rs.getString("hsn") == null ? "" : rs.getString("hsn"));
            BigDecimal p = rs.getBigDecimal("purchased"), d = rs.getBigDecimal("debit"), c = rs.getBigDecimal("credit");
            r.put("purchased", p.stripTrailingZeros()); r.put("issued", d.stripTrailingZeros()); r.put("returned", c.stripTrailingZeros());
            r.put("stock", p.subtract(d).add(c).stripTrailingZeros()); return r; }).list();
    }

    private Map<Long, BigDecimal> stockById() {
        Map<Long, BigDecimal> m = new HashMap<>();
        for (Map<String, Object> r : stock()) m.put((Long) r.get("id"), (BigDecimal) r.get("stock"));
        return m;
    }

    /** Debit above stock is allowed (user decision 17:14). The save succeeds and the response carries a warning per short material. */
    private List<String> shortfalls(Collection<Long> materialIds) {
        Map<Long, BigDecimal> st = stockById();
        Map<Long, String> names = jdbc.sql("select id,name from material_types").query((rs, n) -> Map.entry(rs.getLong(1), rs.getString(2))).list()
                .stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        List<String> w = new ArrayList<>();
        for (Long id : materialIds) if (st.getOrDefault(id, BigDecimal.ZERO).signum() < 0) w.add(names.get(id) + " stock is now " + st.get(id).toPlainString());
        return w;
    }

    // ---------- material groups ----------
    public List<Map<String, Object>> groups() {
        Map<Long, List<Map<String, Object>>> items = new HashMap<>();
        for (Map<String, Object> r : jdbc.sql("select gi.group_id,gi.material_type_id,m.name,m.uom,m.hsn,gi.qty from material_group_items gi join material_types m on m.id=gi.material_type_id order by gi.group_id,gi.position").query().listOfRows()) {
            Map<String, Object> o = new LinkedHashMap<>(); o.put("materialId", r.get("material_type_id")); o.put("material", r.get("name")); o.put("uom", r.get("uom"));
            o.put("hsn", r.get("hsn") == null ? "" : r.get("hsn")); o.put("qty", new BigDecimal(r.get("qty").toString()).stripTrailingZeros());
            items.computeIfAbsent(((Number) r.get("group_id")).longValue(), k -> new ArrayList<>()).add(o);
        }
        return jdbc.sql("""
                select g.id,g.name,g.archived_at,
                 (select count(distinct si.sale_id) from sale_items si join sales s on s.id=si.sale_id where si.group_id=g.id and s.deleted_at is null) used
                from material_groups g order by lower(g.name)""").query().listOfRows().stream().map(r -> {
            long id = ((Number) r.get("id")).longValue();
            Map<String, Object> o = new LinkedHashMap<>(); o.put("id", id); o.put("name", r.get("name")); o.put("archived", r.get("archived_at") != null);
            o.put("usedCount", ((Number) r.get("used")).longValue()); o.put("items", items.getOrDefault(id, List.of())); return o; }).toList();
    }

    @Transactional
    public Map<String, Object> saveGroup(Long id, GroupIn in) {
        String name = s(in.name());
        if (name.isEmpty() || name.length() > 180) throw bad("Group name is required");
        List<GroupItemIn> its = in.items() == null ? List.of() : in.items();
        if (its.isEmpty()) throw bad("Add at least one material to the group");
        Map<Long, BigDecimal> members = new LinkedHashMap<>();
        for (GroupItemIn it : its) {
            if (it == null || s(it.material()).isEmpty()) throw bad("Material is required for each group row");
            Long mid = jdbc.sql("select id from material_types where lower(name)=lower(:n)").param("n", s(it.material())).query(Long.class).optional().orElseThrow(() -> bad("Unknown material '" + it.material() + "'. Groups use existing material types"));
            if (members.containsKey(mid)) throw bad("'" + it.material() + "' is already in this group");
            BigDecimal q = it.qty();
            if (q == null || q.signum() <= 0 || q.stripTrailingZeros().scale() > 3) throw bad("Quantity for '" + it.material() + "' must be greater than 0 (up to 3 decimals)");
            if (q.compareTo(new BigDecimal("99999999")) > 0) throw bad("Quantity for '" + it.material() + "' is too large");
            members.put(mid, q);
        }
        Long dupe = jdbc.sql("select id from material_groups where lower(name)=lower(:n)").param("n", name).query(Long.class).optional().orElse(null);
        if (dupe != null && !dupe.equals(id)) throw new ApiException(409, "Group already exists");
        if (id == null) id = jdbc.sql("insert into material_groups(name) values(:n) returning id").param("n", name).query(Long.class).single();
        else {
            int c = jdbc.sql("update material_groups set name=:n where id=:id").param("n", name).param("id", id).update();
            if (c == 0) throw new ApiException(404, "Group not found");
            jdbc.sql("delete from material_group_items where group_id=:id").param("id", id).update();
        }
        int pos = 0;
        for (Map.Entry<Long, BigDecimal> e : members.entrySet())
            jdbc.sql("insert into material_group_items(group_id,position,material_type_id,qty) values(:g,:p,:m,:q)").param("g", id).param("p", pos++).param("m", e.getKey()).param("q", e.getValue()).update();
        long fid = id;
        return groups().stream().filter(g -> ((Long) g.get("id")) == fid).findFirst().orElseThrow();
    }

    /** Groups are never deleted: archiving hides one from new sales; old sales and challans keep it. */
    @Transactional
    public Map<String, Object> archiveGroup(long id, boolean archived) {
        int c = jdbc.sql("update material_groups set archived_at=case when :a then coalesce(archived_at,now()) else null end where id=:id").param("a", archived).param("id", id).update();
        if (c == 0) throw new ApiException(404, "Group not found");
        return groups().stream().filter(g -> ((Long) g.get("id")) == id).findFirst().orElseThrow();
    }

    // ---------- purchases ----------
    private List<Map<String, Object>> itemsOut(List<Map<String, Object>> rows) { return rows; }

    private Map<Long, String> materialNames() {
        return jdbc.sql("select id,name from material_types").query((rs, n) -> Map.entry(rs.getLong(1), rs.getString(2))).list()
                .stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }
    private Map<Long, Map<String, Object>> vendorMap() {
        Map<Long, Map<String, Object>> m = new HashMap<>();
        for (Map<String, Object> v : vendors()) m.put((Long) v.get("id"), v);
        return m;
    }

    private Map<Long, String> materialHsn() {
        Map<Long, String> m = new HashMap<>();
        jdbc.sql("select id,hsn from material_types").query((rs, n) -> { m.put(rs.getLong(1), rs.getString(2) == null ? "" : rs.getString(2)); return 0; }).list();
        return m;
    }

    private Map<String, Object> itemOut(Map<String, Object> raw, Map<Long, String> names, Map<Long, String> hsn) {
        Map<String, Object> o = new LinkedHashMap<>();
        o.put("material", names.get(((Number) raw.get("material_type_id")).longValue()));
        o.put("uom", raw.get("uom"));
        o.put("hsn", hsn.getOrDefault(((Number) raw.get("material_type_id")).longValue(), ""));
        o.put("qty", new BigDecimal(raw.get("qty").toString()).stripTrailingZeros());
        o.put("rate", new BigDecimal(raw.get("rate").toString()).stripTrailingZeros());
        o.put("gst", new BigDecimal(raw.get("gst").toString()).stripTrailingZeros());
        if (raw.get("group_line") != null) {
            o.put("groupLine", ((Number) raw.get("group_line")).intValue()); o.put("groupId", ((Number) raw.get("group_id")).longValue());
            o.put("groupName", raw.get("group_name"));
            o.put("groupQty", new BigDecimal(raw.get("group_qty").toString()).stripTrailingZeros()); o.put("groupPer", new BigDecimal(raw.get("group_per").toString()).stripTrailingZeros());
        }
        return o;
    }

    private Map<String, Object> purchaseSnapshot(long id) {
        Map<String, Object> p = jdbc.sql("select purchase_date,vendor_id,bill_number,invoice_name,invoice_type,invoice_path from purchases where id=:id").param("id", id).query().singleRow();
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("date", p.get("purchase_date").toString()); snap.put("vendorId", p.get("vendor_id")); snap.put("billNumber", p.get("bill_number"));
        snap.put("invoiceName", p.get("invoice_name")); snap.put("invoiceType", p.get("invoice_type")); snap.put("invoicePath", p.get("invoice_path"));
        snap.put("items", jdbc.sql("select material_type_id,uom,qty,rate,gst from purchase_items where purchase_id=:id order by position").param("id", id).query().listOfRows());
        return snap;
    }

    private static String normGroupVal(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return new BigDecimal(o.toString()).stripTrailingZeros().toPlainString();
        return o.toString();
    }

    private String canon(Map<String, Object> snap) {
        try {
            Map<String, Object> c = new LinkedHashMap<>(snap);
            List<Map<String, Object>> its = new ArrayList<>();
            for (Map<String, Object> i : (List<Map<String, Object>>) snap.get("items")) {
                Map<String, Object> x = new LinkedHashMap<>();
                x.put("m", ((Number) i.get("material_type_id")).longValue()); x.put("u", i.get("uom"));
                x.put("q", new BigDecimal(i.get("qty").toString()).stripTrailingZeros().toPlainString());
                x.put("r", new BigDecimal(i.get("rate").toString()).stripTrailingZeros().toPlainString());
                x.put("g", new BigDecimal(i.get("gst").toString()).stripTrailingZeros().toPlainString());
                for (String k : new String[]{"group_line", "group_id", "group_name", "group_qty", "group_per"}) x.put(k, normGroupVal(i.get(k)));
                its.add(x);
            }
            c.put("items", its);
            if (snap.containsKey("siteIds")) { List<Long> ids = new ArrayList<>(); for (Object o : (List<?>) snap.get("siteIds")) ids.add(((Number) o).longValue()); Collections.sort(ids); c.put("siteIds", ids); }
            return json.writeValueAsString(c);
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    private String toJson(Object o) { try { return json.writeValueAsString(o); } catch (Exception e) { throw new IllegalStateException(e); } }
    private Map<String, Object> fromJson(String s) { try { return json.readValue(s, new TypeReference<Map<String, Object>>() {}); } catch (Exception e) { throw new IllegalStateException(e); } }

    public List<Map<String, Object>> purchases(Long onlyId) {
        Map<Long, String> names = materialNames(); Map<Long, String> hsn = materialHsn(); Map<Long, Map<String, Object>> vendors = vendorMap();
        List<Map<String, Object>> rows = jdbc.sql("""
                select id,purchase_code,purchase_date,vendor_id,bill_number,invoice_name,invoice_type,active_from from purchases
                where deleted_at is null and (:only::bigint is null or id=:only) order by purchase_date desc,id desc""")
                .param("only", onlyId).query().listOfRows();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            long id = ((Number) r.get("id")).longValue();
            Map<String, Object> o = new LinkedHashMap<>();
            Map<String, Object> v = vendors.get(((Number) r.get("vendor_id")).longValue());
            o.put("id", id); o.put("purchaseId", r.get("purchase_code")); o.put("date", r.get("purchase_date").toString());
            o.put("vendor", v.get("name")); o.put("vendorMobile", v.get("mobile")); o.put("vendorGst", v.get("gst")); o.put("vendorAddress", v.get("address"));
            o.put("billNumber", r.get("bill_number"));
            if (r.get("invoice_name") != null) o.put("invoice", Map.of("name", r.get("invoice_name"), "type", r.get("invoice_type"), "url", "/material/purchases/" + id + "/invoice"));
            o.put("activeFrom", iso(r.get("active_from")));
            o.put("items", jdbc.sql("select material_type_id,uom,qty,rate,gst from purchase_items where purchase_id=:id order by position").param("id", id).query().listOfRows()
                    .stream().map(i -> itemOut(i, names, hsn)).toList());
            List<Map<String, Object>> vers = new ArrayList<>();
            for (Map<String, Object> vr : jdbc.sql("select version,active_from,active_to,snapshot::text snap from purchase_versions where purchase_id=:id order by version desc").param("id", id).query().listOfRows()) {
                Map<String, Object> sn = fromJson((String) vr.get("snap")); Map<String, Object> vv = vendors.get(((Number) sn.get("vendorId")).longValue());
                Map<String, Object> x = new LinkedHashMap<>();
                int ver = ((Number) vr.get("version")).intValue();
                x.put("version", ver); x.put("activeFrom", iso(vr.get("active_from"))); x.put("activeTo", iso(vr.get("active_to")));
                x.put("date", sn.get("date")); x.put("vendor", vv.get("name")); x.put("vendorMobile", vv.get("mobile")); x.put("billNumber", sn.get("billNumber"));
                if (sn.get("invoiceName") != null) x.put("invoice", Map.of("name", sn.get("invoiceName"), "type", sn.get("invoiceType"), "url", "/material/purchases/" + id + "/versions/" + ver + "/invoice"));
                x.put("items", ((List<Map<String, Object>>) sn.get("items")).stream().map(i -> itemOut(i, names, hsn)).toList());
                vers.add(x);
            }
            o.put("versions", vers);
            out.add(o);
        }
        return out;
    }

    public Map<String, Object> purchase(long id) {
        List<Map<String, Object>> l = purchases(id);
        if (l.isEmpty()) throw new ApiException(404, "Purchase not found");
        return l.get(0);
    }

    /** Invoice file info for the current document, or for a past version when version > 0. */
    public Map<String, Object> purchaseInvoice(long id, int version) {
        if (version <= 0) {
            return jdbc.sql("select invoice_name name,invoice_type type,invoice_path path from purchases where id=:id and deleted_at is null and invoice_path is not null")
                    .param("id", id).query().listOfRows().stream().findFirst().orElseThrow(() -> new ApiException(404, "No invoice uploaded"));
        }
        String snap = jdbc.sql("select snapshot::text from purchase_versions where purchase_id=:id and version=:v and exists(select 1 from purchases where id=:id and deleted_at is null)")
                .param("id", id).param("v", version).query(String.class).optional().orElseThrow(() -> new ApiException(404, "Version not found"));
        Map<String, Object> sn = fromJson(snap);
        if (sn.get("invoicePath") == null) throw new ApiException(404, "No invoice uploaded");
        return Map.of("name", sn.get("invoiceName"), "type", sn.get("invoiceType"), "path", sn.get("invoicePath"));
    }

    public record StoredInvoice(String name, String type, String path) {}

    @Transactional
    public Map<String, Object> createPurchase(PurchaseIn in, StoredInvoice inv, AppPrincipal user) {
        LocalDate d = date(in.date()); validateItems(in.items());
        if (s(in.billNumber()).length() > 80) throw bad("Bill number is too long");
        long vendor = ensureVendor(in.vendor(), in.vendorMobile(), in.vendorGst(), in.vendorAddress(), true);
        String code = nextCode("P", "SE", d);
        long id = jdbc.sql("""
                insert into purchases(purchase_code,purchase_date,vendor_id,bill_number,invoice_name,invoice_type,invoice_path,created_by,updated_by)
                values(:c,:d,:v,:b,:in,:it,:ip,:u,:u) returning id""").param("c", code).param("d", d).param("v", vendor).param("b", s(in.billNumber()))
                .param("in", inv == null ? null : inv.name()).param("it", inv == null ? null : inv.type()).param("ip", inv == null ? null : inv.path()).param("u", user.id()).query(Long.class).single();
        writePurchaseItems(id, in.items());
        return purchase(id);
    }

    private void writePurchaseItems(long id, List<Item> items) {
        jdbc.sql("delete from purchase_items where purchase_id=:id").param("id", id).update();
        int pos = 0;
        for (Item l : items) {
            long m = ensureMaterial(l, true);
            jdbc.sql("insert into purchase_items(purchase_id,position,material_type_id,uom,qty,rate,gst) values(:p,:pos,:m,:u,:q,:r,:g)")
                    .param("p", id).param("pos", pos++).param("m", m).param("u", s(l.uom())).param("q", l.qty()).param("r", l.rate()).param("g", l.gst()).update();
        }
    }

    /** Returns the purchase and the superseded invoice path (if replaced), so the caller can decide about files. Old files are kept for version viewing. */
    @Transactional
    public Map<String, Object> updatePurchase(long id, PurchaseIn in, StoredInvoice newInvoice, AppPrincipal user) {
        Map<String, Object> cur = jdbc.sql("select active_from from purchases where id=:id and deleted_at is null for update").param("id", id).query().listOfRows().stream().findFirst()
                .orElseThrow(() -> new ApiException(404, "Purchase not found"));
        LocalDate d = date(in.date()); validateItems(in.items());
        if (s(in.billNumber()).length() > 80) throw bad("Bill number is too long");
        Map<String, Object> before = purchaseSnapshot(id);
        long vendor = ensureVendor(in.vendor(), in.vendorMobile(), in.vendorGst(), in.vendorAddress(), true);
        // Build the proposed snapshot with materials resolved (creating new types is allowed in purchases).
        List<Map<String, Object>> its = new ArrayList<>();
        for (Item l : in.items()) {
            Map<String, Object> i = new LinkedHashMap<>(); i.put("material_type_id", ensureMaterial(l, true)); i.put("uom", s(l.uom())); i.put("qty", l.qty()); i.put("rate", l.rate()); i.put("gst", l.gst()); its.add(i);
        }
        Map<String, Object> after = new LinkedHashMap<>();
        after.put("date", d.toString()); after.put("vendorId", vendor); after.put("billNumber", s(in.billNumber()));
        String iname = (String) before.get("invoiceName"), itype = (String) before.get("invoiceType"), ipath = (String) before.get("invoicePath");
        if (newInvoice != null) { iname = newInvoice.name(); itype = newInvoice.type(); ipath = newInvoice.path(); }
        else if (Boolean.TRUE.equals(in.removeInvoice())) { iname = null; itype = null; ipath = null; }
        after.put("invoiceName", iname); after.put("invoiceType", itype); after.put("invoicePath", ipath); after.put("items", its);
        if (canon(before).equals(canon(after))) return purchase(id); // nothing changed: no new version
        Object from = cur.get("active_from");
        int ver = jdbc.sql("select coalesce(max(version),0)+1 from purchase_versions where purchase_id=:id").param("id", id).query(Integer.class).single();
        jdbc.sql("insert into purchase_versions(purchase_id,version,active_from,active_to,snapshot) values(:id,:v,:f,date_trunc('second',now()),cast(:s as jsonb))")
                .param("id", id).param("v", ver).param("f", from).param("s", toJson(before)).update();
        jdbc.sql("update purchases set purchase_date=:d,vendor_id=:v,bill_number=:b,invoice_name=:in,invoice_type=:it,invoice_path=:ip,active_from=date_trunc('second',now()),updated_by=:u where id=:id")
                .param("d", d).param("v", vendor).param("b", s(in.billNumber())).param("in", iname).param("it", itype).param("ip", ipath).param("u", user.id()).param("id", id).update();
        writePurchaseItems(id, in.items());
        return purchase(id);
    }

    /** Delete is an archive: the document, versions and files stay in the database, hidden from lists and stock. Numbers are never reused. */
    @Transactional
    public List<String> deletePurchase(long id, AppPrincipal user) {
        List<Long> mats = jdbc.sql("select distinct material_type_id from purchase_items where purchase_id=:id").param("id", id).query(Long.class).list();
        int c = jdbc.sql("update purchases set deleted_at=now(),deleted_by=:u where id=:id and deleted_at is null").param("id", id).param("u", user.id()).update();
        if (c == 0) throw new ApiException(404, "Purchase not found");
        return shortfalls(mats);
    }

    // ---------- sales ----------
    private List<Long> checkSites(List<Long> siteIds) {
        if (siteIds == null || siteIds.isEmpty()) return List.of(); // a sale without a site is allowed
        List<Long> ids = siteIds.stream().distinct().sorted().toList();
        long found = jdbc.sql("select count(*) from sites where id in (:ids)").param("ids", ids).query(Long.class).single();
        if (found != ids.size()) throw bad("A selected site does not exist");
        return ids;
    }

    private Map<String, Object> saleSnapshot(long id) {
        Map<String, Object> s = jdbc.sql("select sale_type,sale_date,vendor_id from sales where id=:id").param("id", id).query().singleRow();
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("type", s.get("sale_type")); snap.put("date", s.get("sale_date").toString()); snap.put("vendorId", s.get("vendor_id"));
        snap.put("siteIds", jdbc.sql("select site_id from sale_sites where sale_id=:id order by site_id").param("id", id).query(Long.class).list());
        snap.put("items", jdbc.sql("select material_type_id,uom,qty,rate,gst,group_line,group_id,group_name,group_qty,group_per from sale_items where sale_id=:id order by position").param("id", id).query().listOfRows());
        return snap;
    }

    /** One sale line after groups are expanded into child rows. */
    record Line(Item item, Integer groupLine, Long groupId, String groupName, BigDecimal groupQty, BigDecimal per) {}

    private void writeSaleItems(long id, List<Line> lines) {
        jdbc.sql("delete from sale_items where sale_id=:id").param("id", id).update();
        int pos = 0;
        for (Line ln : lines) {
            Item l = ln.item();
            long m = ensureMaterial(l, false); // the unit of the line must still be the material's unit
            jdbc.sql("insert into sale_items(sale_id,position,material_type_id,uom,qty,rate,gst,group_line,group_id,group_name,group_qty,group_per) values(:p,:pos,:m,:u,:q,:r,:g,:gl,:gi,:gn,:gq,:gp)")
                    .param("p", id).param("pos", pos++).param("m", m).param("u", s(l.uom())).param("q", l.qty()).param("r", l.rate()).param("g", l.gst())
                    .param("gl", ln.groupLine()).param("gi", ln.groupId()).param("gn", ln.groupName()).param("gq", ln.groupQty()).param("gp", ln.per()).update();
        }
    }

    /**
     * Plain items first, then one block per group. A group line expands to its members: child qty = group qty x qty per group.
     * A sale that already holds the group keeps the member list it was saved with (editing never rewrites old history);
     * a group added now uses the current definition and must not be archived. Every member needs its own rate and GST.
     */
    private List<Line> buildLines(SaleIn in, Long existingSaleId) {
        List<Item> plain = in.items() == null ? List.of() : in.items();
        List<GroupLineIn> groups = in.groups() == null ? List.of() : in.groups();
        if (plain.isEmpty() && groups.isEmpty()) throw bad("Add at least one item");
        if (!plain.isEmpty()) validateEach(plain);
        List<Line> out = new ArrayList<>();
        for (Item l : plain) out.add(new Line(l, null, null, null, null, null));
        Map<Long, String> names = materialNames();
        int n = 0;
        for (GroupLineIn g : groups) {
            if (g == null || g.groupId() == null) throw bad("Group is required");
            BigDecimal q = g.qty();
            if (q == null || q.signum() <= 0 || q.stripTrailingZeros().scale() > 3) throw bad("Group quantity must be greater than 0 (up to 3 decimals)");
            if (q.compareTo(new BigDecimal("99999999")) > 0) throw bad("Group quantity is too large");
            String gname; List<Map<String, Object>> members = new ArrayList<>();
            List<Map<String, Object>> kept = existingSaleId == null ? List.of() : jdbc.sql("select material_type_id,group_name,group_per from sale_items where sale_id=:s and group_id=:g and group_line=(select min(group_line) from sale_items where sale_id=:s and group_id=:g) order by position")
                    .param("s", existingSaleId).param("g", g.groupId()).query().listOfRows();
            if (!kept.isEmpty()) {
                gname = (String) kept.get(0).get("group_name");
                for (Map<String, Object> k : kept) members.add(Map.of("mid", ((Number) k.get("material_type_id")).longValue(), "per", new BigDecimal(k.get("group_per").toString())));
            } else {
                Map<String, Object> grp = jdbc.sql("select name,archived_at from material_groups where id=:g").param("g", g.groupId()).query().listOfRows().stream().findFirst()
                        .orElseThrow(() -> bad("Unknown group"));
                if (grp.get("archived_at") != null) throw bad("Group '" + grp.get("name") + "' is archived and cannot be added to a sale");
                gname = (String) grp.get("name");
                for (Map<String, Object> k : jdbc.sql("select material_type_id,qty from material_group_items where group_id=:g order by position").param("g", g.groupId()).query().listOfRows())
                    members.add(Map.of("mid", ((Number) k.get("material_type_id")).longValue(), "per", new BigDecimal(k.get("qty").toString())));
            }
            Map<String, GroupChildIn> byName = new HashMap<>();
            if (g.children() != null) for (GroupChildIn c : g.children()) {
                if (c == null || s(c.material()).isEmpty()) throw bad("Group material is required");
                if (byName.put(s(c.material()).toLowerCase(), c) != null) throw bad("Group material '" + c.material() + "' is repeated");
            }
            if (byName.size() != members.size()) throw bad("Group '" + gname + "' needs a price and GST for each of its materials");
            n++;
            List<Item> kids = new ArrayList<>();
            for (Map<String, Object> m : members) {
                long mid = (Long) m.get("mid"); BigDecimal per = (BigDecimal) m.get("per");
                String mname = names.get(mid);
                GroupChildIn c = byName.get(mname.toLowerCase());
                if (c == null) throw bad("Price and GST for '" + mname + "' (group " + gname + ") are missing");
                BigDecimal cq = q.multiply(per);
                if (cq.stripTrailingZeros().scale() > 3) throw bad("Group quantity gives more than 3 decimals for '" + mname + "'");
                String uom = jdbc.sql("select uom from material_types where id=:i").param("i", mid).query(String.class).single();
                Item it = new Item(mname, uom, cq.stripTrailingZeros(), c.rate(), c.gst());
                kids.add(it);
                out.add(new Line(it, n, g.groupId(), gname, q.stripTrailingZeros(), per.stripTrailingZeros()));
            }
            validateEach(kids);
        }
        return out;
    }

    private void writeSaleSites(long id, List<Long> siteIds) {
        jdbc.sql("delete from sale_sites where sale_id=:id").param("id", id).update();
        for (Long sid : siteIds) jdbc.sql("insert into sale_sites(sale_id,site_id) values(:i,:s)").param("i", id).param("s", sid).update();
    }

    private Set<Long> materialsOfSale(long id) { return new HashSet<>(jdbc.sql("select material_type_id from sale_items where sale_id=:id").param("id", id).query(Long.class).list()); }

    @Transactional
    public Map<String, Object> createSale(SaleIn in, AppPrincipal user) {
        String type = s(in.type());
        if (!type.equals("DEBIT") && !type.equals("CREDIT")) throw bad("Choose Debit or Credit");
        LocalDate d = date(in.date());
        List<Line> lines = buildLines(in, null);
        List<Long> sites = checkSites(in.siteIds());
        VendorIn nv = in.newVendor();
        long vendor = ensureVendor(in.vendor(), nv == null ? null : nv.mobile(), nv == null ? null : nv.gst(), nv == null ? null : nv.address(), nv != null);
        String code = nextCode("S", "SES", d);
        long id = jdbc.sql("insert into sales(sale_code,sale_type,sale_date,vendor_id,created_by,updated_by) values(:c,:t,:d,:v,:u,:u) returning id")
                .param("c", code).param("t", type).param("d", d).param("v", vendor).param("u", user.id()).query(Long.class).single();
        writeSaleItems(id, lines); writeSaleSites(id, sites);
        storeChallan(id, "CREATED", user.id());
        Map<String, Object> out = new LinkedHashMap<>(saleFull(id, null));
        out.put("warnings", shortfalls(materialsOfSale(id)));
        return out;
    }

    @Transactional
    public Map<String, Object> updateSale(long id, SaleIn in, AppPrincipal user) {
        Map<String, Object> cur = jdbc.sql("select active_from from sales where id=:id and deleted_at is null for update").param("id", id).query().listOfRows().stream().findFirst()
                .orElseThrow(() -> new ApiException(404, "Sale not found"));
        String type = s(in.type());
        if (!type.equals("DEBIT") && !type.equals("CREDIT")) throw bad("Choose Debit or Credit");
        LocalDate d = date(in.date());
        List<Line> lines = buildLines(in, id);
        List<Long> sites = checkSites(in.siteIds());
        VendorIn nv = in.newVendor();
        long vendor = ensureVendor(in.vendor(), nv == null ? null : nv.mobile(), nv == null ? null : nv.gst(), nv == null ? null : nv.address(), nv != null);
        Map<String, Object> before = saleSnapshot(id);
        Set<Long> mats = materialsOfSale(id);
        List<Map<String, Object>> its = new ArrayList<>();
        for (Line ln : lines) {
            Item l = ln.item();
            Map<String, Object> i = new LinkedHashMap<>(); i.put("material_type_id", ensureMaterial(l, false)); i.put("uom", s(l.uom())); i.put("qty", l.qty()); i.put("rate", l.rate()); i.put("gst", l.gst());
            i.put("group_line", ln.groupLine()); i.put("group_id", ln.groupId()); i.put("group_name", ln.groupName()); i.put("group_qty", ln.groupQty()); i.put("group_per", ln.per()); its.add(i);
        }
        Map<String, Object> after = new LinkedHashMap<>();
        after.put("type", type); after.put("date", d.toString()); after.put("vendorId", vendor); after.put("siteIds", sites); after.put("items", its);
        if (!canon(before).equals(canon(after))) {
            int ver = jdbc.sql("select coalesce(max(version),0)+1 from sale_versions where sale_id=:id").param("id", id).query(Integer.class).single();
            jdbc.sql("insert into sale_versions(sale_id,version,active_from,active_to,snapshot) values(:id,:v,:f,date_trunc('second',now()),cast(:s as jsonb))")
                    .param("id", id).param("v", ver).param("f", cur.get("active_from")).param("s", toJson(before)).update();
            jdbc.sql("update sales set sale_type=:t,sale_date=:d,vendor_id=:v,active_from=date_trunc('second',now()),updated_by=:u where id=:id")
                    .param("t", type).param("d", d).param("v", vendor).param("u", user.id()).param("id", id).update();
            writeSaleItems(id, lines); writeSaleSites(id, sites);
            storeChallan(id, "EDITED", user.id());
            mats.addAll(materialsOfSale(id));
        }
        Map<String, Object> out = new LinkedHashMap<>(saleFull(id, null));
        out.put("warnings", shortfalls(mats));
        return out;
    }

    @Transactional
    public List<String> deleteSale(long id, AppPrincipal user) {
        Set<Long> mats = materialsOfSale(id);
        int c = jdbc.sql("update sales set deleted_at=now(),deleted_by=:u where id=:id and deleted_at is null").param("id", id).param("u", user.id()).update();
        if (c == 0) throw new ApiException(404, "Sale not found");
        return shortfalls(mats);
    }

    /**
     * Sale documents. visibleProjectScope null = admin (all sites). Otherwise sites are limited to projects
     * coordinated by that employee; the whole document (items, totals) stays visible per the disclosed behaviour.
     */
    public List<Map<String, Object>> sales(Long onlyId, Long coordinatorEmployeeId, boolean scoped, Long projectId, Long siteId) {
        Map<Long, String> names = materialNames(); Map<Long, String> hsn = materialHsn(); Map<Long, Map<String, Object>> vendors = vendorMap();
        Map<Long, Map<String, Object>> sites = new HashMap<>();
        jdbc.sql("""
                select s.id,s.name,s.project_id,p.name project_name,p.coordinator_id from sites s join projects p on p.id=s.project_id""").query().listOfRows()
                .forEach(r -> sites.put(((Number) r.get("id")).longValue(), r));
        java.util.function.Predicate<Long> visible = sid -> {
            Map<String, Object> r = sites.get(sid);
            if (r == null) return false;
            return !scoped || (coordinatorEmployeeId != null && coordinatorEmployeeId.equals(((Number) r.get("coordinator_id")).longValue()));
        };
        List<Map<String, Object>> rows = jdbc.sql("""
                select id,sale_code,sale_type,sale_date,vendor_id,active_from from sales s
                where deleted_at is null and (:only::bigint is null or id=:only)
                  and (:pid::bigint is null or exists(select 1 from sale_sites ss join sites st on st.id=ss.site_id where ss.sale_id=s.id and st.project_id=:pid))
                  and (:sid::bigint is null or exists(select 1 from sale_sites ss where ss.sale_id=s.id and ss.site_id=:sid))
                order by sale_date desc,id desc""").param("only", onlyId).param("pid", projectId).param("sid", siteId).query().listOfRows();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            long id = ((Number) r.get("id")).longValue();
            List<Long> allIds = jdbc.sql("select site_id from sale_sites where sale_id=:id order by site_id").param("id", id).query(Long.class).list();
            List<Long> vis = allIds.stream().filter(visible).toList();
            if (scoped && vis.isEmpty()) continue; // not linked to anything this coordinator owns
            Map<String, Object> o = new LinkedHashMap<>();
            Map<String, Object> v = vendors.get(((Number) r.get("vendor_id")).longValue());
            o.put("id", id); o.put("saleId", r.get("sale_code")); o.put("type", r.get("sale_type")); o.put("date", r.get("sale_date").toString());
            o.put("vendor", v.get("name")); o.put("vendorInfo", Map.of("mobile", v.get("mobile"), "gst", v.get("gst"), "address", v.get("address"))); o.put("siteIds", vis); o.put("sites", siteRefs(vis, sites));
            o.put("activeFrom", iso(r.get("active_from")));
            o.put("items", jdbc.sql("select material_type_id,uom,qty,rate,gst,group_line,group_id,group_name,group_qty,group_per from sale_items where sale_id=:id order by position").param("id", id).query().listOfRows()
                    .stream().map(i -> itemOut(i, names, hsn)).toList());
            List<Map<String, Object>> vers = new ArrayList<>();
            for (Map<String, Object> vr : jdbc.sql("select version,active_from,active_to,snapshot::text snap from sale_versions where sale_id=:id order by version desc").param("id", id).query().listOfRows()) {
                Map<String, Object> sn = fromJson((String) vr.get("snap"));
                List<Long> vs = ((List<?>) sn.get("siteIds")).stream().map(x -> ((Number) x).longValue()).filter(visible).toList();
                Map<String, Object> x = new LinkedHashMap<>();
                x.put("version", vr.get("version")); x.put("activeFrom", iso(vr.get("active_from"))); x.put("activeTo", iso(vr.get("active_to")));
                x.put("type", sn.get("type")); x.put("date", sn.get("date")); x.put("vendor", vendors.get(((Number) sn.get("vendorId")).longValue()).get("name"));
                x.put("siteIds", vs); x.put("sites", siteRefs(vs, sites));
                x.put("items", ((List<Map<String, Object>>) sn.get("items")).stream().map(i -> itemOut(i, names, hsn)).toList());
                vers.add(x);
            }
            o.put("versions", vers);
            out.add(o);
        }
        return out;
    }

    private List<Map<String, Object>> siteRefs(List<Long> ids, Map<Long, Map<String, Object>> sites) {
        List<Map<String, Object>> l = new ArrayList<>();
        for (Long id : ids) { Map<String, Object> r = sites.get(id); if (r == null) continue;
            Map<String, Object> m = new LinkedHashMap<>(); m.put("id", id); m.put("name", r.get("name")); m.put("projectId", r.get("project_id")); m.put("projectName", r.get("project_name")); l.add(m); }
        return l;
    }

    public Map<String, Object> saleFull(long id, AppPrincipal scopedTo) {
        boolean scoped = scopedTo != null && !scopedTo.hasRole("ADMIN");
        List<Map<String, Object>> l = sales(id, scopedTo == null ? null : scopedTo.employeeId(), scoped, null, null);
        if (l.isEmpty()) throw new ApiException(404, "Sale not found");
        return l.get(0);
    }

    public List<Map<String, Object>> allSites() {
        return jdbc.sql("select s.id,s.name,s.project_id as project_id,p.name as project_name from sites s join projects p on p.id=s.project_id order by lower(p.name),lower(s.name)").query().listOfRows().stream().map(r -> { Map<String, Object> m = new LinkedHashMap<>(); m.put("id", r.get("id")); m.put("name", r.get("name")); m.put("projectId", r.get("project_id")); m.put("projectName", r.get("project_name")); return m; }).toList();
    }

    // ---------- stored challans ----------
    /** Draws the challan from the sale's current data (all sites), stores the PDF and the data it was drawn from. Older PDFs stay. */
    @Transactional
    public Map<String, Object> storeChallan(long saleId, String reason, Long userId) {
        jdbc.sql("select id from sales where id=:id for update").param("id", saleId).query(Long.class).optional(); // one writer per sale keeps seq gap-free
        Map<String, Object> sale = new LinkedHashMap<>(saleFull(saleId, null));
        sale.remove("versions");
        Map<String, Object> vendor = vendors().stream().filter(v -> v.get("name").equals(sale.get("vendor"))).findFirst().orElseThrow();
        Map<String, Object> company = company();
        byte[] pdf = ChallanPdf.build(sale, vendor, company);
        Map<String, Object> snap = new LinkedHashMap<>(); snap.put("sale", sale); snap.put("vendor", vendor); snap.put("company", company);
        int seq = jdbc.sql("select coalesce(max(seq),0)+1 from sale_challans where sale_id=:id").param("id", saleId).query(Integer.class).single();
        jdbc.sql("insert into sale_challans(sale_id,seq,reason,created_by,pdf,snapshot) values(:id,:q,:r,:u,:p,cast(:s as jsonb))")
                .param("id", saleId).param("q", seq).param("r", reason).param("u", userId).param("p", pdf).param("s", toJson(snap)).update();
        return challanHistory(saleId).get(0);
    }

    /** Newest first. Admin only at the controller. */
    public List<Map<String, Object>> challanHistory(long saleId) {
        return jdbc.sql("select seq,reason,created_at,created_by from sale_challans where sale_id=:id order by seq desc").param("id", saleId).query().listOfRows().stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>(); m.put("seq", r.get("seq")); m.put("reason", r.get("reason")); m.put("createdAt", iso(r.get("created_at"))); return m; }).toList();
    }

    @Transactional
    public List<Map<String, Object>> regenerateChallan(long saleId, AppPrincipal user) {
        if (!user.hasRole("ADMIN")) throw new ApiException(403, "Only an admin can regenerate a challan");
        saleFull(saleId, null); // 404 for a missing or deleted sale
        storeChallan(saleId, "REGENERATED", user.id());
        return challanHistory(saleId);
    }

    /**
     * The stored challan. Admin: the stored PDF bytes (latest, or an older one by seq). Coordinator: latest only, drawn again from the
     * stored data with only the sites of their own projects; 404 when the sale has none of their sites.
     */
    @SuppressWarnings("unchecked")
    public byte[] challanPdf(long saleId, AppPrincipal user, Integer seq) {
        boolean admin = user.hasRole("ADMIN");
        Map<String, Object> visible = saleFull(saleId, user); // 404 for a coordinator with no linked site
        if (!admin && seq != null) throw new ApiException(403, "Not allowed");
        List<Map<String, Object>> rows = jdbc.sql("select pdf,snapshot::text snap from sale_challans where sale_id=:id and (:q::int is null or seq=:q) order by seq desc limit 1")
                .param("id", saleId).param("q", seq).query().listOfRows();
        if (rows.isEmpty()) {
            if (seq != null) throw new ApiException(404, "Challan version not found");
            Map<String, Object> sale = new LinkedHashMap<>(visible); // not stored yet (legacy row): draw from current data, nothing is written here
            Map<String, Object> vendor = vendors().stream().filter(v -> v.get("name").equals(sale.get("vendor"))).findFirst().orElseThrow();
            return ChallanPdf.build(sale, vendor, company());
        }
        if (admin) return (byte[]) rows.get(0).get("pdf");
        Map<String, Object> snap = fromJson((String) rows.get(0).get("snap"));
        Map<String, Object> sale = new LinkedHashMap<>((Map<String, Object>) snap.get("sale"));
        Set<Long> ok = ((List<?>) visible.get("siteIds")).stream().map(x -> ((Number) x).longValue()).collect(Collectors.toSet());
        sale.put("sites", ((List<Map<String, Object>>) sale.get("sites")).stream().filter(x -> ok.contains(((Number) x.get("id")).longValue())).toList());
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> i : (List<Map<String, Object>>) sale.get("items")) {
            Map<String, Object> m = new LinkedHashMap<>(i);
            for (String k : new String[]{"qty", "rate", "gst"}) m.put(k, new BigDecimal(String.valueOf(i.get(k))));
            items.add(m);
        }
        sale.put("items", items);
        return ChallanPdf.build(sale, (Map<String, Object>) snap.get("vendor"), (Map<String, Object>) snap.get("company"));
    }

    /** One-time catch-up after upgrade: sales saved before challans were stored get a first stored challan from their current data. */
    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void backfillChallans() {
        for (Long id : jdbc.sql("select id from sales s where deleted_at is null and not exists(select 1 from sale_challans c where c.sale_id=s.id) order by id").query(Long.class).list())
            try { storeChallan(id, "BACKFILL", null); } catch (RuntimeException e) { /* another instance made it first (unique sale_id+seq); nothing to do */ }
    }
}
