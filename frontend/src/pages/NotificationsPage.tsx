import { Alert, Badge, Button, Group, NativeSelect, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
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
  return <Stack gap="sm" className="page-compact">
    <Group justify="space-between" align="flex-end"><div><Text size="xs" fw={700} c="orange.8" tt="uppercase">Action centre</Text><Title order={2}>Notifications</Title></div>{data&&<Badge variant="light" color="violet" size="lg">{data.total} pending</Badge>}</Group>
    <Group gap="xs" wrap="wrap" aria-label="Notification filters">
      <TextInput aria-label="Search notifications" style={{flex:'1 1 220px'}} size="xs" leftSection={<Search size={14}/>} value={search} onChange={e=>update('search',e.currentTarget.value)} placeholder="Search project, Site or Stage"/>
      <NativeSelect size="xs" aria-label="Type" value={type} onChange={e=>update('type',e.currentTarget.value)} data={[{value:'',label:'All action types'},{value:'APPROVAL_REQUEST',label:'Approval requests'},{value:'MISSING_ASSIGNMENT',label:'Missing assignments'},{value:'NO_ROLE_ACTION',label:'No-role actions'},{value:'CHANGES_REQUESTED',label:'Changes requested'},{value:'ASSIGNED_WORK',label:'Assigned work'}]}/>
      <NativeSelect size="xs" aria-label="Status" value={status} onChange={e=>update('status',e.currentTarget.value)} data={[{value:'',label:'All statuses'},{value:'NOT_STARTED',label:'Not started'},{value:'READY',label:'Ready'},{value:'IN_PROGRESS',label:'In progress'},{value:'REVIEW_PENDING',label:'Review pending'},{value:'CHANGES_REQUESTED',label:'Changes requested'},{value:'BLOCKED',label:'Blocked'}]}/>
      <Button size="xs" variant="subtle" leftSection={<X size={14}/>} onClick={clear} disabled={!filtered}>Clear</Button>
    </Group>
    {error&&<Alert color="red" role="alert">{error}</Alert>}
    {loading&&!data?<Loading label="Loading notifications"/>:<Paper withBorder aria-busy={loading}>{data&&<NotificationList items={data.items} filtered={filtered}/>}</Paper>}
    {data&&data.totalPages>1&&<Group justify="center" gap="sm" aria-label="Notification pages"><Button size="xs" variant="default" leftSection={<ChevronLeft size={14}/>} disabled={page===0||loading} onClick={()=>update('page',String(page-1))}>Previous</Button><Text size="xs">Page {page+1} of {data.totalPages}</Text><Button size="xs" variant="default" rightSection={<ChevronRight size={14}/>} disabled={page+1>=data.totalPages||loading} onClick={()=>update('page',String(page+1))}>Next</Button></Group>}
  </Stack>
}
