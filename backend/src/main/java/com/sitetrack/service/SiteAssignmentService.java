package com.sitetrack.service;

import com.sitetrack.api.ApiException;
import com.sitetrack.security.AppPrincipal;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Set;

@Service
public class SiteAssignmentService {
    private static final Set<String> ROLES=Set.of("COORDINATOR","SUPERVISOR","DESIGN_ENGINEER","PROCUREMENT_MANAGER");
    private final JdbcClient jdbc;

    public SiteAssignmentService(JdbcClient jdbc) { this.jdbc=jdbc; }

    public void validate(String role,Long employeeId) {
        if(!ROLES.contains(role)) throw new ApiException(400,"Invalid Site role");
        if(employeeId==null) return;
        boolean eligible=jdbc.sql("""
                select count(*) from employees e join employee_roles er on er.employee_id=e.id
                where e.id=:employee and e.active=true and er.role_code=:role
                """).param("employee",employeeId).param("role",role).query(Long.class).single()>0;
        if(!eligible) throw new ApiException(400,"The selected employee is not eligible for "+role.replace('_',' '));
    }

    public void createAssignments(long siteId,Map<String,Long> assignments,Long teamId,AppPrincipal actor) {
        assignments.forEach((role,employee)->{
            validate(role,employee);
            if(employee!=null) jdbc.sql("insert into site_role_assignments(site_id,role_code,employee_id) values(:site,:role,:employee)")
                    .param("site",siteId).param("role",role).param("employee",employee).update();
            jdbc.sql("insert into site_role_assignment_history(site_id,role_code,new_employee_id,changed_by) values(:site,:role,:employee,:actor)")
                    .param("site",siteId).param("role",role).param("employee",employee).param("actor",actor.id()).update();
        });
        if(teamId!=null) jdbc.sql("insert into site_team_assignment_history(site_id,new_team_id,changed_by) values(:site,:team,:actor)")
                .param("site",siteId).param("team",teamId).param("actor",actor.id()).update();
    }

    @Transactional
    public void update(long siteId,Map<String,Long> assignments,Long teamId,AppPrincipal actor) {
        for(var entry:assignments.entrySet()) {
            String role=entry.getKey();Long next=entry.getValue();validate(role,next);
            Long old=jdbc.sql("select employee_id from site_role_assignments where site_id=:site and role_code=:role")
                    .param("site",siteId).param("role",role).query(Long.class).optional().orElse(null);
            if(java.util.Objects.equals(old,next)) continue;
            jdbc.sql("delete from site_role_assignments where site_id=:site and role_code=:role")
                    .param("site",siteId).param("role",role).update();
            if(next!=null) jdbc.sql("insert into site_role_assignments(site_id,role_code,employee_id) values(:site,:role,:employee)")
                    .param("site",siteId).param("role",role).param("employee",next).update();
            jdbc.sql("""
                    insert into site_role_assignment_history(site_id,role_code,old_employee_id,new_employee_id,changed_by)
                    values(:site,:role,:old,:new,:actor)
                    """).param("site",siteId).param("role",role).param("old",old).param("new",next).param("actor",actor.id()).update();
        }
        Long storedTeam=jdbc.sql("select coalesce(team_id,-1) from sites where id=:id for update").param("id",siteId).query(Long.class).optional()
                .orElseThrow(()->new ApiException(404,"Site not found"));
        Long oldTeam=storedTeam==-1?null:storedTeam;
        if(!java.util.Objects.equals(oldTeam,teamId)) {
            jdbc.sql("update sites set team_id=:team,updated_at=now() where id=:id").param("team",teamId).param("id",siteId).update();
            jdbc.sql("insert into site_team_assignment_history(site_id,old_team_id,new_team_id,changed_by) values(:site,:old,:new,:actor)")
                    .param("site",siteId).param("old",oldTeam).param("new",teamId).param("actor",actor.id()).update();
        }
    }
}
