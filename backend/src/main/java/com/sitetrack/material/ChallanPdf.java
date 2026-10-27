package com.sitetrack.material;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import com.sitetrack.material.MaterialDtos.Item;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Delivery / receipt challan. One conventional header row; header repeats on each page. */
final class ChallanPdf {
    private ChallanPdf() {}
    static String money(BigDecimal v) { return new DecimalFormat("#,##,##0.00", DecimalFormatSymbols.getInstance(Locale.ENGLISH)).format(v); }
    static String inr(BigDecimal v) {
        // Indian digit grouping
        String s = v.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
        String[] p = s.split("\\."); String ip = p[0]; boolean neg = ip.startsWith("-"); if (neg) ip = ip.substring(1);
        String last3 = ip.length() > 3 ? ip.substring(ip.length() - 3) : ip; String rest = ip.length() > 3 ? ip.substring(0, ip.length() - 3) : "";
        StringBuilder sb = new StringBuilder();
        while (rest.length() > 2) { sb.insert(0, "," + rest.substring(rest.length() - 2)); rest = rest.substring(0, rest.length() - 2); }
        sb.insert(0, rest); String g = sb.length() > 0 ? sb + "," + last3 : last3;
        return (neg ? "-" : "") + g + "." + p[1];
    }
    static String plain(BigDecimal v) { return v.stripTrailingZeros().toPlainString(); }

    @SuppressWarnings("unchecked")
    static byte[] build(Map<String, Object> sale, Map<String, Object> vendor, Map<String, Object> company) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            Document doc = new Document(PageSize.A4, 40, 40, 40, 50);
            PdfWriter.getInstance(doc, out);
            doc.open();
            Font h1 = new Font(Font.HELVETICA, 17, Font.BOLD), b9 = new Font(Font.HELVETICA, 9, Font.BOLD), n9 = new Font(Font.HELVETICA, 9),
                 b10 = new Font(Font.HELVETICA, 10, Font.BOLD), t13 = new Font(Font.HELVETICA, 13, Font.BOLD), b11 = new Font(Font.HELVETICA, 11, Font.BOLD);
            doc.add(new Paragraph(String.valueOf(company.get("name")), h1));
            doc.add(new Paragraph(String.valueOf(company.get("address")), n9));
            doc.add(new Paragraph("GSTIN: " + dash(company.get("gst")) + "    Mobile: " + dash(company.get("mobile")), n9));
            doc.add(rule());
            boolean debit = "DEBIT".equals(sale.get("type"));
            doc.add(new Paragraph(debit ? "DELIVERY CHALLAN  (Debit - material given out)" : "MATERIAL RECEIPT CHALLAN  (Credit - material taken in)", t13));
            String d = String.valueOf(sale.get("date")); String[] dp = d.split("-");
            Paragraph meta = new Paragraph("Challan no: " + sale.get("saleId") + "      Date: " + dp[2] + "/" + dp[1] + "/" + dp[0], b10);
            meta.setSpacingBefore(6); doc.add(meta);
            Paragraph pv = new Paragraph("Party (vendor)", b9); pv.setSpacingBefore(6); doc.add(pv);
            doc.add(new Paragraph(String.valueOf(vendor.get("name")), new Font(Font.HELVETICA, 10)));
            doc.add(new Paragraph("Mobile: " + dash(vendor.get("mobile")) + "    GSTIN: " + dash(vendor.get("gst")), n9));
            doc.add(new Paragraph("Address: " + dash(vendor.get("address")), n9));
            Paragraph st = new Paragraph("Sites", b9); st.setSpacingBefore(6); doc.add(st);
            for (Map<String, Object> s : (List<Map<String, Object>>) sale.get("sites")) doc.add(new Paragraph(s.get("name") + " | " + s.get("projectName"), n9));
            Paragraph gap = new Paragraph(" ", new Font(Font.HELVETICA, 4)); doc.add(gap); doc.add(rule());

