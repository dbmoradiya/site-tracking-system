import { Camera, CheckCircle2, ExternalLink, Phone, RefreshCcw, Send, UploadCloud } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Loading } from '../components/Loading'
import { StatusBadge } from '../components/StatusBadge'
import { api, post } from '../lib/api'

type Work={id:number;stageName:string;status:string;siteId:number;siteName:string;projectName:string;team:string|null;contactName:string|null;mobile:string|null;evidenceCount:number}

export function WorkPage(){
  const [items,setItems]=useState<Work[]|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState<number|null>(null);const inputRefs=useRef<Record<number,HTMLInputElement|null>>({})
  const load=useCallback(()=>api<Work[]>('/work').then(setItems).catch(e=>setError(e.message)),[]);useEffect(()=>{load()},[load])
  const upload=async(stage:Work,file:File)=>{setBusy(stage.id);setError('');try{const body=new FormData();body.append('file',file);await api(`/stages/${stage.id}/evidence`,{method:'POST',body});await load()}catch(err){setError(err instanceof Error?err.message:'Upload failed. Check your connection and retry.')}finally{setBusy(null)}}
  const submit=async(stage:Work)=>{setBusy(stage.id);setError('');try{await post(`/stages/${stage.id}/submit`);await load()}catch(err){setError(err instanceof Error?err.message:'Could not submit Stage')}finally{setBusy(null)}}
  if(!items)return <Loading label="Loading assigned work"/>
  return <div className="page"><header className="page-header page-header--hero"><div><p className="eyebrow">Field workspace</p><h1>My work</h1><p>Upload evidence online, then send the Stage for review.</p></div></header>{error&&<div className="alert alert--error"><RefreshCcw/>{error}</div>}
    {items.length===0?<EmptyState title="No assigned work" description="Assigned Stages will appear here."/>:<div className="work-grid">{items.map(item=><article className="work-card" key={item.id}><div className="work-card__top"><span className="work-card__number">{item.projectName.slice(0,2).toUpperCase()}</span><StatusBadge status={item.status}/></div><p className="eyebrow">{item.projectName} · {item.siteName}</p><h2>{item.stageName}</h2><div className="work-card__team"><div><strong>{item.team||'Team not assigned'}</strong><span>{item.contactName||'No contact'} {item.mobile&&<>· <a href={`tel:${item.mobile}`}><Phone/> {item.mobile}</a></>}</span></div></div><div className="evidence-summary"><UploadCloud/><span><strong>{item.evidenceCount}</strong><small>successful uploads</small></span>{item.evidenceCount>0&&<CheckCircle2 className="success-icon"/>}</div><input ref={node=>{inputRefs.current[item.id]=node}} className="sr-only" type="file" accept="image/*" capture="environment" onChange={e=>e.target.files?.[0]&&upload(item,e.target.files[0])}/><div className="work-card__actions"><button className="button button--secondary" disabled={busy===item.id||item.status==='BLOCKED'||item.status==='APPROVED'} onClick={()=>inputRefs.current[item.id]?.click()}><Camera/>{busy===item.id?'Uploading…':'Add evidence'}</button><button className="button button--primary" disabled={busy===item.id||item.evidenceCount===0||!['IN_PROGRESS','CHANGES_REQUESTED','READY'].includes(item.status)} onClick={()=>submit(item)}><Send/>Submit</button></div><Link className="card-link" to={`/sites/${item.siteId}`}>Open Site <ExternalLink/></Link></article>)}</div>}
  </div>
}
