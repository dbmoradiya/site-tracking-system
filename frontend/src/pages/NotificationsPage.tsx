import { Bell, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { NotificationList, type NotificationPage } from '../components/NotificationList'
import { Loading } from '../components/Loading'
import { api } from '../lib/api'

export function NotificationsPage(){
  const [params,setParams]=useSearchParams();const [data,setData]=useState<NotificationPage|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true)
  const search=params.get('search')||'';const type=params.get('type')||'';const status=params.get('status')||'';const page=Math.max(0,Number(params.get('page')||0)||0)
  useEffect(()=>{const timer=window.setTimeout(()=>{setLoading(true);setError('');api<NotificationPage>(`/notifications?page=${page}&size=20&type=${encodeURIComponent(type)}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`).then(setData).catch(e=>setError(e.message)).finally(()=>setLoading(false))},250);return()=>window.clearTimeout(timer)},[page,search,status,type])
  const update=(key:string,value:string)=>{const next=new URLSearchParams(params);value?next.set(key,value):next.delete(key);if(key!=='page')next.delete('page');setParams(next)}
  const clear=()=>setParams({});const filtered=Boolean(search||type||status)
  return <div className="page page--narrow"><header className="page-header"><div><p className="eyebrow"><Bell/>Action centre</p><h1>Notifications</h1><p>Review every pending action assigned to you.</p></div>{data&&<span className="notification-count">{data.total} pending</span>}</header>
    <section className="notification-filters" aria-label="Notification filters"><label className="notification-search"><span className="sr-only">Search notifications</span><Search aria-hidden="true"/><input value={search} onChange={event=>update('search',event.target.value)} placeholder="Search project, Site or Stage"/></label><label><span>Type</span><select value={type} onChange={event=>update('type',event.target.value)}><option value="">All action types</option><option value="APPROVAL_REQUEST">Approval requests</option><option value="MISSING_ASSIGNMENT">Missing assignments</option><option value="NO_ROLE_ACTION">No-role actions</option><option value="CHANGES_REQUESTED">Changes requested</option><option value="ASSIGNED_WORK">Assigned work</option></select></label><label><span>Status</span><select value={status} onChange={event=>update('status',event.target.value)}><option value="">All statuses</option><option value="NOT_STARTED">Not started</option><option value="READY">Ready</option><option value="IN_PROGRESS">In progress</option><option value="REVIEW_PENDING">Review pending</option><option value="CHANGES_REQUESTED">Changes requested</option><option value="BLOCKED">Blocked</option></select></label>{filtered&&<button className="button button--ghost" onClick={clear}><X/>Clear filters</button>}</section>
    {error&&<div className="alert alert--error" role="alert">{error}</div>}{loading&&!data?<Loading label="Loading notifications"/>:<section className="section-card notifications-page-card" aria-busy={loading}>{data&&<NotificationList items={data.items} filtered={filtered}/>}</section>}
    {data&&data.totalPages>1&&<nav className="pagination" aria-label="Notification pages"><button className="button button--secondary" disabled={page===0||loading} onClick={()=>update('page',String(page-1))}><ChevronLeft/>Previous</button><span>Page {page+1} of {data.totalPages}</span><button className="button button--secondary" disabled={page+1>=data.totalPages||loading} onClick={()=>update('page',String(page+1))}>Next<ChevronRight/></button></nav>}
  </div>
}
