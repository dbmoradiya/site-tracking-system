import { ArrowRight, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Loading } from '../components/Loading'
import { StatusBadge } from '../components/StatusBadge'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

type Project={id:number;name:string;customerName:string;customerMobile:string;address:string;targetDate:string;status:string;siteCount:number;completedSites:number}

export function ProjectsPage(){
  const {user}=useAuth(); const [items,setItems]=useState<Project[]|null>(null); const [query,setQuery]=useState('')
  useEffect(()=>{api<Project[]>('/projects').then(setItems)},[])
  const filtered=useMemo(()=>items?.filter(p=>`${p.name} ${p.customerName}`.toLowerCase().includes(query.toLowerCase()))||[],[items,query])
  if(!items)return <Loading label="Loading projects"/>
  return <div className="page"><header className="page-header"><div><p className="eyebrow">Portfolio</p><h1>Projects</h1><p>Sites, customers and delivery status in one place.</p></div>{user?.role==='ADMIN'&&<Link className="button button--primary" to="/projects/new"><Plus/>New project</Link>}</header>
    <div className="toolbar"><label className="search"><Search/><span className="sr-only">Search projects</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects or customers"/></label><span>{filtered.length} projects</span></div>
    {filtered.length===0?<EmptyState title="No projects found" description="Try another search or create your first Project."/>:<div className="card-grid">
      {filtered.map(p=><Link className="project-card" to={`/projects/${p.id}`} key={p.id}><div className="project-card__top"><span className="project-card__mark">{p.name.slice(0,2).toUpperCase()}</span><StatusBadge status={p.status}/></div><h2>{p.name}</h2><p>{p.customerName}</p><dl><div><dt>Sites</dt><dd>{p.siteCount}</dd></div><div><dt>Completed</dt><dd>{p.completedSites}</dd></div><div><dt>Target</dt><dd>{p.targetDate||'Not set'}</dd></div></dl><span className="card-link">Open project <ArrowRight/></span></Link>)}
    </div>}
  </div>
}
