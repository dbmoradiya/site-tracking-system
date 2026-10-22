import { ArrowLeft, ArrowRight, CalendarDays, Phone, Plus, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loading } from '../components/Loading'
import { StatusBadge } from '../components/StatusBadge'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

type Site={id:number;name:string;address:string;targetDate:string;status:string;siteType:string;coordinator:string;stageCount:number;approvedStages:number;canManage:boolean}
type Project={id:number;name:string;customerName:string;customerMobile:string;address:string;targetDate:string;status:string;sites:Site[]}

export function ProjectDetailPage(){
  const {projectId}=useParams(); const {user}=useAuth(); const [project,setProject]=useState<Project|null>(null)
  useEffect(()=>{api<Project>(`/projects/${projectId}`).then(setProject)},[projectId])
  if(!project)return <Loading label="Loading project"/>
  return <div className="page"><Link className="back-link" to="/projects"><ArrowLeft/>All projects</Link>
    <header className="detail-hero"><div><div className="detail-hero__meta"><span>{project.name.slice(0,2).toUpperCase()}</span><StatusBadge status={project.status}/></div><h1>{project.name}</h1><p>{project.address||'No project address'}</p></div>{user?.role==='ADMIN'&&<Link className="button button--primary" to={`/projects/${project.id}/sites/new`}><Plus/>Add Site</Link>}</header>
    <section className="info-strip"><div><UserRound/><span><small>Customer</small><strong>{project.customerName}</strong></span></div><div><Phone/><span><small>Mobile</small><strong>{project.customerMobile}</strong></span></div><div><CalendarDays/><span><small>Target date</small><strong>{project.targetDate||'Not set'}</strong></span></div></section>
    <section><div className="section-heading"><div><p className="eyebrow">Execution</p><h2>Project Sites</h2></div><span>{project.sites.length} total</span></div>
      <div className="site-list">{project.sites.map(site=>{const progress=site.stageCount?site.approvedStages/site.stageCount*100:0;return <Link className="site-card" key={site.id} to={`/sites/${site.id}`}><div className="site-card__header"><span className="site-type">{site.siteType}</span><StatusBadge status={site.status}/></div><h3>{site.name}</h3><p>Coordinator: {site.coordinator}</p><div className="progress-label"><span>Stage progress</span><strong>{site.approvedStages} / {site.stageCount}</strong></div><div className="progress"><i style={{width:`${progress}%`}}/></div><span className="card-link">Open Site <ArrowRight/></span></Link>})}</div>
    </section>
  </div>
}
