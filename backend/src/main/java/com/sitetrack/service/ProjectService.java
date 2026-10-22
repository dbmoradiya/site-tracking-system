package com.sitetrack.service;

import com.sitetrack.api.ApiException;
import com.sitetrack.security.AppPrincipal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@Service
public class ProjectService {
    private final JdbcClient jdbc;
    private final Path uploadDir;

    public ProjectService(JdbcClient jdbc, @Value("${app.upload-dir}") String uploadDir) {
        this.jdbc = jdbc;
        this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    public void requireCoordinator(long employeeId) {
        boolean eligible = jdbc.sql("""
                select count(*) from employees e join employee_roles er on er.employee_id=e.id
                where e.id=:id and e.active=true and er.role_code='COORDINATOR'
                """).param("id",employeeId).query(Long.class).single()>0;
        if (!eligible) throw new ApiException(400,"Select an active employee with the Coordinator role");
    }

    @Transactional
    public void changeCoordinator(long projectId,long coordinatorId,AppPrincipal actor) {
        requireCoordinator(coordinatorId);
        Long oldId=jdbc.sql("select coordinator_id from projects where id=:id for update").param("id",projectId)
                .query(Long.class).optional().orElseThrow(()->new ApiException(404,"Project not found"));
        if(oldId==coordinatorId) return;
        jdbc.sql("update projects set coordinator_id=:coordinator,updated_at=now() where id=:id")
                .param("coordinator",coordinatorId).param("id",projectId).update();
        jdbc.sql("""
                insert into project_coordinator_history(project_id,old_employee_id,new_employee_id,changed_by)
                values(:project,:old,:new,:actor)
                """).param("project",projectId).param("old",oldId).param("new",coordinatorId)
                .param("actor",actor.id()).update();
    }

    @Transactional
    public void delete(long projectId) {
        List<String> paths=jdbc.sql("""
                select e.storage_path from evidence e join site_stages ss on ss.id=e.stage_id
                join sites s on s.id=ss.site_id where s.project_id=:id
                """).param("id",projectId).query(String.class).list();
        int deleted=jdbc.sql("delete from projects where id=:id").param("id",projectId).update();
        if(deleted==0) throw new ApiException(404,"Project not found");
        for(String storedPath:paths) {
            Path path=Path.of(storedPath).toAbsolutePath().normalize();
            if(!path.startsWith(uploadDir)) throw new ApiException(500,"Evidence storage path is invalid");
            try { Files.deleteIfExists(path); }
            catch(IOException exception) { throw new IllegalStateException("Could not delete Project evidence files",exception); }
        }
    }
}
