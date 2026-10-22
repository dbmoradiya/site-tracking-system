package com.sitetrack.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/setup")
public class SetupController {
    private final JdbcClient jdbc;

    public SetupController(JdbcClient jdbc) { this.jdbc = jdbc; }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','COORDINATOR')")
    public Map<String, Object> setup() {
        List<Map<String, Object>> types = jdbc.sql("""
                select st.id,st.name,st.description,
                  coalesce(json_agg(json_build_object('id',t.id,'name',t.name,'position',t.position,
                    'dependsOnId',t.depends_on_id,'evidenceRequired',t.evidence_required)
                    order by t.position) filter (where t.id is not null),'[]') stages
                from site_types st left join stage_templates t on t.site_type_id=st.id
                where st.active=true group by st.id order by st.name
                """).query((rs,n)->Map.<String,Object>of(
                        "id",rs.getLong("id"),"name",rs.getString("name"),
                        "description",rs.getString("description") == null ? "" : rs.getString("description"),
                        "stages",rs.getString("stages"))).list();
        List<Map<String, Object>> employees = jdbc.sql("""
                select e.id,e.name,e.email,e.mobile,e.role,e.active,
                  case when e.role='COORDINATOR' then coalesce((select string_agg(distinct p.name,'||') from sites s join projects p on p.id=s.project_id where s.coordinator_id=e.id),'')
                       else coalesce((select string_agg(distinct p.name,'||') from site_stages ss join sites s on s.id=ss.site_id join projects p on p.id=s.project_id where ss.supervisor_id=e.id),'') end assigned_projects
                from employees e order by e.role,e.name
                """)
                .query((rs,n)->Map.<String,Object>of("id",rs.getLong("id"),"name",rs.getString("name"),
                        "email",rs.getString("email"),"mobile",rs.getString("mobile") == null ? "" : rs.getString("mobile"),
                        "role",rs.getString("role"),"active",rs.getBoolean("active"),
                        "projects",names(rs.getString("assigned_projects")))).list();
        List<Map<String, Object>> teams = jdbc.sql("""
                select t.id,t.name,t.contact_name,t.mobile,t.notes,t.active,
                  coalesce((select string_agg(distinct p.name,'||') from site_stages ss join sites s on s.id=ss.site_id join projects p on p.id=s.project_id where ss.team_id=t.id),'') assigned_projects
                from teams t order by t.name
                """)
                .query((rs,n)->Map.<String,Object>of("id",rs.getLong("id"),"name",rs.getString("name"),
                        "contactName",rs.getString("contact_name"),"mobile",rs.getString("mobile"),
                        "notes",rs.getString("notes") == null ? "" : rs.getString("notes"),"active",rs.getBoolean("active"),
                        "projects",names(rs.getString("assigned_projects")))).list();
        return Map.of("siteTypes",types,"employees",employees,"teams",teams);
    }

    @PostMapping("/site-types")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public Map<String, Object> createSiteType(@Valid @RequestBody SiteTypeRequest request) {
        long typeId = jdbc.sql("insert into site_types(name,description) values(:name,:description) returning id")
                .param("name",request.name()).param("description",request.description()).query(Long.class).single();
        saveTemplates(typeId, request.stages());
        return Map.of("id",typeId);
    }

    @PutMapping("/site-types/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public void updateSiteType(@PathVariable long id, @Valid @RequestBody SiteTypeRequest request) {
        jdbc.sql("update site_types set name=:name,description=:description where id=:id")
                .param("name",request.name()).param("description",request.description()).param("id",id).update();
        jdbc.sql("delete from stage_templates where site_type_id=:id").param("id",id).update();
        saveTemplates(id, request.stages());
    }

    private void saveTemplates(long typeId, List<StageTemplateRequest> stages) {
        java.util.Map<Integer,Long> ids = new java.util.HashMap<>();
        for (int i=0;i<stages.size();i++) {
            StageTemplateRequest stage=stages.get(i);
            if (stage.dependsOnPosition() != null && (stage.dependsOnPosition() < 1 || stage.dependsOnPosition() > i))
                throw new ApiException(400,"A Stage can depend only on an earlier Stage");
            long id=jdbc.sql("insert into stage_templates(site_type_id,name,position,evidence_required) values(:type,:name,:pos,true) returning id")
                    .param("type",typeId).param("name",stage.name()).param("pos",i+1).query(Long.class).single();
            ids.put(i+1,id);
        }
        for (int i=0;i<stages.size();i++) {
            Integer dependency=stages.get(i).dependsOnPosition();
            if (dependency != null && ids.containsKey(dependency)) {
                jdbc.sql("update stage_templates set depends_on_id=:dep where id=:id")
                        .param("dep",ids.get(dependency)).param("id",ids.get(i+1)).update();
            }
        }
    }

    @PostMapping("/employees")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String,Object> createEmployee(@Valid @RequestBody EmployeeRequest request) {
        long id=jdbc.sql("insert into employees(name,email,mobile,role) values(:name,:email,:mobile,:role) returning id")
                .param("name",request.name()).param("email",request.email()).param("mobile",request.mobile())
                .param("role",request.role()).query(Long.class).single();
        return Map.of("id",id);
    }

    @PutMapping("/employees/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public void updateEmployee(@PathVariable long id,@Valid @RequestBody EmployeeRequest request) {
        int changed=jdbc.sql("update employees set name=:name,email=:email,mobile=:mobile,role=:role where id=:id")
                .param("name",request.name()).param("email",request.email()).param("mobile",request.mobile())
                .param("role",request.role()).param("id",id).update();
        if(changed==0) throw new ApiException(404,"Employee not found");
        jdbc.sql("update app_users set name=:name,email=:email,role=:role where employee_id=:id")
                .param("name",request.name()).param("email",request.email()).param("role",request.role()).param("id",id).update();
    }

    @PostMapping("/teams")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String,Object> createTeam(@Valid @RequestBody TeamRequest request) {
        long id=jdbc.sql("insert into teams(name,contact_name,mobile,notes) values(:name,:contact,:mobile,:notes) returning id")
                .param("name",request.name()).param("contact",request.contactName()).param("mobile",request.mobile())
                .param("notes",request.notes()).query(Long.class).single();
        return Map.of("id",id);
    }

    @PutMapping("/teams/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void updateTeam(@PathVariable long id,@Valid @RequestBody TeamRequest request) {
        int changed=jdbc.sql("update teams set name=:name,contact_name=:contact,mobile=:mobile,notes=:notes where id=:id")
                .param("name",request.name()).param("contact",request.contactName()).param("mobile",request.mobile())
                .param("notes",request.notes()).param("id",id).update();
        if(changed==0) throw new ApiException(404,"Team not found");
    }

    private List<String> names(String value) { return value == null || value.isBlank() ? List.of() : List.of(value.split("\\|\\|")); }

    public record SiteTypeRequest(@NotBlank String name, String description, @NotEmpty List<StageTemplateRequest> stages) {}
    public record StageTemplateRequest(@NotBlank String name, Integer dependsOnPosition) {}
    public record EmployeeRequest(@NotBlank String name,@Email @NotBlank String email,String mobile,
                                  @NotBlank @Pattern(regexp="COORDINATOR|SUPERVISOR") String role) {}
    public record TeamRequest(@NotBlank String name,@NotBlank String contactName,@NotBlank String mobile,String notes) {}
}
