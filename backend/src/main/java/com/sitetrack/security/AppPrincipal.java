package com.sitetrack.security;

import java.util.List;

public record AppPrincipal(long id, Long employeeId, String name, String email, List<String> roles) {
    public AppPrincipal {
        roles = List.copyOf(roles);
    }

    public boolean hasRole(String role) {
        return roles.contains(role);
    }

    /** Temporary compatibility helper while workflow authorization moves to capabilities. */
    public String role() {
        if (hasRole("ADMIN")) return "ADMIN";
        if (hasRole("COORDINATOR")) return "COORDINATOR";
        return roles.isEmpty() ? "" : roles.getFirst();
    }
}
