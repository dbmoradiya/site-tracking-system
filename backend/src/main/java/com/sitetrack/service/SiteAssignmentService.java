package com.sitetrack.service;

import com.sitetrack.api.ApiException;
import com.sitetrack.security.AppPrincipal;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class SiteAssignmentService {
    private static final Set<String> ROLES=Set.of("COORDINATOR","SUPERVISOR","DESIGN_ENGINEER","PROCUREMENT_MANAGER","TEAM");
    private final JdbcClient jdbc;

    public SiteAssignmentService(JdbcClient jdbc) { this.jdbc=jdbc; }

    public void validate(String role,Long employeeId) {
        if(!ROLES.contains(role)) throw new ApiException(400,"Invalid Site role");
        if(employeeId==null) return;
        if("TEAM".equals(role)) {
            if(jdbc.sql("select count(*) from teams where id=:id").param("id",employeeId).query(Long.class).single()==0)
                throw new ApiException(400,"The selected Team does not exist");
            return;
        }
        boolean eligible=jdbc.sql("""
                select count(*) from employees e join employee_roles er on er.employee_id=e.id
                where e.id=:employee and e.active=true and er.role_code=:role
                """).param("employee",employeeId).param("role",role).query(Long.class).single()>0;
        if(!eligible) throw new ApiException(400,"The selected employee is not eligible for "+role.replace('_',' '));
    }

    public void recordInitialTeam(long siteId,Long teamId,AppPrincipal actor) {
        if(teamId!=null) jdbc.sql("insert into site_team_assignment_history(site_id,new_team_id,changed_by) values(:site,:team,:actor)")
                .param("site",siteId).param("team",teamId).param("actor",actor.id()).update();
    }

    /** Assigns employees per required role of one Stage. A null employee clears the assignment. */
    @Transactional
    public void updateStage(long siteId,long stageId,Map<String,Long> assignments,AppPrincipal actor) {
        Long stageSite=jdbc.sql("select site_id from site_stages where id=:id").param("id",stageId).query(Long.class).optional()
                .orElseThrow(()->new ApiException(404,"Stage not found"));
        if(stageSite!=siteId) throw new ApiException(404,"Stage not found on this Site");
        List<String> required=jdbc.sql("select role_code from site_stage_required_roles where stage_id=:id")
                .param("id",stageId).query(String.class).list();
        for(var entry:assignments.entrySet()) {
            String role=entry.getKey();Long next=entry.getValue();
            if(!required.contains(role)) throw new ApiException(400,role.replace('_',' ')+" is not a required role for this Stage");
            validate(role,next);
            boolean isTeam="TEAM".equals(role);
            Long old=jdbc.sql("select coalesce(employee_id,team_id) from site_stage_role_assignments where stage_id=:stage and role_code=:role")
                    .param("stage",stageId).param("role",role).query(Long.class).optional().orElse(null);
            if(Objects.equals(old,next)) continue;
            jdbc.sql("delete from site_stage_role_assignments where stage_id=:stage and role_code=:role")
                    .param("stage",stageId).param("role",role).update();
            if(next!=null) jdbc.sql(isTeam?"insert into site_stage_role_assignments(stage_id,role_code,team_id) values(:stage,:role,:employee)":"insert into site_stage_role_assignments(stage_id,role_code,employee_id) values(:stage,:role,:employee)")
                    .param("stage",stageId).param("role",role).param("employee",next).update();
            jdbc.sql("""
                    insert into site_role_assignment_history(site_id,stage_id,role_code,old_employee_id,new_employee_id,old_team_id,new_team_id,changed_by)
                    values(:site,:stage,:role,:oldEmp,:newEmp,:oldTeam,:newTeam,:actor)
                    """).param("site",siteId).param("stage",stageId).param("role",role).param("oldEmp",isTeam?null:old).param("newEmp",isTeam?null:next).param("oldTeam",isTeam?old:null).param("newTeam",isTeam?next:null)
                    .param("actor",actor.id()).update();
        }
    }

    @Transactional
    public void updateTeam(long siteId,Long teamId,AppPrincipal actor) {
        Long storedTeam=jdbc.sql("select coalesce(team_id,-1) from sites where id=:id for update").param("id",siteId).query(Long.class).optional()
                .orElseThrow(()->new ApiException(404,"Site not found"));
        Long oldTeam=storedTeam==-1?null:storedTeam;
        if(!Objects.equals(oldTeam,teamId)) {
            jdbc.sql("update sites set team_id=:team,updated_at=now() where id=:id").param("team",teamId).param("id",siteId).update();
            jdbc.sql("insert into site_team_assignment_history(site_id,old_team_id,new_team_id,changed_by) values(:site,:old,:new,:actor)")
                    .param("site",siteId).param("old",oldTeam).param("new",teamId).param("actor",actor.id()).update();
        }
    }
}
