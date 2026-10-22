import { ArrowRight, Filter, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Loading } from '../components/Loading'
import { StatusBadge } from '../components/StatusBadge'
import { api, hasRole } from '../lib/api'
import { useAuth } from '../lib/auth'

type Project={id:number;name:string;customerName:string;customerMobile:string;address:string;targetDate:string;status:string;siteCount:number;completedSites:number;coordinators:string[];supervisors:string[];actionRequired:number}
type Filters={location:string;dateFrom:string;dateTo:string;supervisor:string;coordinator:string;status:string;action:string}
const emptyFilters:Filters={location:'',dateFrom:'',dateTo:'',supervisor:'',coordinator:'',status:'',action:''}

export function ProjectsPage(){
  const {user}=useAuth();const [searchParams,setSearchParams]=useSearchParams();const [items,setItems]=useState<Project[]|null>(null);const [query,setQuery]=useState('');const [showFilters,setShowFilters]=useState(false);const [filters,setFilters]=useState<Filters>(()=>({...emptyFilters,status:validStatus(searchParams.get('status'))}))
  useEffect(()=>{api<Project[]>('/projects').then(setItems)},[])
  useEffect(()=>{setFilters(current=>({...current,status:validStatus(searchParams.get('status'))}))},[searchParams])
  const supervisors=useMemo(()=>unique(items?.flatMap(p=>p.supervisors)||[]),[items]);const coordinators=useMemo(()=>unique(items?.flatMap(p=>p.coordinators)||[]),[items])
  const activeCount=Object.values(filters).filter(Boolean).length
  const filtered=useMemo(()=>items?.filter(p=>{
    const search=`${p.name} ${p.customerName} ${p.address}`.toLowerCase().includes(query.toLowerCase())
    return search&&(!filters.location||p.address.toLowerCase().includes(filters.location.toLowerCase()))&&(!filters.dateFrom||(!!p.targetDate&&p.targetDate>=filters.dateFrom))&&(!filters.dateTo||(!!p.targetDate&&p.targetDate<=filters.dateTo))&&(!filters.supervisor||p.supervisors.includes(filters.supervisor))&&(!filters.coordinator||p.coordinators.includes(filters.coordinator))&&(!filters.status||p.status===filters.status)&&(!filters.action||(filters.action==='required'?p.actionRequired>0:p.actionRequired===0))
  })||[],[items,query,filters])
  const change=(key:keyof Filters,value:string)=>{setFilters({...filters,[key]:value});if(key==='status'){const next=new URLSearchParams(searchParams);if(value)next.set('status',value);else next.delete('status');setSearchParams(next)}}
  const clearFilters=()=>{setFilters(emptyFilters);const next=new URLSearchParams(searchParams);next.delete('status');setSearchParams(next)}
  if(!items)return <Loading label="Loading projects"/>
  return <div className="page"><header className="page-header"><div><p className="eyebrow">Portfolio</p><h1>Projects</h1><p>Find work by delivery date, people, location, status or pending action.</p></div>{hasRole(user,'ADMIN')&&<Link className="button button--primary" to="/projects/new"><Plus/>New project</Link>}</header>
    <div className="toolbar project-toolbar"><label className="search"><Search aria-hidden="true"/><span className="sr-only">Search projects</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects, customers or locations"/></label><button className={`button button--secondary ${activeCount?'filter-active':''}`} onClick={()=>setShowFilters(!showFilters)} aria-expanded={showFilters}><Filter/>Advanced filters {activeCount>0&&<span className="filter-count">{activeCount}</span>}</button><span>{filtered.length} projects</span></div>
    {showFilters&&<section className="filter-panel" aria-label="Advanced project filters"><div className="filter-panel__heading"><div><p className="eyebrow">Refine portfolio</p><h2>Advanced filters</h2></div><button className="icon-button" onClick={()=>setShowFilters(false)} aria-label="Close filters"><X/></button></div><div className="filter-grid"><label>Location<input value={filters.location} onChange={e=>change('location',e.target.value)} placeholder="City, area or address"/></label><label>Completion date from<input type="date" value={filters.dateFrom} onChange={e=>change('dateFrom',e.target.value)}/></label><label>Completion date to<input type="date" value={filters.dateTo} onChange={e=>change('dateTo',e.target.value)}/></label><label>Supervisor<select value={filters.supervisor} onChange={e=>change('supervisor',e.target.value)}><option value="">All Supervisors</option>{supervisors.map(name=><option key={name}>{name}</option>)}</select></label><label>Coordinator<select value={filters.coordinator} onChange={e=>change('coordinator',e.target.value)}><option value="">All Coordinators</option>{coordinators.map(name=><option key={name}>{name}</option>)}</select></label><label>Status<select value={filters.status} onChange={e=>change('status',e.target.value)}><option value="">All statuses</option><option value="NOT_STARTED">Not started</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option></select></label><label>Action required<select value={filters.action} onChange={e=>change('action',e.target.value)}><option value="">All projects</option><option value="required">Action required</option><option value="clear">No action required</option></select></label></div><button className="button button--ghost" onClick={clearFilters} disabled={activeCount===0}>Clear all filters</button></section>}
    {filtered.length===0?<EmptyState title="No projects found" description="Change or clear filters to see more Projects."/>:<div className="card-grid">
      {filtered.map(p=><Link className="project-card" to={`/projects/${p.id}`} key={p.id}><div className="project-card__top"><span className="project-card__mark">{p.name.slice(0,2).toUpperCase()}</span><StatusBadge status={p.status}/></div><h2>{p.name}</h2><p>{p.customerName} · {p.address||'No location'}</p>{p.actionRequired>0&&<span className="action-pill">{p.actionRequired} action{p.actionRequired===1?'':'s'} required</span>}<dl><div><dt>Sites</dt><dd>{p.siteCount}</dd></div><div><dt>Completed</dt><dd>{p.completedSites}</dd></div><div><dt>Target</dt><dd>{p.targetDate||'Not set'}</dd></div></dl><span className="card-link">Open project <ArrowRight/></span></Link>)}
    </div>}
  </div>
}

function unique(values:string[]){return [...new Set(values)].sort((a,b)=>a.localeCompare(b))}
function validStatus(value:string|null){return ['NOT_STARTED','IN_PROGRESS','COMPLETED'].includes(value||'')?value||'':''}
