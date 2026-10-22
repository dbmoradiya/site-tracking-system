package com.sitetrack.api;

import com.sitetrack.security.AppPrincipal;
import com.sitetrack.service.WorkflowService;
import com.sitetrack.service.ProjectService;
import com.sitetrack.service.SiteAssignmentService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
    private final JdbcClient jdbc;
    private final WorkflowService workflow;
    private final ProjectService projects;
    private final SiteAssignmentService assignments;

    public ProjectController(JdbcClient jdbc, WorkflowService workflow,ProjectService projects,SiteAssignmentService assignments) {
        this.jdbc = jdbc;
        this.workflow = workflow;
        this.projects = projects;
        this.assignments = assignments;
    }

    @GetMapping
    public List<Map<String,Object>> list(@AuthenticationPrincipal AppPrincipal user) {
        String filter = user.hasRole("ADMIN") ? "" : """
                 where p.coordinator_id=:employeeId or exists(
                   select 1 from sites sx join site_role_assignments sra on sra.site_id=sx.id
                   where sx.project_id=p.id and sra.employee_id=:employeeId)
                """;
        JdbcClient.StatementSpec spec=jdbc.sql("""
                select p.id,p.name,p.customer_name,p.customer_mobile,p.address,p.target_date,p.status,
                       count(distinct s.id) site_count,
                       count(distinct s.id) filter(where s.status='COMPLETED') completed_sites,
                       pc.name coordinator,
                       coalesce((select string_agg(distinct sra.role_code||'::'||ea.name,'||')
                         from sites sa join site_role_assignments sra on sra.site_id=sa.id
                         join employees ea on ea.id=sra.employee_id where sa.project_id=p.id),'') assignment_pairs,
                       %s action_required
                from projects p join employees pc on pc.id=p.coordinator_id left join sites s on s.project_id=p.id
                """.formatted(actionRequiredExpression(user))+filter+" group by p.id,pc.name order by p.updated_at desc");
        if (!user.hasRole("ADMIN")) spec=spec.param("employeeId",user.employeeId());
        return spec.query((rs,n)->{
            Map<String,Object> row=new LinkedHashMap<>();
            row.put("id",rs.getLong("id")); row.put("name",rs.getString("name"));
            row.put("customerName",rs.getString("customer_name")); row.put("customerMobile",rs.getString("customer_mobile"));
            row.put("address",rs.getString("address")); row.put("targetDate",date(rs.getDate("target_date")));
            row.put("status",rs.getString("status")); row.put("siteCount",rs.getLong("site_count"));
            row.put("completedSites",rs.getLong("completed_sites"));
            row.put("coordinators",List.of(rs.getString("coordinator"))); row.put("assignments",assignmentPairs(rs.getString("assignment_pairs")));
            row.put("actionRequired",rs.getLong("action_required")); return row;
        }).list();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public Map<String,Object> create(@Valid @RequestBody ProjectRequest request,@AuthenticationPrincipal AppPrincipal user) {
        projects.requireCoordinator(request.coordinatorId());
        long id=jdbc.sql("""
                insert into projects(name,customer_name,customer_mobile,address,target_date,coordinator_id)
                values(:name,:customer,:mobile,:address,:target,:coordinator) returning id
                """).param("name",request.name()).param("customer",request.customerName())
                .param("mobile",request.customerMobile()).param("address",request.address())
                .param("target",request.targetDate()).param("coordinator",request.coordinatorId()).query(Long.class).single();
        jdbc.sql("insert into project_coordinator_history(project_id,new_employee_id,changed_by) values(:project,:new,:actor)")
                .param("project",id).param("new",request.coordinatorId()).param("actor",user.id()).update();
        return Map.of("id",id);
    }

    @GetMapping("/{id}")
    public Map<String,Object> detail(@PathVariable long id,@AuthenticationPrincipal AppPrincipal user) {
        workflow.requireProjectAccess(id,user);
        Map<String,Object> project=jdbc.sql("""
                select p.*,e.name coordinator_name from projects p join employees e on e.id=p.coordinator_id where p.id=:id
                """).param("id",id)
                .query((rs,n)->{
                    Map<String,Object> row=new LinkedHashMap<>();
                    row.put("id",rs.getLong("id")); row.put("name",rs.getString("name"));
                    row.put("customerName",rs.getString("customer_name")); row.put("customerMobile",rs.getString("customer_mobile"));
                    row.put("address",rs.getString("address")); row.put("targetDate",date(rs.getDate("target_date")));
                    row.put("status",rs.getString("status")); row.put("coordinatorId",rs.getLong("coordinator_id"));
                    row.put("coordinator",rs.getString("coordinator_name")); return row;
                }).optional().orElseThrow(()->new ApiException(404,"Project not found"));
        boolean projectManager=user.hasRole("ADMIN") || (user.employeeId()!=null && user.employeeId().equals(project.get("coordinatorId")));
        String siteFilter=projectManager ? "" :
                " and exists(select 1 from site_role_assignments access_role where access_role.site_id=s.id and access_role.employee_id=:employeeId)";
        JdbcClient.StatementSpec siteSpec=jdbc.sql("""
                select s.id,s.name,s.address,s.target_date,s.status,st.name site_type,
                       pc.name coordinator,
                       count(ss.id) stage_count,count(ss.id) filter(where ss.status in ('APPROVED','COMPLETED')) completed_stages
                from sites s join projects p on p.id=s.project_id join site_types st on st.id=s.site_type_id
                join employees pc on pc.id=p.coordinator_id
                left join site_stages ss on ss.site_id=s.id where s.project_id=:id
                """+siteFilter+"""
                group by s.id,st.name,pc.name order by s.created_at
                """).param("id",id);
        if(!projectManager) siteSpec=siteSpec.param("employeeId",user.employeeId());
        List<Map<String,Object>> sites=siteSpec.query((rs,n)->{
                    Map<String,Object> row=new LinkedHashMap<>();
                    row.put("id",rs.getLong("id")); row.put("name",rs.getString("name"));
                    row.put("address",rs.getString("address")); row.put("targetDate",date(rs.getDate("target_date")));
                    row.put("status",rs.getString("status")); row.put("siteType",rs.getString("site_type"));
                    row.put("coordinator",rs.getString("coordinator")); row.put("stageCount",rs.getLong("stage_count"));
                    row.put("completedStages",rs.getLong("completed_stages"));
                    row.put("canManage",projectManager); return row;
                }).list();
        project.put("sites",sites);
        project.put("coordinatorHistory",jdbc.sql("""
                select h.created_at,old_e.name old_coordinator,new_e.name new_coordinator,u.name changed_by
                from project_coordinator_history h left join employees old_e on old_e.id=h.old_employee_id
                join employees new_e on new_e.id=h.new_employee_id join app_users u on u.id=h.changed_by
                where h.project_id=:id order by h.created_at desc
                """).param("id",id).query((rs,n)->Map.<String,Object>of(
                        "oldCoordinator",rs.getString("old_coordinator")==null?"—":rs.getString("old_coordinator"),
                        "newCoordinator",rs.getString("new_coordinator"),"changedBy",rs.getString("changed_by"),
                        "changedAt",rs.getTimestamp("created_at").toInstant())).list());
        return project;
    }

    @PutMapping("/{id}/coordinator")
    @PreAuthorize("hasRole('ADMIN')")
    public void changeCoordinator(@PathVariable long id,@Valid @RequestBody CoordinatorRequest request,
                                  @AuthenticationPrincipal AppPrincipal user) {
        projects.changeCoordinator(id,request.coordinatorId(),user);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(@PathVariable long id) { projects.delete(id); }

    @PostMapping("/{projectId}/sites")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public Map<String,Object> createSite(@PathVariable long projectId,@Valid @RequestBody SiteRequest request,
                                         @AuthenticationPrincipal AppPrincipal user) {
        for (int i=0;i<request.stages().size();i++) {
            Integer dependency=request.stages().get(i).dependsOnPosition();
            if (dependency != null && (dependency < 1 || dependency > i))
                throw new ApiException(400,"A Stage can depend only on an earlier Stage");
        }
        boolean projectExists=jdbc.sql("select count(*) from projects where id=:id").param("id",projectId)
                .query(Long.class).single()>0;
        if(!projectExists) throw new ApiException(404,"Project not found");
        for(SiteStageRequest stage:request.stages())
            for(String role:stage.requiredRoles()) assignments.validate(role,null);
        long siteId=jdbc.sql("""
                insert into sites(project_id,site_type_id,team_id,name,address,target_date)
                values(:project,:type,:team,:name,:address,:target) returning id
                """).param("project",projectId).param("type",request.siteTypeId())
                .param("team",request.teamId())
                .param("name",request.name()).param("address",request.address()).param("target",request.targetDate())
                .query(Long.class).single();
        Map<Integer,Long> stageIds=new LinkedHashMap<>();
        for(int i=0;i<request.stages().size();i++) {
            SiteStageRequest stage=request.stages().get(i);
            long stageId=jdbc.sql("""
                    insert into site_stages(site_id,name,position,evidence_required,status)
                    values(:site,:name,:position,true,:status) returning id
                    """).param("site",siteId).param("name",stage.name()).param("position",i+1)
                    .param("status",stage.dependsOnPosition()==null ? "READY" : "BLOCKED").query(Long.class).single();
            stageIds.put(i+1,stageId);
            for(String role:stage.requiredRoles().stream().distinct().toList()) jdbc.sql(
                    "insert into site_stage_required_roles(stage_id,role_code) values(:stage,:role)")
                    .param("stage",stageId).param("role",role).update();
        }
        for(int i=0;i<request.stages().size();i++) {
            Integer dep=request.stages().get(i).dependsOnPosition();
            if(dep!=null && stageIds.containsKey(dep)) jdbc.sql("update site_stages set depends_on_stage_id=:dep where id=:id")
                    .param("dep",stageIds.get(dep)).param("id",stageIds.get(i+1)).update();
        }
        assignments.recordInitialTeam(siteId,request.teamId(),user);
        workflow.recalculate(siteId);
        return Map.of("id",siteId);
    }

    @GetMapping("/site-types/{typeId}/defaults")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String,Object>> defaults(@PathVariable long typeId) {
        return jdbc.sql("""
                select t.id,t.name,t.position,d.position depends_on_position,true evidence_required,
                  coalesce(array_agg(rr.role_code order by rr.role_code) filter(where rr.role_code is not null),array[]::varchar[]) required_roles
                from stage_templates t left join stage_templates d on d.id=t.depends_on_id
                left join stage_template_required_roles rr on rr.stage_template_id=t.id
                where t.site_type_id=:type group by t.id,d.position order by t.position
                """).param("type",typeId).query((rs,n)->{
                    Map<String,Object> row=new LinkedHashMap<>(); row.put("id",rs.getLong("id"));
                    row.put("name",rs.getString("name")); row.put("position",rs.getInt("position"));
                    row.put("dependsOnPosition",rs.getObject("depends_on_position")); row.put("evidenceRequired",true);
                    row.put("requiredRoles",List.of((String[])rs.getArray("required_roles").getArray())); return row;
                }).list();
    }

    private String date(Date value) { return value == null ? "" : value.toLocalDate().toString(); }
    private List<PersonAssignment> assignmentPairs(String value) {
        if(value==null || value.isBlank()) return List.of();
        return java.util.Arrays.stream(value.split("\\|\\|")).map(pair->pair.split("::",2))
                .filter(parts->parts.length==2).map(parts->new PersonAssignment(parts[0],parts[1])).toList();
    }
    private String actionRequiredExpression(AppPrincipal user) {
        if(user.hasRole("ADMIN")) return """
                (select count(*) from sites sa join site_stages ssa on ssa.site_id=sa.id where sa.project_id=p.id and
                 (ssa.status='REVIEW_PENDING'
                  or (ssa.status not in ('APPROVED','COMPLETED') and exists(
                    select 1 from site_stage_required_roles rr left join site_stage_role_assignments sra
                      on sra.stage_id=rr.stage_id and sra.role_code=rr.role_code
                    where rr.stage_id=ssa.id and sra.employee_id is null))
                  or (ssa.status in ('NOT_STARTED','READY','IN_PROGRESS') and not exists(
                    select 1 from site_stage_required_roles rr where rr.stage_id=ssa.id))))
                """;
        return """
                (select count(*) from sites sa join site_stages ssa on ssa.site_id=sa.id where sa.project_id=p.id and
                 ((p.coordinator_id=:employeeId and (ssa.status='REVIEW_PENDING'
                    or (ssa.status not in ('APPROVED','COMPLETED') and exists(
                      select 1 from site_stage_required_roles missing_rr left join site_stage_role_assignments missing_sra
                        on missing_sra.stage_id=missing_rr.stage_id and missing_sra.role_code=missing_rr.role_code
                      where missing_rr.stage_id=ssa.id and missing_sra.employee_id is null))
                    or (ssa.status in ('NOT_STARTED','READY','IN_PROGRESS') and not exists(
                      select 1 from site_stage_required_roles no_role_rr where no_role_rr.stage_id=ssa.id))))
                  or (ssa.status in ('READY','IN_PROGRESS','CHANGES_REQUESTED') and exists(
                    select 1 from site_stage_required_roles rr join site_stage_role_assignments sra
                      on sra.stage_id=rr.stage_id and sra.role_code=rr.role_code
                    where rr.stage_id=ssa.id and sra.employee_id=:employeeId))))
                """;
    }

    public record ProjectRequest(@NotBlank String name,@NotBlank String customerName,@NotBlank String customerMobile,
                                 String address,LocalDate targetDate,@NotNull Long coordinatorId) {}
    public record CoordinatorRequest(@NotNull Long coordinatorId) {}
    public record PersonAssignment(String role,String name) {}
    public record SiteRequest(@NotBlank String name,@NotNull Long siteTypeId,Long teamId,
                              String address,LocalDate targetDate,@NotEmpty List<SiteStageRequest> stages) {}
    public record SiteStageRequest(@NotBlank String name,Integer dependsOnPosition,List<String> requiredRoles) {
        public SiteStageRequest { requiredRoles=requiredRoles==null?List.of():requiredRoles; }
    }
}
