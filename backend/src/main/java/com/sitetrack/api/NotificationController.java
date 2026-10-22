package com.sitetrack.api;

import com.sitetrack.security.AppPrincipal;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final JdbcClient jdbc;

    public NotificationController(JdbcClient jdbc) { this.jdbc=jdbc; }

    @GetMapping
    public List<Map<String,Object>> list(@AuthenticationPrincipal AppPrincipal user) {
        String condition=user.hasRole("ADMIN")
                ? "(ss.status='REVIEW_PENDING' or ss.supervisor_id is null or ss.team_id is null)"
                : "((p.coordinator_id=:employeeId and (ss.status='REVIEW_PENDING' or ss.supervisor_id is null or ss.team_id is null)) " +
                  "or (ss.supervisor_id=:employeeId and ss.status in ('READY','IN_PROGRESS','CHANGES_REQUESTED')))";
        JdbcClient.StatementSpec spec=jdbc.sql("""
                select ss.id stage_id,ss.name stage_name,ss.status,ss.updated_at,ss.supervisor_id,ss.team_id,s.id site_id,s.name site_name,
                       p.id project_id,p.name project_name
                from site_stages ss join sites s on s.id=ss.site_id join projects p on p.id=s.project_id
                where %s order by ss.updated_at desc limit 25
                """.formatted(condition));
        if(!user.hasRole("ADMIN")) spec=spec.param("employeeId",user.employeeId());
        return spec.query((rs,n)->{
            String status=rs.getString("status");
            Map<String,Object> row=new LinkedHashMap<>();
            row.put("stageId",rs.getLong("stage_id")); row.put("stageName",rs.getString("stage_name"));
            row.put("siteId",rs.getLong("site_id")); row.put("siteName",rs.getString("site_name"));
            row.put("projectId",rs.getLong("project_id")); row.put("projectName",rs.getString("project_name"));
            row.put("status",status); row.put("updatedAt",rs.getTimestamp("updated_at").toInstant());
            String title;
            if("REVIEW_PENDING".equals(status)) title="Approval requested";
            else if(rs.getObject("supervisor_id")==null || rs.getObject("team_id")==null) title="Assignment required";
            else if("CHANGES_REQUESTED".equals(status)) title="Evidence needs changes";
            else title="Evidence action required";
            row.put("title",title);
            row.put("actionLabel","Open project"); return row;
        }).list();
    }
}
