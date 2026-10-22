import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, FileCheck2, Phone, Plus, UserRound, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EvidenceAction } from '../components/EvidenceAction'
import { Loading } from '../components/Loading'
import { StatusBadge } from '../components/StatusBadge'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

type Site={id:number;name:string;address:string;targetDate:string;status:string;siteType:string;coordinator:string;stageCount:number;approvedStages:number;canManage:boolean}
type Stage={id:number;name:string;position:number;status:string;supervisor:string;team:string;evidenceCount:number;canUpload:boolean}
type SiteDetail={id:number;stages:Stage[]}
type Project={id:number;name:string;customerName:string;customerMobile:string;address:string;targetDate:string;status:string;sites:Site[]}

export function ProjectDetailPage(){
  const {projectId}=useParams();const {user}=useAuth();const [project,setProject]=useState<Project|null>(null);const [details,setDetails]=useState<Record<number,SiteDetail>>({});const [expanded,setExpanded]=useState<Record<number,boolean>>({});const [error,setError]=useState('')
  const load=useCallback(async()=>{try{const current=await api<Project>(`/projects/${projectId}`);setProject(current);const resolved=await Promise.all(current.sites.map(async site=>{try{return [site.id,await api<SiteDetail>(`/sites/${site.id}`)] as const}catch{return [site.id,null] as const}}));setDetails(Object.fromEntries(resolved.filter((entry):entry is readonly [number,SiteDetail]=>entry[1]!==null)))}catch(err){setError(err instanceof Error?err.message:'Could not load Project')}},[projectId]);useEffect(()=>{load()},[load])
  if(!project)return error?<div className="page"><div className="alert alert--error" role="alert">{error}</div><Link className="button button--secondary" to="/projects">Back to Projects</Link></div>:<Loading label="Loading project"/>
  return <div className="page"><Link className="back-link" to="/projects"><ArrowLeft/>All projects</Link>
    <header className="detail-hero"><div><div className="detail-hero__meta"><span>{project.name.slice(0,2).toUpperCase()}</span><StatusBadge status={project.status}/></div><h1>{project.name}</h1><p>{project.address||'No project address'}</p></div>{user?.role==='ADMIN'&&<Link className="button button--primary" to={`/projects/${project.id}/sites/new`}><Plus/>Add Site</Link>}</header>
    <section className="info-strip"><div><UserRound/><span><small>Customer</small><strong>{project.customerName}</strong></span></div><div><Phone/><span><small>Mobile</small><strong>{project.customerMobile}</strong></span></div><div><CalendarDays/><span><small>Target date</small><strong>{project.targetDate||'Not set'}</strong></span></div></section>
    <section><div className="section-heading"><div><p className="eyebrow">Execution</p><h2>Project Sites</h2></div><span>{project.sites.length} total</span></div>
      <div className="project-site-list">{project.sites.map(site=>{const progress=site.stageCount?site.approvedStages/site.stageCount*100:0;const detail=details[site.id];const isOpen=!!expanded[site.id];return <article className="project-site" key={site.id}><header><div><div className="project-site__labels"><span className="site-type">{site.siteType}</span><StatusBadge status={site.status}/></div><h3>{site.name}</h3><p>Coordinator: {site.coordinator}</p></div><div className="project-site__progress"><strong>{Math.round(progress)}%</strong><span className="progress"><i style={{width:`${progress}%`}}/></span><small>{site.approvedStages} of {site.stageCount} Stages approved</small></div></header><div className="project-site__actions">{detail&&<button className="button button--secondary" onClick={()=>setExpanded({...expanded,[site.id]:!isOpen})} aria-expanded={isOpen}>{isOpen?'Hide Stages':'Show Stages'}<ChevronDown className={isOpen?'rotated':''}/></button>}<Link className="card-link" to={`/sites/${site.id}`}>Open Site details <ArrowRight/></Link></div>{isOpen&&detail&&<div className="project-stage-list">{detail.stages.map(stage=><section className="project-stage" key={stage.id}><div className="project-stage__summary"><span className="stage-number">{stage.position}</span><div><strong>{stage.name}</strong><small><Users/>{stage.supervisor} · {stage.team}</small></div><span className="evidence-count"><FileCheck2/>{stage.evidenceCount}</span><StatusBadge status={stage.status}/></div><EvidenceAction stage={stage} onSaved={load}/></section>)}</div>}</article>})}</div>
    </section>
  </div>
}
