package com.sitetrack.material;

import com.sitetrack.api.ApiException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Insert-only import. Each row commits independently; existing records are never edited. */
@Service
public class MaterialTypeCsvService {
    private final JdbcClient jdbc;
    private final TransactionTemplate rowTransaction;
    public MaterialTypeCsvService(JdbcClient jdbc, PlatformTransactionManager transactions) {
        this.jdbc = jdbc;
        rowTransaction = new TransactionTemplate(transactions);
        rowTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }
    public record RowResult(int row, String name, String status, String message) {}
    public record ImportResult(int total, int inserted, int skipped, int errors, List<RowResult> rows) {}
    private record CsvRow(int line, List<String> cells) {}

    public ImportResult importFile(MultipartFile file) {
        if (file == null || file.isEmpty()) throw bad("Choose a non-empty CSV file");
        if (file.getSize() > 1024 * 1024) throw bad("CSV file must be 1 MB or smaller");
        String text;
        try {
            text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(file.getBytes())).toString();
        } catch (CharacterCodingException e) { throw bad("CSV must use UTF-8 encoding"); }
        catch (IOException e) { throw bad("Could not read CSV file"); }
        if (text.startsWith("\uFEFF")) text = text.substring(1);
        // Parse the whole document before any writes: an ambiguous/broken quote cannot misalign rows.
        List<CsvRow> parsed = parse(text);
        if (parsed.isEmpty()) throw bad("CSV is empty");
        List<String> header = parsed.removeFirst().cells().stream().map(v -> v.trim().toLowerCase(Locale.ROOT)).toList();
        if (new HashSet<>(header).size() != header.size() || !header.containsAll(List.of("name", "uom"))
                || header.stream().anyMatch(h -> !Set.of("name", "uom", "hsn").contains(h)))
            throw bad("CSV headers must be name,uom,hsn (hsn is optional)");
        if (parsed.isEmpty()) throw bad("CSV has no material rows");
        if (parsed.size() > 5000) throw bad("CSV can contain at most 5000 material rows");
        List<RowResult> results = new ArrayList<>();
        for (CsvRow row : parsed) {
            String name = cell(row, header.indexOf("name")), uom = cell(row, header.indexOf("uom")), hsn = cell(row, header.indexOf("hsn"));
            String error = row.cells().size() != header.size() ? "Column count does not match the header"
                    : name.isEmpty() || name.length() > 180 ? "Material name is required (maximum 180 characters)"
                    : uom.isEmpty() || uom.length() > 32 ? "UOM is required (maximum 32 characters)"
                    : hsn.length() > 16 ? "HSN code can be at most 16 characters"
                    : name.indexOf('\0') >= 0 || uom.indexOf('\0') >= 0 || hsn.indexOf('\0') >= 0 ? "Values cannot contain NUL characters" : null;
            if (error != null) { results.add(new RowResult(row.line(), name, "error", error)); continue; }
            try {
                results.add(rowTransaction.execute(tx -> {
                    // ON CONFLICT also handles a concurrent create without aborting this row's transaction.
                    int added = jdbc.sql("insert into material_types(name,uom,hsn) values(:n,:u,:h) on conflict do nothing")
                            .param("n", name).param("u", uom).param("h", hsn).update();
                    if (added == 1) return new RowResult(row.line(), name, "inserted", "Added");
                    var existing = jdbc.sql("select uom,coalesce(hsn,'') hsn from material_types where lower(name)=lower(:n)")
                            .param("n", name).query().singleRow();
                    boolean same = uom.equalsIgnoreCase(existing.get("uom").toString().trim()) && hsn.equals(existing.get("hsn").toString().trim());
                    return new RowResult(row.line(), name, same ? "skipped" : "error", same ? "Already exists with the same UOM and HSN; unchanged"
                            : "Name already exists with different UOM or HSN (existing UOM: " + existing.get("uom") + ", HSN: " + (existing.get("hsn").toString().isEmpty() ? "blank" : existing.get("hsn")) + "); unchanged");
                }));
            } catch (DataIntegrityViolationException e) {
                results.add(new RowResult(row.line(), name, "error", "Could not insert this row; check its values and retry"));
            }
        }
        return new ImportResult(results.size(), count(results, "inserted"), count(results, "skipped"), count(results, "error"), results);
    }
    private static int count(List<RowResult> rows, String status) { return (int) rows.stream().filter(r -> r.status().equals(status)).count(); }
    private static String cell(CsvRow row, int index) { return index < 0 || index >= row.cells().size() ? "" : row.cells().get(index).trim(); }
    private static ApiException bad(String message) { return new ApiException(400, message); }

    /** RFC 4180-style commas, escaped quotes and quoted newlines; accepts LF, CRLF and CR. */
    static List<CsvRow> parse(String text) {
        List<CsvRow> rows = new ArrayList<>(); List<String> cells = new ArrayList<>(); StringBuilder value = new StringBuilder();
        boolean quoted = false, closed = false; int line = 1, start = 1;
        for (int i = 0; i <= text.length(); i++) {
            boolean eof = i == text.length(); char c = eof ? '\n' : text.charAt(i);
            if (quoted) {
                if (eof) throw bad("Unclosed quoted value at CSV row " + start + "; nothing imported");
                if (c == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') { value.append('"'); i++; }
                    else { quoted = false; closed = true; }
                } else { value.append(c); if (c == '\n' || c == '\r' && (i + 1 == text.length() || text.charAt(i + 1) != '\n')) line++; }
            } else if (c == ',' || c == '\n' || c == '\r') {
                cells.add(value.toString()); value.setLength(0); closed = false;
                if (c != ',') {
                    if (!(cells.size() == 1 && cells.getFirst().isBlank())) rows.add(new CsvRow(start, List.copyOf(cells)));
                    cells.clear(); if (!eof && c == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') i++;
                    line++; start = line;
                }
            } else if (c == '"' && value.length() == 0 && !closed) { quoted = true; }
            else {
                if (closed || c == '"') throw bad("Invalid CSV quoting at row " + start + "; nothing imported");
                value.append(c);
            }
        }
        return rows;
    }
}
