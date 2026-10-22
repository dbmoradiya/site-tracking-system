package com.sitetrack.service;

import com.sitetrack.api.ApiException;
import com.sitetrack.security.AppPrincipal;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkflowService {
    private final JdbcClient jdbc;

    public WorkflowService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void requireSiteManager(long siteId, AppPrincipal user) {
        if (user.hasRole("ADMIN")) return;
        boolean owns = user.employeeId() != null && jdbc.sql(
                "select count(*) from sites s join projects p on p.id=s.project_id where s.id=:siteId and p.coordinator_id=:employeeId")
                .param("siteId", siteId).param("employeeId", user.employeeId())
                .query(Long.class).single() > 0;
        if (!owns) throw new ApiException(403, "You can manage only your own Sites");
    }

    public void requireProjectAccess(long projectId, AppPrincipal user) {
        if (user.hasRole("ADMIN")) return;
        String sql = """
                select count(*) from projects p where p.id=:projectId and (
                  p.coordinator_id=:employeeId or exists(
                    select 1 from site_role_assignments sra
                    where sra.site_id in (select id from sites where project_id=p.id) and sra.employee_id=:employeeId))
                """;
        boolean allowed = user.employeeId() != null && jdbc.sql(sql)
                .param("projectId", projectId).param("employeeId", user.employeeId())
                .query(Long.class).single() > 0;
        if (!allowed) throw new ApiException(403, "You do not have access to this Project");
    }

    public void requireSiteAccess(long siteId, AppPrincipal user) {
        if (user.hasRole("ADMIN")) return;
        String sql = """
                select count(*) from sites s join projects p on p.id=s.project_id where s.id=:siteId and (
                  p.coordinator_id=:employeeId or exists(
                    select 1 from site_role_assignments sra where sra.site_id=s.id and sra.employee_id=:employeeId))
                """;
        boolean allowed = user.employeeId() != null && jdbc.sql(sql)
                .param("siteId", siteId).param("employeeId", user.employeeId())
                .query(Long.class).single() > 0;
        if (!allowed) throw new ApiException(403, "You do not have access to this Site");
    }

    public long siteIdForStage(long stageId) {
        return jdbc.sql("select site_id from site_stages where id=:id")
                .param("id", stageId).query(Long.class).optional()
                .orElseThrow(() -> new ApiException(404, "Stage not found"));
    }

    @Transactional
    public void recalculate(long siteId) {
        String siteStatus = jdbc.sql("""
                select case
                  when count(*) = 0 then 'NOT_STARTED'
                  when count(*) filter (where status='APPROVED') = count(*) then 'COMPLETED'
                  when count(*) filter (where status not in ('NOT_STARTED','BLOCKED','READY')) > 0
                       or count(*) filter (where status='APPROVED') > 0 then 'IN_PROGRESS'
                  else 'NOT_STARTED'
                end
                from site_stages where site_id=:siteId
                """).param("siteId", siteId).query(String.class).single();
        jdbc.sql("update sites set status=:status, updated_at=now() where id=:id")
                .param("status", siteStatus).param("id", siteId).update();

        long projectId = jdbc.sql("select project_id from sites where id=:id")
                .param("id", siteId).query(Long.class).single();
        String projectStatus = jdbc.sql("""
                select case
                  when count(*) = 0 then 'NOT_STARTED'
                  when count(*) filter (where status='COMPLETED') = count(*) then 'COMPLETED'
                  when count(*) filter (where status in ('IN_PROGRESS','COMPLETED')) > 0 then 'IN_PROGRESS'
                  else 'NOT_STARTED'
                end
                from sites where project_id=:projectId
                """).param("projectId", projectId).query(String.class).single();
        jdbc.sql("update projects set status=:status, updated_at=now() where id=:id")
                .param("status", projectStatus).param("id", projectId).update();
    }
}
