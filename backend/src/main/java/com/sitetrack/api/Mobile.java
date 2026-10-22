package com.sitetrack.api;

/** Normalizes mobile numbers to a canonical +<country><number> form. Indian numbers need 10 digits starting 6-9. */
public final class Mobile {
    private Mobile() {}

    /** Returns the canonical number or null when it is not a valid mobile number. */
    public static String normalizeOrNull(String raw) {
        if (raw == null) return null;
        String s = raw.trim().replaceAll("[\\s\\-().]", "");
        if (s.isEmpty()) return null;
        boolean plus = s.startsWith("+");
        String digits = plus ? s.substring(1) : s;
        if (!digits.matches("[0-9]+")) return null;
        if (plus) {
            if (digits.startsWith("91")) return digits.matches("91[6-9][0-9]{9}") ? "+" + digits : null;
            return digits.matches("[0-9]{8,15}") ? "+" + digits : null;
        }
        if (digits.startsWith("00")) return normalizeOrNull("+" + digits.substring(2));
        if (digits.matches("[6-9][0-9]{9}")) return "+91" + digits;
        if (digits.matches("0[6-9][0-9]{9}")) return "+91" + digits.substring(1);
        if (digits.matches("91[6-9][0-9]{9}")) return "+" + digits;
        return null;
    }

    public static String normalize(String raw) {
        String m = normalizeOrNull(raw);
        if (m == null) throw new ApiException(400, "Enter a valid mobile number (10 digits, with or without +91)");
        return m;
    }
}
