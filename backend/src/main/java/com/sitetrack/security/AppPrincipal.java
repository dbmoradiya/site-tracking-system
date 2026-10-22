package com.sitetrack.security;

public record AppPrincipal(long id, Long employeeId, String name, String email, String role) {}
