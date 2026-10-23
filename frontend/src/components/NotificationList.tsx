import { Badge, Group, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core'
import { ArrowUpRight, Bell, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge } from './StatusBadge'

export type NotificationItem={stageId:number;stageName:string;siteId:number;siteName:string;projectId:number;projectName:string;status:string;updatedAt:string;type:string;title:string;actionLabel:string}
export type NotificationPage={items:NotificationItem[];total:number;page:number;size:number;totalPages:number}

const typeColor: Record<string, string> = { APPROVAL_REQUEST: 'violet', MISSING_ASSIGNMENT: 'red', NO_ROLE_ACTION: 'blue', CHANGES_REQUESTED: 'orange', ASSIGNED_WORK: 'teal' }

export function NotificationList({items,filtered=false}:{items:NotificationItem[];filtered?:boolean}){
  if(items.length===0)return <Group gap="sm" p="sm" wrap="nowrap"><ThemeIcon color="green" variant="light" size="lg"><CheckCircle2 size={18}/></ThemeIcon><div><Text fw={600} size="sm">{filtered?'No matching notifications':'You are all caught up'}</Text><Text size="xs" c="dimmed">{filtered?'Try clearing a filter or using a broader search.':'No pending action needs your attention.'}</Text></div></Group>
  return <Stack gap={0}>{items.map(item=><UnstyledButton component={Link} to={`/sites/${item.siteId}#stage-${item.stageId}`} key={`${item.type}-${item.stageId}`} className="notification-row">
    <Group gap="sm" wrap="nowrap" py={8} px="xs">
      <ThemeIcon color={typeColor[item.type]??'gray'} variant="light" size="md"><Bell size={14} aria-hidden="true"/></ThemeIcon>
      <div style={{flex:1,minWidth:0}}>
        <Text size="sm" fw={600} truncate>{item.title}</Text>
        <Text size="xs" c="dimmed" truncate>{item.projectName} · {item.siteName} · {item.stageName}</Text>
      </div>
      <Badge variant="outline" color={typeColor[item.type]??'gray'} visibleFrom="sm">{item.actionLabel}</Badge>
      <StatusBadge status={item.status}/>
      <Text size="xs" c="dimmed" visibleFrom="sm">{new Date(item.updatedAt).toLocaleDateString()}</Text>
      <ArrowUpRight size={14} aria-hidden="true"/>
    </Group>
  </UnstyledButton>)}</Stack>
}
