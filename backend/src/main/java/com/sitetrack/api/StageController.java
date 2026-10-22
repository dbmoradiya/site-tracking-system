package com.sitetrack.api;

import com.sitetrack.security.AppPrincipal;
import com.sitetrack.service.WorkflowService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class StageController {
    private final JdbcClient jdbc;
    private final WorkflowService workflow;
    private final Path uploadDir;

    public StageController(JdbcClient jdbc, WorkflowService workflow, @Value("${app.upload-dir}") String uploadDir) {
        this.jdbc = jdbc;
        this.workflow = workflow;
        this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    @GetMapping("/sites/{siteId}")
    public Map<String,Object> site(@PathVariable long siteId,@AuthenticationPrincipal AppPrincipal user) {
        workflow.requireSiteAccess(siteId,user);
        Map<String,Object> site=jdbc.sql("""
                select s.id,s.name,s.address,s.target_date,s.status,p.id project_id,p.name project_name,
                       st.name site_type,e.name coordinator
                from sites s join projects p on p.id=s.project_id join site_types st on st.id=s.site_type_id
                join employees e on e.id=s.coordinator_id where s.id=:id
                """).param("id",siteId).query((rs,n)->{
                    Map<String,Object> row=new LinkedHashMap<>(); row.put("id",rs.getLong("id"));
                    row.put("name",rs.getString("name")); row.put("address",rs.getString("address"));
                    row.put("status",rs.getString("status")); row.put("projectId",rs.getLong("project_id"));
                    row.put("projectName",rs.getString("project_name")); row.put("siteType",rs.getString("site_type"));
                    row.put("coordinator",rs.getString("coordinator")); return row;
                }).optional().orElseThrow(()->new ApiException(404,"Site not found"));
        boolean canManage="ADMIN".equals(user.role()) || ("COORDINATOR".equals(user.role()) && user.employeeId()!=null &&
                jdbc.sql("select coordinator_id from sites where id=:id").param("id",siteId).query(Long.class).single().equals(user.employeeId()));
        List<Map<String,Object>> stages=jdbc.sql("""
                select ss.id,ss.name,ss.position,ss.status,ss.evidence_required,ss.depends_on_stage_id,ss.supervisor_id,
                       sup.name supervisor,tm.name team,count(ev.id) filter(where ev.upload_status='UPLOADED') evidence_count
                from site_stages ss left join employees sup on sup.id=ss.supervisor_id left join teams tm on tm.id=ss.team_id
                left join evidence ev on ev.stage_id=ss.id where ss.site_id=:siteId
                group by ss.id,sup.name,tm.name order by ss.position
                """).param("siteId",siteId).query((rs,n)->{
                    Map<String,Object> row=new LinkedHashMap<>(); row.put("id",rs.getLong("id"));
                    row.put("name",rs.getString("name")); row.put("position",rs.getInt("position"));
                    row.put("status",rs.getString("status")); row.put("evidenceRequired",rs.getBoolean("evidence_required"));
                    row.put("supervisor",rs.getString("supervisor") == null ? "Unassigned" : rs.getString("supervisor"));
                    row.put("team",rs.getString("team") == null ? "Unassigned" : rs.getString("team"));
                    row.put("evidenceCount",rs.getLong("evidence_count")); row.put("canManage",canManage);
                    boolean canUpload=canManage || ("SUPERVISOR".equals(user.role()) && user.employeeId()!=null &&
                            user.employeeId().equals((Long)rs.getObject("supervisor_id")));
                    row.put("canUpload",canUpload); return row;
                }).list();
        site.put("canManage",canManage); site.put("stages",stages); return site;
    }

    @PostMapping("/stages/{stageId}/assign")
    @Transactional
    public void assign(@PathVariable long stageId,@Valid @RequestBody AssignmentRequest request,
                       @AuthenticationPrincipal AppPrincipal user) {
        long siteId=workflow.siteIdForStage(stageId); workflow.requireSiteManager(siteId,user);
        AssignmentRow old=jdbc.sql("select supervisor_id,team_id from site_stages where id=:id")
                .param("id",stageId).query(AssignmentRow.class).single();
        jdbc.sql("update site_stages set supervisor_id=:supervisor,team_id=:team,updated_at=now() where id=:id")
                .param("supervisor",request.supervisorId()).param("team",request.teamId()).param("id",stageId).update();
        jdbc.sql("""
                insert into assignment_history(stage_id,old_supervisor_id,new_supervisor_id,old_team_id,new_team_id,changed_by)
                values(:stage,:oldSupervisor,:newSupervisor,:oldTeam,:newTeam,:user)
                """).param("stage",stageId).param("oldSupervisor",old.supervisorId()).param("newSupervisor",request.supervisorId())
                .param("oldTeam",old.teamId()).param("newTeam",request.teamId()).param("user",user.id()).update();
    }

    @PostMapping(value="/stages/{stageId}/evidence",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public Map<String,Object> evidence(@PathVariable long stageId,@RequestPart("file") MultipartFile file,
                                       @RequestPart(value="comment",required=false) String comment,
                                       @AuthenticationPrincipal AppPrincipal user) throws IOException {
        if(file.isEmpty()) throw new ApiException(400,"Choose a non-empty evidence file");
        if(file.getSize()>15L*1024*1024) throw new ApiException(400,"Evidence file must be 15 MB or smaller");
        requireStageAccess(stageId,user);
        String current=jdbc.sql("select status from site_stages where id=:id").param("id",stageId).query(String.class).single();
        if(List.of("BLOCKED","REVIEW_PENDING","APPROVED").contains(current))
            throw new ApiException(409,"Evidence cannot be added while this Stage is "+current.toLowerCase().replace('_',' '));
        Files.createDirectories(uploadDir);
        String safeName=UUID.randomUUID()+"-"+Path.of(file.getOriginalFilename()==null?"evidence":file.getOriginalFilename()).getFileName();
        Path target=uploadDir.resolve(safeName).normalize();
        if(!target.startsWith(uploadDir)) throw new ApiException(400,"Invalid file name");
        Files.copy(file.getInputStream(),target, StandardCopyOption.REPLACE_EXISTING);
        long id=jdbc.sql("""
                insert into evidence(stage_id,file_name,content_type,storage_path,uploaded_by,comment)
                values(:stage,:name,:type,:path,:user,:comment) returning id
                """).param("stage",stageId).param("name",file.getOriginalFilename()==null?"evidence":file.getOriginalFilename())
                .param("type",file.getContentType()).param("path",target.toString()).param("user",user.id())
                .param("comment",comment==null||comment.isBlank()?null:comment.trim()).query(Long.class).single();
        jdbc.sql("update site_stages set status=case when status in ('READY','NOT_STARTED','CHANGES_REQUESTED') then 'IN_PROGRESS' else status end,updated_at=now() where id=:id")
                .param("id",stageId).update();
        workflow.recalculate(workflow.siteIdForStage(stageId));
        return Map.of("id",id,"status","UPLOADED","uploadedAt", Instant.now().toString());
    }

    @PostMapping("/stages/{stageId}/submit")
    @Transactional
    public void submit(@PathVariable long stageId,@AuthenticationPrincipal AppPrincipal user) {
        requireStageAccess(stageId,user);
        long evidenceCount=jdbc.sql("select count(*) from evidence where stage_id=:id and upload_status='UPLOADED'")
                .param("id",stageId).query(Long.class).single();
        if(evidenceCount==0) throw new ApiException(400,"At least one successfully uploaded evidence file is required");
        String status=jdbc.sql("select status from site_stages where id=:id").param("id",stageId).query(String.class).single();
        if("BLOCKED".equals(status)) throw new ApiException(409,"Complete the dependency before submitting this Stage");
        if(!List.of("READY","IN_PROGRESS","CHANGES_REQUESTED").contains(status))
            throw new ApiException(409,"This Stage cannot be submitted from its current status");
        jdbc.sql("update site_stages set status='REVIEW_PENDING',updated_at=now() where id=:id").param("id",stageId).update();
        jdbc.sql("insert into stage_reviews(stage_id,action,action_by) values(:stage,'SUBMITTED',:user)")
                .param("stage",stageId).param("user",user.id()).update();
        workflow.recalculate(workflow.siteIdForStage(stageId));
    }

    @PostMapping("/stages/{stageId}/review")
    @Transactional
    public void review(@PathVariable long stageId,@Valid @RequestBody ReviewRequest request,
                       @AuthenticationPrincipal AppPrincipal user) {
        long siteId=workflow.siteIdForStage(stageId); workflow.requireSiteManager(siteId,user);
        if(!List.of("APPROVED","CHANGES_REQUESTED").contains(request.action())) throw new ApiException(400,"Invalid review action");
        String current=jdbc.sql("select status from site_stages where id=:id").param("id",stageId).query(String.class).single();
        if(!"REVIEW_PENDING".equals(current)) throw new ApiException(409,"Only a submitted Stage can be reviewed");
        if("CHANGES_REQUESTED".equals(request.action()) && (request.note()==null || request.note().isBlank()))
            throw new ApiException(400,"A reason is required when requesting changes");
        jdbc.sql("update site_stages set status=:status,approved_at=case when :status='APPROVED' then now() else null end,updated_at=now() where id=:id")
                .param("status",request.action()).param("id",stageId).update();
        jdbc.sql("insert into stage_reviews(stage_id,action,note,action_by) values(:stage,:action,:note,:user)")
                .param("stage",stageId).param("action",request.action()).param("note",request.note()).param("user",user.id()).update();
        if("APPROVED".equals(request.action())) jdbc.sql("""
                update site_stages set status='READY',updated_at=now()
                where depends_on_stage_id=:approved and status='BLOCKED'
                """).param("approved",stageId).update();
        workflow.recalculate(siteId);
    }

    @GetMapping("/stages/{stageId}/history")
    public Map<String,Object> history(@PathVariable long stageId,@AuthenticationPrincipal AppPrincipal user) {
        requireStageAccess(stageId,user);
        List<Map<String,Object>> assignments=jdbc.sql("""
                select ah.created_at,os.name old_supervisor,ns.name new_supervisor,ot.name old_team,nt.name new_team,u.name changed_by
                from assignment_history ah left join employees os on os.id=ah.old_supervisor_id
                left join employees ns on ns.id=ah.new_supervisor_id left join teams ot on ot.id=ah.old_team_id
                left join teams nt on nt.id=ah.new_team_id join app_users u on u.id=ah.changed_by
                where ah.stage_id=:id order by ah.created_at desc
                """).param("id",stageId).query((rs,n)->{
                    Map<String,Object> row=new LinkedHashMap<>(); row.put("createdAt",rs.getTimestamp("created_at").toInstant());
                    row.put("oldSupervisor",value(rs.getString("old_supervisor"))); row.put("newSupervisor",value(rs.getString("new_supervisor")));
                    row.put("oldTeam",value(rs.getString("old_team"))); row.put("newTeam",value(rs.getString("new_team")));
                    row.put("changedBy",rs.getString("changed_by")); return row;
                }).list();
        List<Map<String,Object>> reviews=jdbc.sql("""
                select r.action,r.note,r.created_at,u.name action_by from stage_reviews r join app_users u on u.id=r.action_by
                where r.stage_id=:id order by r.created_at desc
                """).param("id",stageId).query((rs,n)->Map.<String,Object>of(
                        "action",rs.getString("action"),"note",value(rs.getString("note")),
                        "createdAt",rs.getTimestamp("created_at").toInstant(),"actionBy",rs.getString("action_by"))).list();
        return Map.of("assignments",assignments,"reviews",reviews);
    }

    @GetMapping("/stages/{stageId}/evidence")
    public List<Map<String,Object>> evidenceList(@PathVariable long stageId,@AuthenticationPrincipal AppPrincipal user) {
        requireStageAccess(stageId,user);
        return jdbc.sql("""
                select e.id,e.file_name,e.content_type,e.comment,e.created_at,u.name uploaded_by
                from evidence e join app_users u on u.id=e.uploaded_by
                where e.stage_id=:stage and e.upload_status='UPLOADED' order by e.created_at desc
                """).param("stage",stageId).query((rs,n)->Map.<String,Object>of(
                        "id",rs.getLong("id"),"fileName",rs.getString("file_name"),
                        "contentType",value(rs.getString("content_type")),"comment",value(rs.getString("comment")),
                        "uploadedAt",rs.getTimestamp("created_at").toInstant(),
                        "uploadedBy",rs.getString("uploaded_by"))).list();
    }

    @GetMapping("/evidence/{evidenceId}/content")
    public ResponseEntity<byte[]> evidenceContent(@PathVariable long evidenceId,@AuthenticationPrincipal AppPrincipal user) throws IOException {
        EvidenceFile evidence=jdbc.sql("select stage_id,storage_path,content_type,file_name from evidence where id=:id and upload_status='UPLOADED'")
                .param("id",evidenceId).query(EvidenceFile.class).optional()
                .orElseThrow(()->new ApiException(404,"Evidence not found"));
        requireStageAccess(evidence.stageId(),user);
        Path path=Path.of(evidence.storagePath()).toAbsolutePath().normalize();
        if(!path.startsWith(uploadDir) || !Files.exists(path)) throw new ApiException(404,"Evidence file is unavailable");
        MediaType contentType;
        try { contentType=MediaType.parseMediaType(evidence.contentType()==null?"application/octet-stream":evidence.contentType()); }
        catch (Exception ignored) { contentType=MediaType.APPLICATION_OCTET_STREAM; }
        return ResponseEntity.ok().contentType(contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.inline().filename(evidence.fileName(), StandardCharsets.UTF_8).build().toString())
                .body(Files.readAllBytes(path));
    }

    private void requireStageAccess(long stageId,AppPrincipal user) {
        if("ADMIN".equals(user.role())) return;
        long siteId=workflow.siteIdForStage(stageId);
        if("COORDINATOR".equals(user.role())) { workflow.requireSiteManager(siteId,user); return; }
        boolean assigned=user.employeeId()!=null && jdbc.sql("select count(*) from site_stages where id=:id and supervisor_id=:employee")
                .param("id",stageId).param("employee",user.employeeId()).query(Long.class).single()>0;
        if(!assigned) throw new ApiException(403,"This Stage is not assigned to you");
    }

    private String value(String value) { return value == null ? "—" : value; }
    public record AssignmentRequest(Long supervisorId,Long teamId) {}
    public record ReviewRequest(String action,String note) {}
    public record AssignmentRow(Long supervisorId,Long teamId) {}
    public record EvidenceFile(Long stageId,String storagePath,String contentType,String fileName) {}
}
