import { ArrowUpRight, Building2, CheckCircle2, CircleDashed, Clock3 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loading } from '../components/Loading'
import { StatusBadge } from '../components/StatusBadge'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

type Dashboard = { counts: { status: string; total: number }[]; recentProjects: Project[] }
type Project = { id:number; name:string; customerName:string; status:string; targetDate:string; siteCount:number; completedSites:number }

export function DashboardPage() {
  const { user } = useAuth(); const [data,setData]=useState<Dashboard|null>(null); const [error,setError]=useState('')
  useEffect(()=>{ api<Dashboard>('/dashboard').then(setData).catch(e=>setError(e.message)) },[])
  const totals=useMemo(()=>Object.fromEntries(data?.counts.map(c=>[c.status,c.total])||[]),[data])
  if(!data && !error) return <Loading label="Preparing your workspace" />
  return <div className="page">
    <header className="page-header page-header--hero">
      <div><p className="eyebrow">Operations overview</p><h1>Good day, {user?.name.split(' ')[0]}.</h1><p>Keep every project moving with the right evidence and decisions.</p></div>
      {user?.role==='ADMIN' && <Link className="button button--primary" to="/projects/new">New project <ArrowUpRight /></Link>}
    </header>
    {error && <div className="alert alert--error">{error}</div>}
    <section className="metric-grid" aria-label="Project status summary">
      <Metric icon={<Building2/>} label="All projects" value={Object.values(totals).reduce((a,b)=>a+Number(b),0)} tone="navy" />
      <Metric icon={<Clock3/>} label="In progress" value={totals.IN_PROGRESS||0} tone="orange" />
      <Metric icon={<CircleDashed/>} label="Not started" value={totals.NOT_STARTED||0} tone="slate" />
      <Metric icon={<CheckCircle2/>} label="Completed" value={totals.COMPLETED||0} tone="green" />
    </section>
    <section className="section-card">
      <div className="section-heading"><div><p className="eyebrow">Live portfolio</p><h2>Recent projects</h2></div><Link to="/projects">View all</Link></div>
      <div className="project-list">
        {data?.recentProjects.map(project=><Link to={`/projects/${project.id}`} className="project-row" key={project.id}>
          <span className="project-row__mark">{project.name.slice(0,2).toUpperCase()}</span>
          <span className="project-row__main"><strong>{project.name}</strong><small>{project.customerName}</small></span>
          <span className="project-row__progress"><small>{project.completedSites} of {project.siteCount} Sites complete</small><span><i style={{width:`${project.siteCount?project.completedSites/project.siteCount*100:0}%`}} /></span></span>
          <StatusBadge status={project.status}/><ArrowUpRight className="project-row__arrow"/>
        </Link>)}
      </div>
    </section>
  </div>
}

function Metric({icon,label,value,tone}:{icon:ReactNode;label:string;value:number;tone:string}) {
  return <article className={`metric metric--${tone}`}><span className="metric__icon">{icon}</span><span><small>{label}</small><strong>{value}</strong></span></article>
}
