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

    private static Image logo() {
        try (java.io.InputStream in = ChallanPdf.class.getResourceAsStream("/branding/shreeji-logo.png")) {
            return in == null ? null : Image.getInstance(in.readAllBytes());
        } catch (Exception e) { return null; }
    }

    @SuppressWarnings("unchecked")
    static byte[] build(Map<String, Object> sale, Map<String, Object> vendor, Map<String, Object> company) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            Document doc = new Document(PageSize.A4, 40, 40, 40, 50);
            PdfWriter.getInstance(doc, out);
            doc.open();
            Font h1 = new Font(Font.HELVETICA, 17, Font.BOLD), b9 = new Font(Font.HELVETICA, 9, Font.BOLD), n9 = new Font(Font.HELVETICA, 9),
                 b10 = new Font(Font.HELVETICA, 10, Font.BOLD), t13 = new Font(Font.HELVETICA, 13, Font.BOLD), b11 = new Font(Font.HELVETICA, 11, Font.BOLD);
            PdfPTable head = new PdfPTable(new float[]{70, 30}); head.setWidthPercentage(100);
            PdfPCell left = new PdfPCell(); left.setBorder(Rectangle.NO_BORDER); left.setPadding(0);
            left.addElement(new Paragraph(String.valueOf(company.get("name")), h1));
            left.addElement(new Paragraph(String.valueOf(company.get("address")), n9));
            left.addElement(new Paragraph("GSTIN: " + dash(company.get("gst")) + "    Mobile: " + dash(company.get("mobile")), n9));
            head.addCell(left);
            PdfPCell right = new PdfPCell(); right.setBorder(Rectangle.NO_BORDER); right.setPadding(0); right.setHorizontalAlignment(Element.ALIGN_RIGHT);
            Image logo = logo(); if (logo != null) { logo.scaleToFit(110, 70); logo.setAlignment(Image.ALIGN_RIGHT); right.addElement(logo); }
            head.addCell(right); doc.add(head);
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

            PdfPTable t = new PdfPTable(new float[]{24, 10, 12, 10, 7, 13, 9, 9, 13});
            t.setWidthPercentage(100); t.setSpacingBefore(6); t.setHeaderRows(1); t.setSplitRows(false);
            String[] heads = {"Item", "HSN", "Qty", "Rate", "GST%", "Amount", "SGST", "CGST", "Total"};
            for (int i = 0; i < heads.length; i++) t.addCell(cell(heads[i], b9, i <= 1 ? Element.ALIGN_LEFT : Element.ALIGN_RIGHT, true));
            BigDecimal sub = BigDecimal.ZERO, sg = BigDecimal.ZERO, cg = BigDecimal.ZERO, tot = BigDecimal.ZERO;
            List<Map<String, Object>> all = (List<Map<String, Object>>) sale.get("items");
            int openGroup = 0; BigDecimal gsub = BigDecimal.ZERO, gsg = BigDecimal.ZERO, gcg = BigDecimal.ZERO, gtot = BigDecimal.ZERO; String gname = "";
            for (int idx = 0; idx < all.size(); idx++) {
                Map<String, Object> l = all.get(idx);
                int gl = l.get("groupLine") == null ? 0 : ((Number) l.get("groupLine")).intValue();
                if (openGroup != 0 && gl != openGroup) {
                    groupTotal(t, gname, gsub, gsg, gcg, gtot, n9);
                    openGroup = 0; gsub = gsg = gcg = gtot = BigDecimal.ZERO;
                }
                if (gl != 0 && openGroup == 0) {
                    openGroup = gl; gname = String.valueOf(l.get("groupName"));
                    StringBuilder parts = new StringBuilder();
                    for (Map<String, Object> k : all) if (k.get("groupLine") != null && ((Number) k.get("groupLine")).intValue() == gl) {
                        if (parts.length() > 0) parts.append(" + ");
                        parts.append(plain(new BigDecimal(String.valueOf(k.get("groupPer"))))).append(' ').append(k.get("uom")).append(' ').append(k.get("material"));
                    }
                    PdfPCell h = new PdfPCell(new Phrase(gname + " x " + plain(new BigDecimal(String.valueOf(l.get("groupQty")))) + "    (1 " + gname + " = " + parts + ")", b9));
                    h.setColspan(9); h.setPadding(3); h.setBackgroundColor(new Color(238, 238, 238)); h.setBorder(Rectangle.BOTTOM); h.setBorderWidth(0.3f); h.setBorderColor(new Color(200, 200, 200));
                    t.addCell(h);
                }
                Item it = new Item((String) l.get("material"), (String) l.get("uom"), (BigDecimal) l.get("qty"), (BigDecimal) l.get("rate"), (BigDecimal) l.get("gst"));
                Map<String, BigDecimal> c = MaterialService.calc(it);
                sub = sub.add(c.get("subtotal")); sg = sg.add(c.get("sgst")); cg = cg.add(c.get("cgst")); tot = tot.add(c.get("total"));
                if (gl != 0) { gsub = gsub.add(c.get("subtotal")); gsg = gsg.add(c.get("sgst")); gcg = gcg.add(c.get("cgst")); gtot = gtot.add(c.get("total")); }
                PdfPCell nameCell = cell(it.material(), b9, Element.ALIGN_LEFT, false);
                if (gl != 0) nameCell.setPaddingLeft(14);
                t.addCell(nameCell);
                t.addCell(cell(dash(l.get("hsn")), n9, Element.ALIGN_LEFT, false));
                t.addCell(cell(plain(it.qty()) + " " + it.uom(), n9, Element.ALIGN_RIGHT, false));
                t.addCell(cell(inr(it.rate()), n9, Element.ALIGN_RIGHT, false));
                t.addCell(cell(plain(it.gst()), n9, Element.ALIGN_RIGHT, false));
                t.addCell(cell(inr(c.get("subtotal")), n9, Element.ALIGN_RIGHT, false));
                t.addCell(cell(inr(c.get("sgst")), n9, Element.ALIGN_RIGHT, false));
                t.addCell(cell(inr(c.get("cgst")), n9, Element.ALIGN_RIGHT, false));
                t.addCell(cell(inr(c.get("total")), n9, Element.ALIGN_RIGHT, false));
            }
            if (openGroup != 0) groupTotal(t, gname, gsub, gsg, gcg, gtot, n9);
            t.addCell(cell("All items", b9, Element.ALIGN_LEFT, true));
            for (String x : new String[]{"", "", "", ""}) t.addCell(cell(x, b9, Element.ALIGN_RIGHT, true));
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
    static void groupTotal(PdfPTable t, String name, BigDecimal sub, BigDecimal sg, BigDecimal cg, BigDecimal tot, Font f) {
        Font it = new Font(Font.HELVETICA, 9, Font.ITALIC);
        t.addCell(cell(name + " subtotal", it, Element.ALIGN_LEFT, false));
        for (int i = 0; i < 4; i++) t.addCell(cell("", f, Element.ALIGN_RIGHT, false));
        for (BigDecimal v : new BigDecimal[]{sub, sg, cg, tot}) t.addCell(cell(inr(v), it, Element.ALIGN_RIGHT, false));
    }
    static String dash(Object o) { return o == null || o.toString().isBlank() ? "-" : o.toString(); }
    static Paragraph rule() { Paragraph p = new Paragraph(new Chunk(new com.lowagie.text.pdf.draw.LineSeparator(0.6f, 100, Color.BLACK, Element.ALIGN_CENTER, -2))); return p; }
    static PdfPCell cell(String s, Font f, int align, boolean head) {
        PdfPCell c = new PdfPCell(new Phrase(s, f)); c.setHorizontalAlignment(align); c.setPadding(3);
        c.setBorder(head ? Rectangle.TOP | Rectangle.BOTTOM : Rectangle.BOTTOM); c.setBorderWidth(head ? 0.6f : 0.3f);
        c.setBorderColor(head ? Color.BLACK : new Color(200, 200, 200)); return c;
    }
}
