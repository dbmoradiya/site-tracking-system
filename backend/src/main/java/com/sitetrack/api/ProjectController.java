package com.sitetrack.api;

import com.sitetrack.security.AppPrincipal;
import com.sitetrack.service.WorkflowService;
import com.sitetrack.service.ProjectService;
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

    public ProjectController(JdbcClient jdbc, WorkflowService workflow,ProjectService projects) {
        this.jdbc = jdbc;
        this.workflow = workflow;
        this.projects = projects;
    }

    @GetMapping
    public List<Map<String,Object>> list(@AuthenticationPrincipal AppPrincipal user) {
        String filter = user.hasRole("ADMIN") ? "" : """
                 where p.coordinator_id=:employeeId or exists(
                   select 1 from sites sx join site_stages ssx on ssx.site_id=sx.id
                   where sx.project_id=p.id and ssx.supervisor_id=:employeeId)
                """;
        JdbcClient.StatementSpec spec=jdbc.sql("""
                select p.id,p.name,p.customer_name,p.customer_mobile,p.address,p.target_date,p.status,
                       count(distinct s.id) site_count,
                       count(distinct s.id) filter(where s.status='COMPLETED') completed_sites,
                       pc.name coordinator,
                       coalesce((select string_agg(distinct es.name,'||') from sites ss join site_stages stg on stg.site_id=ss.id join employees es on es.id=stg.supervisor_id where ss.project_id=p.id),'') supervisors,
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
            row.put("coordinators",List.of(rs.getString("coordinator"))); row.put("supervisors",names(rs.getString("supervisors")));
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
                " and exists(select 1 from site_stages access_stage where access_stage.site_id=s.id and access_stage.supervisor_id=:employeeId)";
        JdbcClient.StatementSpec siteSpec=jdbc.sql("""
                select s.id,s.name,s.address,s.target_date,s.status,st.name site_type,
                       pc.name coordinator,
                       count(ss.id) stage_count,count(ss.id) filter(where ss.status='APPROVED') approved_stages
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
                    row.put("approvedStages",rs.getLong("approved_stages"));
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
    public Map<String,Object> createSite(@PathVariable long projectId,@Valid @RequestBody SiteRequest request) {
        for (int i=0;i<request.stages().size();i++) {
            Integer dependency=request.stages().get(i).dependsOnPosition();
            if (dependency != null && (dependency < 1 || dependency > i))
                throw new ApiException(400,"A Stage can depend only on an earlier Stage");
        }
        long siteId=jdbc.sql("""
                insert into sites(project_id,site_type_id,coordinator_id,name,address,target_date)
                values(:project,:type,:coordinator,:name,:address,:target) returning id
                """).param("project",projectId).param("type",request.siteTypeId()).param("coordinator",request.coordinatorId())
                .param("name",request.name()).param("address",request.address()).param("target",request.targetDate())
                .query(Long.class).single();
        Map<Integer,Long> stageIds=new LinkedHashMap<>();
        for(int i=0;i<request.stages().size();i++) {
            SiteStageRequest stage=request.stages().get(i);
            long stageId=jdbc.sql("""
                    insert into site_stages(site_id,name,position,evidence_required,status,supervisor_id,team_id)
                    values(:site,:name,:position,true,:status,:supervisor,:team) returning id
                    """).param("site",siteId).param("name",stage.name()).param("position",i+1)
                    .param("status",stage.dependsOnPosition()==null ? "READY" : "BLOCKED")
                    .param("supervisor",stage.supervisorId()).param("team",stage.teamId()).query(Long.class).single();
            stageIds.put(i+1,stageId);
        }
        for(int i=0;i<request.stages().size();i++) {
            Integer dep=request.stages().get(i).dependsOnPosition();
            if(dep!=null && stageIds.containsKey(dep)) jdbc.sql("update site_stages set depends_on_stage_id=:dep where id=:id")
                    .param("dep",stageIds.get(dep)).param("id",stageIds.get(i+1)).update();
        }
        workflow.recalculate(siteId);
        return Map.of("id",siteId);
    }

    @GetMapping("/site-types/{typeId}/defaults")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String,Object>> defaults(@PathVariable long typeId) {
        return jdbc.sql("""
                select t.id,t.name,t.position,d.position depends_on_position,true evidence_required
                from stage_templates t left join stage_templates d on d.id=t.depends_on_id
                where t.site_type_id=:type order by t.position
                """).param("type",typeId).query((rs,n)->{
                    Map<String,Object> row=new LinkedHashMap<>(); row.put("id",rs.getLong("id"));
                    row.put("name",rs.getString("name")); row.put("position",rs.getInt("position"));
                    row.put("dependsOnPosition",rs.getObject("depends_on_position")); row.put("evidenceRequired",true); return row;
                }).list();
    }

    private String date(Date value) { return value == null ? "" : value.toLocalDate().toString(); }
    private List<String> names(String value) { return value == null || value.isBlank() ? List.of() : List.of(value.split("\\|\\|")); }
    private String actionRequiredExpression(AppPrincipal user) {
        if(user.hasRole("ADMIN")) return "(select count(*) from sites sa join site_stages ssa on ssa.site_id=sa.id where sa.project_id=p.id and (ssa.status='REVIEW_PENDING' or ssa.supervisor_id is null or ssa.team_id is null))";
        return """
                (select count(*) from sites sa join site_stages ssa on ssa.site_id=sa.id where sa.project_id=p.id and
                 ((p.coordinator_id=:employeeId and (ssa.status='REVIEW_PENDING' or ssa.supervisor_id is null or ssa.team_id is null))
                  or (ssa.supervisor_id=:employeeId and ssa.status in ('READY','IN_PROGRESS','CHANGES_REQUESTED'))))
                """;
    }

    public record ProjectRequest(@NotBlank String name,@NotBlank String customerName,@NotBlank String customerMobile,
                                 String address,LocalDate targetDate,@NotNull Long coordinatorId) {}
    public record CoordinatorRequest(@NotNull Long coordinatorId) {}
    public record SiteRequest(@NotBlank String name,@NotNull Long siteTypeId,@NotNull Long coordinatorId,
                              String address,LocalDate targetDate,@NotEmpty List<SiteStageRequest> stages) {}
    public record SiteStageRequest(@NotBlank String name,Integer dependsOnPosition,Long supervisorId,Long teamId) {}
}
