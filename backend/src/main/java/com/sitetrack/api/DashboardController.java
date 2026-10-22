package com.sitetrack.api;

import com.sitetrack.security.AppPrincipal;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final JdbcClient jdbc;

    public DashboardController(JdbcClient jdbc) { this.jdbc = jdbc; }

    @GetMapping
    public Map<String, Object> dashboard(@AuthenticationPrincipal AppPrincipal user) {
        String filter = user.hasRole("ADMIN") ? "" : """
                 where p.coordinator_id=:employeeId or exists (
                   select 1 from sites s join site_role_assignments sra on sra.site_id=s.id
                   where s.project_id=p.id and sra.employee_id=:employeeId)
                """;
        JdbcClient.StatementSpec spec = jdbc.sql("select status, count(*) total from projects p" + filter + " group by status");
        if (!user.hasRole("ADMIN")) spec = spec.param("employeeId", user.employeeId());
        List<Map<String, Object>> counts = spec.query((rs, n) -> Map.<String, Object>of(
                "status", rs.getString("status"), "total", rs.getLong("total"))).list();

        JdbcClient.StatementSpec recentSpec = jdbc.sql("""
                select p.id,p.name,p.customer_name,p.target_date,p.status,
                       count(distinct s.id) site_count,
                       count(distinct s.id) filter (where s.status='COMPLETED') completed_sites
                from projects p left join sites s on s.project_id=p.id
                """ + filter + " group by p.id order by p.updated_at desc limit 6");
        if (!user.hasRole("ADMIN")) recentSpec = recentSpec.param("employeeId", user.employeeId());
        List<Map<String, Object>> recent = recentSpec.query((rs, n) -> Map.<String, Object>of(
                "id", rs.getLong("id"), "name", rs.getString("name"),
                "customerName", rs.getString("customer_name"), "status", rs.getString("status"),
                "targetDate", rs.getObject("target_date") == null ? "" : rs.getDate("target_date").toLocalDate().toString(),
                "siteCount", rs.getLong("site_count"), "completedSites", rs.getLong("completed_sites"))).list();
        return Map.of("counts", counts, "recentProjects", recent);
    }
}
