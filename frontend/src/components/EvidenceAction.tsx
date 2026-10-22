import { useState } from 'react'
import { api, post } from '../lib/api'

export type EvidenceStage={id:number;status:string;evidenceCount:number;canUpload:boolean;requiredRoles:string[]}

export function EvidenceAction({stage,onSaved}:{stage:EvidenceStage;onSaved:()=>void}){
  const [open,setOpen]=useState(false);const [file,setFile]=useState<File|null>(null);const [comment,setComment]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const locked=['BLOCKED','REVIEW_PENDING','APPROVED','COMPLETED'].includes(stage.status);const roleBased=stage.requiredRoles.length>0
  const upload=async()=>{if(!file)return;setBusy(true);setError('');try{const body=new FormData();body.append('file',file);body.append('comment',comment);await api(`/stages/${stage.id}/evidence`,{method:'POST',body});setFile(null);setComment('');setOpen(false);onSaved()}catch(err){setError(err instanceof Error?err.message:'Evidence upload failed')}finally{setBusy(false)}}
  const submit=async()=>{setBusy(true);setError('');try{await post(`/stages/${stage.id}/submit`);onSaved()}catch(err){setError(err instanceof Error?err.message:'Could not submit Stage')}finally{setBusy(false)}}
  if(!stage.canUpload)return null
  return <div className="evidence-action">{error&&<div className="alert alert--error" role="alert">{error}</div>}<div className="evidence-action__buttons"><button className="button button--secondary" disabled={locked||busy} onClick={()=>setOpen(!open)}>Add evidence</button>{roleBased&&<button className="button button--primary" disabled={busy||stage.evidenceCount===0||!['READY','IN_PROGRESS','CHANGES_REQUESTED'].includes(stage.status)} onClick={submit}>{busy?'Working…':'Submit for approval'}</button>}</div>{open&&<div className="evidence-upload"><label>Evidence file *<input type="file" accept="image/*,application/pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><label>Comment<textarea rows={2} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Describe what this evidence shows"/></label><button className="button button--primary" disabled={!file||busy} onClick={upload}>{busy?'Uploading…':'Upload evidence'}</button></div>}</div>
}
