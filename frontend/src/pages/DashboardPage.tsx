import { ArrowUpRight, Bell, Building2, CheckCircle2, CircleDashed, Clock3 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loading } from '../components/Loading'
import { StatusBadge } from '../components/StatusBadge'
import { api, hasRole } from '../lib/api'
import { useAuth } from '../lib/auth'

type Dashboard = { counts: { status: string; total: number }[]; recentProjects: Project[] }
type Project = { id:number; name:string; customerName:string; status:string; targetDate:string; siteCount:number; completedSites:number }
type Notification = {stageId:number;stageName:string;siteId:number;siteName:string;projectId:number;projectName:string;status:string;updatedAt:string;title:string;actionLabel:string}

export function DashboardPage() {
  const { user } = useAuth(); const [data,setData]=useState<Dashboard|null>(null);const [notifications,setNotifications]=useState<Notification[]>([]); const [error,setError]=useState('')
  useEffect(()=>{Promise.all([api<Dashboard>('/dashboard'),api<Notification[]>('/notifications')]).then(([dashboard,actions])=>{setData(dashboard);setNotifications(actions)}).catch(e=>setError(e.message))},[])
  const totals=useMemo(()=>Object.fromEntries(data?.counts.map(c=>[c.status,c.total])||[]),[data])
  if(!data && !error) return <Loading label="Preparing your workspace" />
  return <div className="page">
    <header className="page-header page-header--hero">
      <div><p className="eyebrow">Operations overview</p><h1>Good day, {user?.name.split(' ')[0]}.</h1><p>Keep every project moving with the right evidence and decisions.</p></div>
      {hasRole(user,'ADMIN') && <Link className="button button--primary" to="/projects/new">New project <ArrowUpRight /></Link>}
    </header>
    {error && <div className="alert alert--error">{error}</div>}
    <section className="metric-grid" aria-label="Project status summary">
      <Metric to="/projects" icon={<Building2/>} label="All projects" value={Object.values(totals).reduce((a,b)=>a+Number(b),0)} tone="navy" />
      <Metric to="/projects?status=IN_PROGRESS" icon={<Clock3/>} label="In progress" value={totals.IN_PROGRESS||0} tone="orange" />
      <Metric to="/projects?status=NOT_STARTED" icon={<CircleDashed/>} label="Not started" value={totals.NOT_STARTED||0} tone="slate" />
      <Metric to="/projects?status=COMPLETED" icon={<CheckCircle2/>} label="Completed" value={totals.COMPLETED||0} tone="green" />
    </section>
    <section className="section-card notification-section">
      <div className="section-heading"><div><p className="eyebrow"><Bell/> Action centre</p><h2>Notifications</h2></div><span className="notification-count">{notifications.length} pending</span></div>
      {notifications.length===0?<div className="notification-empty"><CheckCircle2/><div><strong>You are all caught up</strong><p>No pending action needs your attention.</p></div></div>:<div className="notification-list">{notifications.slice(0,8).map(item=><Link to={`/projects/${item.projectId}`} key={`${item.stageId}-${item.status}`}><span className="notification-icon"><Bell/></span><span><strong>{item.title}</strong><small>{item.projectName} · {item.siteName} · {item.stageName}</small></span><span className="notification-time">{new Date(item.updatedAt).toLocaleDateString()}</span><ArrowUpRight/></Link>)}</div>}
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

function Metric({to,icon,label,value,tone}:{to:string;icon:ReactNode;label:string;value:number;tone:string}) {
  return <Link to={to} className={`metric metric--${tone}`} aria-label={`${label}: ${value}`}><span className="metric__icon" aria-hidden="true">{icon}</span><span className="metric__content" aria-hidden="true"><small>{label}</small><strong>{value}</strong></span><ArrowUpRight className="metric__arrow" aria-hidden="true"/></Link>
}
