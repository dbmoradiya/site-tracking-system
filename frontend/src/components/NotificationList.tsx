import { ArrowUpRight, Bell, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge } from './StatusBadge'

export type NotificationItem={stageId:number;stageName:string;siteId:number;siteName:string;projectId:number;projectName:string;status:string;updatedAt:string;type:string;title:string;actionLabel:string}
export type NotificationPage={items:NotificationItem[];total:number;page:number;size:number;totalPages:number}

export function NotificationList({items,filtered=false}:{items:NotificationItem[];filtered?:boolean}){
  if(items.length===0)return <div className="notification-empty"><CheckCircle2/><div><strong>{filtered?'No matching notifications':'You are all caught up'}</strong><p>{filtered?'Try clearing a filter or using a broader search.':'No pending action needs your attention.'}</p></div></div>
  return <div className="notification-list">{items.map(item=><Link to={`/sites/${item.siteId}#stage-${item.stageId}`} key={`${item.type}-${item.stageId}`}><span className={`notification-icon notification-icon--${item.type.toLowerCase()}`}><Bell aria-hidden="true"/></span><span><strong>{item.title}</strong><small>{item.projectName} · {item.siteName} · {item.stageName}</small><em>{item.actionLabel}</em></span><StatusBadge status={item.status}/><span className="notification-time">{new Date(item.updatedAt).toLocaleDateString()}</span><ArrowUpRight aria-hidden="true"/></Link>)}</div>
}
