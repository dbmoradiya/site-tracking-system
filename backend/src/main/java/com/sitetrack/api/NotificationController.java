package com.sitetrack.api;

import com.sitetrack.security.AppPrincipal;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private static final Set<String> TYPES=Set.of("APPROVAL_REQUEST","MISSING_ASSIGNMENT","NO_ROLE_ACTION","CHANGES_REQUESTED","ASSIGNED_WORK");
    private static final Set<String> STATUSES=Set.of("NOT_STARTED","READY","IN_PROGRESS","REVIEW_PENDING","CHANGES_REQUESTED","BLOCKED");
    private final JdbcClient jdbc;

    public NotificationController(JdbcClient jdbc) { this.jdbc=jdbc; }

    @GetMapping
    public Map<String,Object> list(@AuthenticationPrincipal AppPrincipal user,
                                   @RequestParam(defaultValue="0") int page,
                                   @RequestParam(defaultValue="20") int size,
                                   @RequestParam(defaultValue="") String type,
                                   @RequestParam(defaultValue="") String status,
                                   @RequestParam(defaultValue="") String search) {
        if(page<0) throw new ApiException(400,"Page must be zero or greater");
        if(size<1 || size>100) throw new ApiException(400,"Page size must be between 1 and 100");
        type=type.trim().toUpperCase(); status=status.trim().toUpperCase(); search=search.trim();
        if(!type.isEmpty() && !TYPES.contains(type)) throw new ApiException(400,"Invalid notification type");
        if(!status.isEmpty() && !STATUSES.contains(status)) throw new ApiException(400,"Invalid Stage status");

        String cte="""
                with stage_context as (
                  select ss.id stage_id,ss.name stage_name,ss.status,ss.updated_at,s.id site_id,s.name site_name,
                         p.id project_id,p.name project_name,
                         (:isAdmin or p.coordinator_id=:employeeId) manager,
                         exists(select 1 from site_stage_required_roles rr join site_stage_role_assignments sra
                           on sra.stage_id=rr.stage_id and sra.role_code=rr.role_code
                           where rr.stage_id=ss.id and sra.employee_id=:employeeId) assigned,
                         (select count(*) from site_stage_required_roles rr where rr.stage_id=ss.id) required_count,
                         (select count(*) from site_stage_required_roles rr left join site_stage_role_assignments sra
                           on sra.stage_id=rr.stage_id and sra.role_code=rr.role_code
                           where rr.stage_id=ss.id and sra.employee_id is null and sra.team_id is null) missing_count,
                         (select count(*) from evidence ev where ev.stage_id=ss.id and ev.upload_status='UPLOADED') evidence_count
                  from site_stages ss join sites s on s.id=ss.site_id join projects p on p.id=s.project_id
                ), pending as (
                  select *, case
                    when manager and status='REVIEW_PENDING' then 'APPROVAL_REQUEST'
                    when manager and status not in ('APPROVED','COMPLETED') and required_count>0 and missing_count>0 then 'MISSING_ASSIGNMENT'
                    when manager and status in ('NOT_STARTED','READY','IN_PROGRESS') and required_count=0 then 'NO_ROLE_ACTION'
                    when assigned and status='CHANGES_REQUESTED' then 'CHANGES_REQUESTED'
                    when assigned and status in ('READY','IN_PROGRESS') then 'ASSIGNED_WORK'
                  end notification_type
                  from stage_context
                  where (manager and status='REVIEW_PENDING')
                     or (manager and status not in ('APPROVED','COMPLETED') and required_count>0 and missing_count>0)
                     or (manager and status in ('NOT_STARTED','READY','IN_PROGRESS') and required_count=0)
                     or (assigned and status in ('READY','IN_PROGRESS','CHANGES_REQUESTED'))
                )
                """;
        String filters="""
                where (:type='' or notification_type=:type) and (:status='' or status=:status)
                  and (:search='' or lower(project_name||' '||site_name||' '||stage_name) like lower('%'||:search||'%'))
                """;
        long employeeId=user.employeeId()==null ? -1 : user.employeeId();
        long total=parameters(jdbc.sql(cte+"select count(*) from pending "+filters),user,employeeId,type,status,search)
                .query(Long.class).single();
        List<Map<String,Object>> items=parameters(jdbc.sql(cte+"select * from pending "+filters+
                " order by updated_at desc,stage_id desc limit :size offset :offset"),user,employeeId,type,status,search)
                .param("size",size).param("offset",page*size).query((rs,n)->{
                    String notificationType=rs.getString("notification_type");
                    long evidenceCount=rs.getLong("evidence_count");
                    Map<String,Object> row=new LinkedHashMap<>();
                    row.put("stageId",rs.getLong("stage_id")); row.put("stageName",rs.getString("stage_name"));
                    row.put("siteId",rs.getLong("site_id")); row.put("siteName",rs.getString("site_name"));
                    row.put("projectId",rs.getLong("project_id")); row.put("projectName",rs.getString("project_name"));
                    row.put("status",rs.getString("status")); row.put("updatedAt",rs.getTimestamp("updated_at").toInstant());
                    row.put("type",notificationType); row.put("title",title(notificationType,evidenceCount));
                    row.put("actionLabel",actionLabel(notificationType,evidenceCount));
                    return row;
                }).list();
        return Map.of("items",items,"total",total,"page",page,"size",size,
                "totalPages",total==0?0:(total+size-1)/size);
    }

    private JdbcClient.StatementSpec parameters(JdbcClient.StatementSpec spec,AppPrincipal user,long employeeId,
                                                  String type,String status,String search) {
        return spec.param("isAdmin",user.hasRole("ADMIN")).param("employeeId",employeeId)
                .param("type",type).param("status",status).param("search",search);
    }

    private String title(String type,long evidenceCount) {
        return switch(type) {
            case "APPROVAL_REQUEST" -> "Approval requested";
            case "MISSING_ASSIGNMENT" -> "Role assignment required";
            case "NO_ROLE_ACTION" -> evidenceCount==0 ? "Evidence required" : "Stage ready to complete";
            case "CHANGES_REQUESTED" -> "Evidence needs changes";
            default -> evidenceCount==0 ? "Stage ready for work" : "Stage ready to submit";
        };
    }

    private String actionLabel(String type,long evidenceCount) {
        return switch(type) {
            case "APPROVAL_REQUEST" -> "Review Stage";
            case "MISSING_ASSIGNMENT" -> "Assign roles";
            case "NO_ROLE_ACTION" -> evidenceCount==0 ? "Add evidence" : "Mark complete";
            case "CHANGES_REQUESTED" -> "Update evidence";
            default -> evidenceCount==0 ? "Add evidence" : "Submit Stage";
        };
    }
}