            PdfPTable t = new PdfPTable(new float[]{27, 13, 11, 7, 14, 10, 10, 14});
            t.setWidthPercentage(100); t.setSpacingBefore(6); t.setHeaderRows(1); t.setSplitRows(false);
            String[] heads = {"Item", "Qty", "Rate", "GST%", "Amount", "SGST", "CGST", "Total"};
            for (int i = 0; i < heads.length; i++) t.addCell(cell(heads[i], b9, i == 0 ? Element.ALIGN_LEFT : Element.ALIGN_RIGHT, true));
            BigDecimal sub = BigDecimal.ZERO, sg = BigDecimal.ZERO, cg = BigDecimal.ZERO, tot = BigDecimal.ZERO;
            for (Map<String, Object> l : (List<Map<String, Object>>) sale.get("items")) {
                Item it = new Item((String) l.get("material"), (String) l.get("uom"), (BigDecimal) l.get("qty"), (BigDecimal) l.get("rate"), (BigDecimal) l.get("gst"));
                Map<String, BigDecimal> c = MaterialService.calc(it);
                sub = sub.add(c.get("subtotal")); sg = sg.add(c.get("sgst")); cg = cg.add(c.get("cgst")); tot = tot.add(c.get("total"));
                t.addCell(cell(it.material(), b9, Element.ALIGN_LEFT, false));
                t.addCell(cell(plain(it.qty()) + " " + it.uom(), n9, Element.ALIGN_RIGHT, false));
                t.addCell(cell(inr(it.rate()), n9, Element.ALIGN_RIGHT, false));
                t.addCell(cell(plain(it.gst()), n9, Element.ALIGN_RIGHT, false));
                t.addCell(cell(inr(c.get("subtotal")), n9, Element.ALIGN_RIGHT, false));
                t.addCell(cell(inr(c.get("sgst")), n9, Element.ALIGN_RIGHT, false));
                t.addCell(cell(inr(c.get("cgst")), n9, Element.ALIGN_RIGHT, false));
                t.addCell(cell(inr(c.get("total")), n9, Element.ALIGN_RIGHT, false));
            }
            t.addCell(cell("All items", b9, Element.ALIGN_LEFT, true));
            for (String x : new String[]{"", "", ""}) t.addCell(cell(x, b9, Element.ALIGN_RIGHT, true));
            for (BigDecimal v : new BigDecimal[]{sub, sg, cg, tot}) t.addCell(cell(inr(v), b9, Element.ALIGN_RIGHT, true));
            doc.add(t);
            Paragraph g = new Paragraph("Grand total (amount + SGST + CGST): Rs. " + inr(tot), b11); g.setSpacingBefore(10); doc.add(g);
            PdfPTable sig = new PdfPTable(2); sig.setWidthPercentage(100); sig.setSpacingBefore(40); sig.setKeepTogether(true);
            PdfPCell a = new PdfPCell(new Phrase("Received by: ______________________", n9)); a.setBorder(0);
            PdfPCell b = new PdfPCell(new Phrase("For " + company.get("name"), b9)); b.setBorder(0); b.setHorizontalAlignment(Element.ALIGN_RIGHT);
            sig.addCell(a); sig.addCell(b); doc.add(sig);
            doc.close();
            return out.toByteArray();
        } catch (DocumentException e) { throw new IllegalStateException(e); }
    }
    static String dash(Object o) { return o == null || o.toString().isBlank() ? "-" : o.toString(); }
    static Paragraph rule() { Paragraph p = new Paragraph(new Chunk(new com.lowagie.text.pdf.draw.LineSeparator(0.6f, 100, Color.BLACK, Element.ALIGN_CENTER, -2))); return p; }
    static PdfPCell cell(String s, Font f, int align, boolean head) {
        PdfPCell c = new PdfPCell(new Phrase(s, f)); c.setHorizontalAlignment(align); c.setPadding(3);
        c.setBorder(head ? Rectangle.TOP | Rectangle.BOTTOM : Rectangle.BOTTOM); c.setBorderWidth(head ? 0.6f : 0.3f);
        c.setBorderColor(head ? Color.BLACK : new Color(200, 200, 200)); return c;
    }
}
