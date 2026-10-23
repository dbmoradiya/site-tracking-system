package com.sitetrack.api;

import com.sitetrack.security.AppPrincipal;
import com.sitetrack.service.WorkflowService;
import com.sitetrack.service.SiteAssignmentService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
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
import java.util.ArrayList;
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
    private final SiteAssignmentService assignments;

    public StageController(JdbcClient jdbc, WorkflowService workflow,SiteAssignmentService assignments,
                           @Value("${app.upload-dir}") String uploadDir) {
        this.jdbc = jdbc;
        this.workflow = workflow;
        this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();
        this.assignments = assignments;
    }

    @GetMapping("/sites/{siteId}")
    public Map<String,Object> site(@PathVariable long siteId,@AuthenticationPrincipal AppPrincipal user) {
        workflow.requireSiteAccess(siteId,user);
        Map<String,Object> site=jdbc.sql("""
                select s.id,s.name,s.address,s.target_date,s.status,p.id project_id,p.name project_name,
                       st.name site_type,e.name coordinator,s.team_id,tm.name team
                from sites s join projects p on p.id=s.project_id join site_types st on st.id=s.site_type_id
                join employees e on e.id=p.coordinator_id left join teams tm on tm.id=s.team_id where s.id=:id
                """).param("id",siteId).query((rs,n)->{
                    Map<String,Object> row=new LinkedHashMap<>(); row.put("id",rs.getLong("id"));
                    row.put("name",rs.getString("name")); row.put("address",rs.getString("address"));
                    row.put("status",rs.getString("status")); row.put("targetDate",rs.getDate("target_date")==null?null:rs.getDate("target_date").toLocalDate().toString()); row.put("projectId",rs.getLong("project_id"));
                    row.put("projectName",rs.getString("project_name")); row.put("siteType",rs.getString("site_type"));
                    row.put("coordinator",rs.getString("coordinator")); row.put("teamId",rs.getObject("team_id"));
                    row.put("team",rs.getString("team")==null?"Unassigned":rs.getString("team")); return row;
                }).optional().orElseThrow(()->new ApiException(404,"Site not found"));
        boolean canManage=user.hasRole("ADMIN") || (user.employeeId()!=null &&
                jdbc.sql("select p.coordinator_id from sites s join projects p on p.id=s.project_id where s.id=:id")
                        .param("id",siteId).query(Long.class).single().equals(user.employeeId()));
        List<Map<String,Object>> stages=jdbc.sql("""
                select ss.id,ss.name,ss.position,ss.status,ss.evidence_required,ss.depends_on_stage_id,
                       coalesce(array_agg(distinct rr.role_code order by rr.role_code) filter(where rr.role_code is not null),array[]::varchar[]) required_roles,
                       count(distinct ev.id) filter(where ev.upload_status='UPLOADED') evidence_count
                from site_stages ss left join site_stage_required_roles rr on rr.stage_id=ss.id
                left join evidence ev on ev.stage_id=ss.id where ss.site_id=:siteId
                group by ss.id order by ss.position
                """).param("siteId",siteId).query((rs,n)->{
                    Map<String,Object> row=new LinkedHashMap<>(); row.put("id",rs.getLong("id"));
                    row.put("name",rs.getString("name")); row.put("position",rs.getInt("position"));
                    row.put("status",rs.getString("status")); row.put("evidenceRequired",rs.getBoolean("evidence_required"));
                    List<String> requiredRoles=List.of((String[])rs.getArray("required_roles").getArray());
                    row.put("requiredRoles",requiredRoles);
                    row.put("evidenceCount",rs.getLong("evidence_count")); row.put("canManage",canManage);
                    boolean canUpload=canManage || (user.employeeId()!=null && jdbc.sql("""
                            select count(*) from site_stage_role_assignments where stage_id=:stage and employee_id=:employee
                            and role_code=any(:roles)
                            """).param("stage",rs.getLong("id")).param("employee",user.employeeId())
                            .param("roles",requiredRoles.toArray(String[]::new)).query(Long.class).single()>0);
                    row.put("canUpload",canUpload);
                    row.put("assignments",jdbc.sql("""
                            select rr.role_code,coalesce(e.id,t.id) employee_id,coalesce(e.name,t.name) employee_name from site_stage_required_roles rr
                            left join site_stage_role_assignments sra on sra.stage_id=rr.stage_id and sra.role_code=rr.role_code
                            left join employees e on e.id=sra.employee_id left join teams t on t.id=sra.team_id where rr.stage_id=:stage order by rr.role_code
                            """).param("stage",rs.getLong("id")).query((r2,n2)->{
                                Map<String,Object> a=new LinkedHashMap<>();a.put("role",r2.getString("role_code"));
                                a.put("employeeId",r2.getObject("employee_id"));a.put("employeeName",r2.getString("employee_name"));return a;
                            }).list());
                    return row;
                }).list();
        List<Map<String,Object>> assignmentHistory=new ArrayList<>(jdbc.sql("""
                select h.stage_id,h.role_code,h.created_at,coalesce(oe.name,ot.name) old_employee,coalesce(ne.name,nt.name) new_employee,u.name changed_by,hs.name stage_name
                from site_role_assignment_history h left join site_stages hs on hs.id=h.stage_id left join employees oe on oe.id=h.old_employee_id
                left join employees ne on ne.id=h.new_employee_id left join teams ot on ot.id=h.old_team_id left join teams nt on nt.id=h.new_team_id join app_users u on u.id=h.changed_by
                where h.site_id=:site order by h.created_at desc
                """).param("site",siteId).query((rs,n)->{
                    Map<String,Object> row=new LinkedHashMap<>();row.put("type","ROLE");row.put("role",rs.getString("role_code"));row.put("stage",value(rs.getString("stage_name")));row.put("stageId",rs.getObject("stage_id"));
                    row.put("oldValue",value(rs.getString("old_employee")));row.put("newValue",value(rs.getString("new_employee")));
                    row.put("changedBy",rs.getString("changed_by"));row.put("changedAt",rs.getTimestamp("created_at").toInstant());return row;
                }).list());
        assignmentHistory.addAll(jdbc.sql("""
                select h.created_at,ot.name old_team,nt.name new_team,u.name changed_by from site_team_assignment_history h
                left join teams ot on ot.id=h.old_team_id left join teams nt on nt.id=h.new_team_id
                join app_users u on u.id=h.changed_by where h.site_id=:site order by h.created_at desc
                """).param("site",siteId).query((rs,n)->Map.<String,Object>of("type","TEAM","role","TEAM",
                        "oldValue",value(rs.getString("old_team")),"newValue",value(rs.getString("new_team")),
                        "changedBy",rs.getString("changed_by"),"changedAt",rs.getTimestamp("created_at").toInstant())).list());
        site.put("canManage",canManage); site.put("assignmentHistory",assignmentHistory);
        site.put("stages",stages); return site;
    }


    /** Admin or the Project Coordinator assigns employees to the roles required by one Stage. */
    @PutMapping("/sites/{siteId}/stages/{stageId}/assignments")
    public void updateStageAssignments(@PathVariable long siteId,@PathVariable long stageId,
                                       @RequestBody StageAssignmentsRequest request,
                                       @AuthenticationPrincipal AppPrincipal user) {
        workflow.requireSiteManager(siteId,user);
        assignments.updateStage(siteId,stageId,request.roleAssignments()==null?Map.of():request.roleAssignments(),user);
    }

    @PostMapping(value="/stages/{stageId}/evidence",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public Map<String,Object> evidence(@PathVariable long stageId,@RequestPart("file") MultipartFile file,
                                       @RequestPart(value="comment",required=false) String comment,
                                       @AuthenticationPrincipal AppPrincipal user) throws IOException {
        if(file.isEmpty()) throw new ApiException(400,"Choose a non-empty evidence file");
        if(comment!=null&&comment.length()>2000) throw new ApiException(400,"Comment must be 2000 characters or fewer");
        requireAllowedEvidenceType(file);
        if(file.getSize()>15L*1024*1024) throw new ApiException(400,"Evidence file must be 15 MB or smaller");
        requireStageAccess(stageId,user);
        String current=jdbc.sql("select status from site_stages where id=:id").param("id",stageId).query(String.class).single();
        if(List.of("BLOCKED","REVIEW_PENDING","APPROVED","COMPLETED").contains(current))
            throw new ApiException(409,"Evidence cannot be added while this Stage is "+current.toLowerCase().replace('_',' '));
        Files.createDirectories(uploadDir);
        String rawName=Path.of(file.getOriginalFilename()==null?"evidence":file.getOriginalFilename()).getFileName().toString();
        if(rawName.length()>120){ int dot=rawName.lastIndexOf('.'); String ext=dot>=0&&rawName.length()-dot<=8?rawName.substring(dot):""; rawName=rawName.substring(0,120-ext.length())+ext; }
        final String displayName=rawName;
        String safeName=UUID.randomUUID()+"-"+rawName.replaceAll("[^A-Za-z0-9._-]","_");
        Path target=uploadDir.resolve(safeName).normalize();
        if(!target.startsWith(uploadDir)) throw new ApiException(400,"Invalid file name");
        Files.copy(file.getInputStream(),target, StandardCopyOption.REPLACE_EXISTING);
        long id=jdbc.sql("""
                insert into evidence(stage_id,file_name,content_type,storage_path,uploaded_by,comment)
                values(:stage,:name,:type,:path,:user,:comment) returning id
                """).param("stage",stageId).param("name",displayName)
                .param("type",canonicalContentType(extOf(displayName),file.getContentType())).param("path",target.toString()).param("user",user.id())
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
        long requiredRoleCount=jdbc.sql("select count(*) from site_stage_required_roles where stage_id=:id")
                .param("id",stageId).query(Long.class).single();
        if(requiredRoleCount==0) throw new ApiException(400,"A Stage with no required roles must be completed directly");
        long evidenceCount=jdbc.sql("select count(*) from evidence where stage_id=:id and upload_status='UPLOADED'")
                .param("id",stageId).query(Long.class).single();
        if(evidenceCount==0) throw new ApiException(400,"At least one successfully uploaded evidence file is required");
        long missingAssignments=jdbc.sql("""
                select count(*) from site_stage_required_roles rr join site_stages ss on ss.id=rr.stage_id
                left join site_stage_role_assignments sra on sra.stage_id=rr.stage_id and sra.role_code=rr.role_code
                where rr.stage_id=:id and sra.employee_id is null and sra.team_id is null
                """).param("id",stageId).query(Long.class).single();
        if(missingAssignments>0) throw new ApiException(400,"Assign an employee for every required role before submitting");
        String status=jdbc.sql("select status from site_stages where id=:id for update").param("id",stageId).query(String.class).single();
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
        String current=jdbc.sql("select status from site_stages where id=:id for update").param("id",stageId).query(String.class).single();
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

    @PostMapping("/stages/{stageId}/complete")
    @Transactional
    public void complete(@PathVariable long stageId,@AuthenticationPrincipal AppPrincipal user) {
        long siteId=workflow.siteIdForStage(stageId); workflow.requireSiteManager(siteId,user);
        long requiredRoleCount=jdbc.sql("select count(*) from site_stage_required_roles where stage_id=:id")
                .param("id",stageId).query(Long.class).single();
        if(requiredRoleCount>0) throw new ApiException(400,"Only a Stage with no required roles can be completed directly");
        long evidenceCount=jdbc.sql("select count(*) from evidence where stage_id=:id and upload_status='UPLOADED'")
                .param("id",stageId).query(Long.class).single();
        if(evidenceCount==0) throw new ApiException(400,"At least one successfully uploaded evidence file is required");
        String current=jdbc.sql("select status from site_stages where id=:id for update").param("id",stageId).query(String.class).single();
        if("BLOCKED".equals(current)) throw new ApiException(409,"Complete the dependency before completing this Stage");
        if(!List.of("READY","NOT_STARTED","IN_PROGRESS").contains(current))
            throw new ApiException(409,"This Stage cannot be completed from its current status");
        jdbc.sql("update site_stages set status='COMPLETED',completed_by=:user,completed_at=now(),updated_at=now() where id=:id")
                .param("user",user.id()).param("id",stageId).update();
        jdbc.sql("insert into stage_reviews(stage_id,action,action_by) values(:stage,'COMPLETED',:user)")
                .param("stage",stageId).param("user",user.id()).update();
        jdbc.sql("""
                update site_stages set status='READY',updated_at=now()
                where depends_on_stage_id=:completed and status='BLOCKED'
                """).param("completed",stageId).update();
        workflow.recalculate(siteId);
    }

    @GetMapping("/stages/{stageId}/history")
    public Map<String,Object> history(@PathVariable long stageId,@AuthenticationPrincipal AppPrincipal user) {
        requireStageAccess(stageId,user);
        List<Map<String,Object>> reviews=jdbc.sql("""
                select r.action,r.note,r.created_at,u.name action_by from stage_reviews r join app_users u on u.id=r.action_by
                where r.stage_id=:id order by r.created_at desc
                """).param("id",stageId).query((rs,n)->Map.<String,Object>of(
                        "action",rs.getString("action"),"note",value(rs.getString("note")),
                        "createdAt",rs.getTimestamp("created_at").toInstant(),"actionBy",rs.getString("action_by"))).list();
        return Map.of("reviews",reviews);
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
    public ResponseEntity<org.springframework.core.io.Resource> evidenceContent(@PathVariable long evidenceId,@AuthenticationPrincipal AppPrincipal user) throws IOException {
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
                .header("X-Content-Type-Options","nosniff")
                .contentLength(Files.size(path)).body(new org.springframework.core.io.FileSystemResource(path));
    }

    private static final String OOXML_XLSX="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static final String OOXML_DOCX="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    private static final java.util.Map<String,java.util.Set<String>> EVIDENCE_TYPES_BY_EXTENSION=java.util.Map.ofEntries(
            java.util.Map.entry("jpg",java.util.Set.of("image/jpeg")),java.util.Map.entry("jpeg",java.util.Set.of("image/jpeg")),
            java.util.Map.entry("png",java.util.Set.of("image/png")),java.util.Map.entry("webp",java.util.Set.of("image/webp")),
            java.util.Map.entry("gif",java.util.Set.of("image/gif")),
            java.util.Map.entry("heic",java.util.Set.of("image/heic","image/heif")),java.util.Map.entry("heif",java.util.Set.of("image/heic","image/heif")),
            java.util.Map.entry("pdf",java.util.Set.of("application/pdf")),
            java.util.Map.entry("xls",java.util.Set.of("application/vnd.ms-excel")),
            java.util.Map.entry("xlsx",java.util.Set.of(OOXML_XLSX)),
            java.util.Map.entry("doc",java.util.Set.of("application/msword")),
            java.util.Map.entry("docx",java.util.Set.of(OOXML_DOCX)));

    private void requireAllowedEvidenceType(MultipartFile file) {
        String type=file.getContentType()==null?"":file.getContentType().toLowerCase(java.util.Locale.ROOT);
        String name=file.getOriginalFilename()==null?"":file.getOriginalFilename().toLowerCase(java.util.Locale.ROOT);
        String extension=name.contains(".")?name.substring(name.lastIndexOf('.')+1):"";
        java.util.Set<String> allowed=EVIDENCE_TYPES_BY_EXTENSION.get(extension);
        boolean office=List.of("xls","xlsx","doc","docx").contains(extension);
        boolean typeOk=allowed!=null&&(allowed.contains(type)||(office&&"application/octet-stream".equals(type)));
        if(!typeOk)
            throw new ApiException(400,"Evidence must be an image, PDF, Excel (xls, xlsx) or Word (doc, docx) file");
        byte[] head;
        try (java.io.InputStream in=file.getInputStream()) { head=in.readNBytes(16); } catch (IOException e) { throw new ApiException(400,"Could not read the file"); }
        if(!contentMatchesExtension(extension,head))
            throw new ApiException(400,"File content does not match its "+extension+" extension");
    }

    private static String extOf(String n){int d=n.lastIndexOf('.');return d<0?"":n.substring(d+1).toLowerCase(java.util.Locale.ROOT);}

    private static String canonicalContentType(String extension,String sent) {
        java.util.Set<String> allowed=EVIDENCE_TYPES_BY_EXTENSION.get(extension);
        if(allowed!=null&&sent!=null&&allowed.contains(sent.toLowerCase(java.util.Locale.ROOT))) return sent.toLowerCase(java.util.Locale.ROOT);
        return switch(extension){case "xls"->"application/vnd.ms-excel";case "xlsx"->OOXML_XLSX;case "doc"->"application/msword";case "docx"->OOXML_DOCX;default->sent;};
    }

    private static boolean contentMatchesExtension(String extension,byte[] h) {
        if(h.length<4) return false;
        boolean ole=(h[0]&0xFF)==0xD0&&(h[1]&0xFF)==0xCF&&(h[2]&0xFF)==0x11&&(h[3]&0xFF)==0xE0;
        boolean zip=h[0]=='P'&&h[1]=='K'&&h[2]==3&&h[3]==4;
        return switch(extension){
            case "xls","doc"->ole;
            case "xlsx","docx"->zip;
            default->looksLikeAllowedFile(h)&&!ole&&!zip;
        };
    }

    private static boolean looksLikeAllowedFile(byte[] h) {
        if(h.length<4) return false;
        boolean png=(h[0]&0xFF)==0x89&&h[1]=='P'&&h[2]=='N'&&h[3]=='G';
        boolean jpeg=(h[0]&0xFF)==0xFF&&(h[1]&0xFF)==0xD8;
        boolean gif=h[0]=='G'&&h[1]=='I'&&h[2]=='F'&&h[3]=='8';
        boolean pdf=h[0]=='%'&&h[1]=='P'&&h[2]=='D'&&h[3]=='F';
        boolean riffWebp=h.length>=12&&h[0]=='R'&&h[1]=='I'&&h[2]=='F'&&h[3]=='F'&&h[8]=='W'&&h[9]=='E'&&h[10]=='B'&&h[11]=='P';
        boolean heic=h.length>=12&&h[4]=='f'&&h[5]=='t'&&h[6]=='y'&&h[7]=='p';
        return png||jpeg||gif||pdf||riffWebp||heic;
    }

    /** Admin edits Site master details (name, address, target date). */
    @PutMapping("/sites/{siteId}")
    @PreAuthorize("hasRole('ADMIN')")
    public void updateSite(@PathVariable long siteId,@Valid @RequestBody SiteDetailsRequest request) {
        if(jdbc.sql("select count(*) from sites where project_id=(select project_id from sites where id=:id) and id<>:id and lower(trim(name))=lower(trim(:n))").param("id",siteId).param("n",request.name()).query(Long.class).single()>0)
            throw new ApiException(409,"This Project already has a Site with that name");
        int changed=jdbc.sql("update sites set name=:name,address=:address,target_date=:target,updated_at=now() where id=:id")
                .param("name",request.name().trim()).param("address",request.address()).param("target",request.targetDate())
                .param("id",siteId).update();
        if(changed==0) throw new ApiException(404,"Site not found");
    }

    /** Admin moves a Site, with its Stages, evidence and history, to another Project. */
    @DeleteMapping("/sites/{siteId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public void deleteSite(@PathVariable long siteId) {
        Long projectId=jdbc.sql("select project_id from sites where id=:id for update").param("id",siteId).query(Long.class).optional()
                .orElseThrow(()->new ApiException(404,"Site not found"));
        List<String> paths=jdbc.sql("select e.storage_path from evidence e join site_stages ss on ss.id=e.stage_id where ss.site_id=:id")
                .param("id",siteId).query(String.class).list();
        jdbc.sql("delete from sites where id=:id").param("id",siteId).update();
        jdbc.sql("update projects set updated_at=now() where id=:id").param("id",projectId).update();
        workflow.recalculateProject(projectId);
        for(String stored:paths) {
            Path path=Path.of(stored).toAbsolutePath().normalize();
            if(!path.startsWith(uploadDir)) continue;
            try { Files.deleteIfExists(path); } catch(IOException ignored) { }
        }
    }

    private void requireStageAccess(long stageId,AppPrincipal user) {
        if(user.hasRole("ADMIN")) return;
        boolean allowed=user.employeeId()!=null && jdbc.sql("""
                select count(*) from site_stages ss join sites s on s.id=ss.site_id join projects p on p.id=s.project_id
                where ss.id=:id and (p.coordinator_id=:employee or exists(
                  select 1 from site_stage_required_roles rr join site_stage_role_assignments sra
                    on sra.stage_id=rr.stage_id and sra.role_code=rr.role_code
                  where rr.stage_id=ss.id and sra.employee_id=:employee))
                """).param("id",stageId).param("employee",user.employeeId()).query(Long.class).single()>0;
        if(!allowed) throw new ApiException(403,"This Stage is not assigned to you");
    }

    private String value(String value) { return value == null ? "—" : value; }
    public record ReviewRequest(String action,String note) {}
    public record EvidenceFile(Long stageId,String storagePath,String contentType,String fileName) {}
    public record SiteTeamRequest(Long teamId) {}
    public record SiteDetailsRequest(@jakarta.validation.constraints.NotBlank String name,String address,java.time.LocalDate targetDate) {}
    public record StageAssignmentsRequest(Map<String,Long> roleAssignments) {}
}
