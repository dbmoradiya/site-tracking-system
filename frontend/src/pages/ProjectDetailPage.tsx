import { ActionIcon, Alert, Anchor, Button, Group, Modal, NativeSelect, Paper, Progress, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core'
import { Pencil, History, ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loading } from '../components/Loading'
import { StatusBadge } from '../components/StatusBadge'
import { api, del, hasRole, put } from '../lib/api'
import { useAuth } from '../lib/auth'
import { LinkedSales } from '../preview/SalesUi'

type Site={id:number;name:string;address:string;targetDate:string;status:string;siteType:string;stageCount:number;completedStages:number}
type CoordinatorHistory={oldCoordinator:string;newCoordinator:string;changedBy:string;changedAt:string}
type Project={id:number;name:string;customerName:string;customerMobile:string;address:string;targetDate:string;status:string;coordinatorId:number;coordinator:string;coordinatorHistory:CoordinatorHistory[];sites:Site[]}
type Employee={id:number;name:string;roles:string[];active:boolean}

export function ProjectDetailPage(){
  const {projectId}=useParams();const {user}=useAuth();const navigate=useNavigate();const [project,setProject]=useState<Project|null>(null);const [coordinators,setCoordinators]=useState<Employee[]>([]);const [historyOpen,setHistoryOpen]=useState(false);const [deleteOpen,setDeleteOpen]=useState(false);const [error,setError]=useState('')
  const isAdmin=hasRole(user,'ADMIN')
  const load=useCallback(async()=>{try{setError('');const current=await api<Project>(`/projects/${projectId}`);setProject(current);if(isAdmin){const setup=await api<{employees:Employee[]}>('/setup');setCoordinators(setup.employees.filter(employee=>employee.active&&employee.roles.includes('COORDINATOR')))}}catch(err){setError(err instanceof Error?err.message:'Could not load Project')}},[projectId,isAdmin]);useEffect(()=>{load()},[load])
  if(!project)return error?<Stack><Alert color="red" role="alert">{error}</Alert><Button component={Link} to="/projects" variant="default" w="fit-content">Back to Projects</Button></Stack>:<Loading label="Loading project"/>
  const stat=(label:string,value:string)=><div><Text size="xs" c="dimmed">{label}</Text><Text size="sm" fw={600}>{value}</Text></div>
  return <Stack gap="sm" className="page-compact">
    <Anchor component={Link} to="/projects" size="sm"><Group gap={4}><ArrowLeft size={14}/>All projects</Group></Anchor>
    <Paper withBorder p="sm"><Group justify="space-between" align="flex-start" wrap="wrap">
      <div><Group gap="xs"><Title order={3}>{project.name}</Title><StatusBadge status={project.status}/></Group><Text size="sm" c="dimmed">{project.address||'No project address'}</Text></div>
      {isAdmin&&<Group gap="xs"><Button size="xs" color="red" variant="light" leftSection={<Trash2 size={14}/>} onClick={()=>setDeleteOpen(true)}>Delete Project</Button><Button size="xs" component={Link} to={`/projects/${project.id}/sites/new`} leftSection={<Plus size={14}/>}>Add Site</Button></Group>}
    </Group>
    <SimpleGrid cols={{base:2,sm:4}} mt="sm" spacing="sm" style={{alignItems:"start"}}>{stat('Customer',project.customerName)}{stat('Mobile',project.customerMobile)}{stat('Target date',project.targetDate||'Not set')}
      <CoordinatorField projectId={project.id} current={project.coordinatorId} name={project.coordinator} employees={coordinators} canEdit={isAdmin} onHistory={()=>setHistoryOpen(true)} onSaved={load}/></SimpleGrid></Paper>
    {error&&<Alert color="red" role="alert">{error}</Alert>}
    <Modal opened={historyOpen} onClose={()=>setHistoryOpen(false)} title="Coordinator history" size="md">{project.coordinatorHistory.length===0?<Text size="sm" c="dimmed">No Coordinator changes recorded.</Text>:<Stack gap="xs">{project.coordinatorHistory.map((item,index)=><div key={`${item.changedAt}-${index}`}><Text size="sm" fw={600}>{item.oldCoordinator==='—'?item.newCoordinator:`${item.oldCoordinator} → ${item.newCoordinator}`}</Text><Text size="xs" c="dimmed">Changed by {item.changedBy} · {new Date(item.changedAt).toLocaleString()}</Text></div>)}</Stack>}</Modal>
    {isAdmin&&<LinkedSales projectId={project.id}/>}
    <Group justify="space-between"><div><Text size="xs" fw={700} c="orange.8" tt="uppercase">Execution</Text><Title order={4}>Project Sites</Title></div><Text size="sm" c="dimmed">{project.sites.length} total</Text></Group>
    {project.sites.length===0?<Paper withBorder p="md"><Text size="sm" c="dimmed" ta="center">No Sites yet.</Text></Paper>:<Paper withBorder><Table.ScrollContainer minWidth={620}><Table verticalSpacing={6} horizontalSpacing="sm" highlightOnHover fz="sm"><Table.Thead><Table.Tr><Table.Th>Site</Table.Th><Table.Th>Type</Table.Th><Table.Th>Target</Table.Th><Table.Th>Progress</Table.Th><Table.Th>Status</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{project.sites.map(site=>{const progress=site.stageCount?site.completedStages/site.stageCount*100:0;return <Table.Tr key={site.id}>
        <Table.Td><Anchor component={Link} to={`/sites/${site.id}`} fw={600} size="sm">{site.name}</Anchor><Text size="xs" c="dimmed" lineClamp={1}>{site.address||'No Site address'}</Text></Table.Td>
        <Table.Td>{site.siteType}</Table.Td><Table.Td>{site.targetDate||'Not set'}</Table.Td>
        <Table.Td miw={120}><Progress value={progress} size="sm" aria-label="Site progress"/><Text size="xs" c="dimmed">{site.completedStages}/{site.stageCount} stages</Text></Table.Td>
        <Table.Td><StatusBadge status={site.status}/></Table.Td></Table.Tr>})}</Table.Tbody></Table></Table.ScrollContainer></Paper>}
    <Modal opened={deleteOpen} onClose={()=>setDeleteOpen(false)} title="Delete Project?" size="sm"><Text size="sm">This permanently deletes <b>{project.name}</b>, all its Sites, Stages, workflow history and uploaded evidence files.</Text><DeleteActions onCancel={()=>setDeleteOpen(false)} onDelete={async()=>{try{await del(`/projects/${project.id}`);navigate('/projects',{replace:true})}catch(err){setError(err instanceof Error?err.message:'Could not delete Project');setDeleteOpen(false)}}}/></Modal>
  </Stack>
}

function CoordinatorField({projectId,current,name,employees,canEdit,onHistory,onSaved}:{projectId:number;current:number;name:string;employees:Employee[];canEdit:boolean;onHistory:()=>void;onSaved:()=>Promise<unknown>|void}){
  const [editing,setEditing]=useState(false);const [coordinatorId,setCoordinatorId]=useState(String(current));const [saving,setSaving]=useState(false);const [error,setError]=useState('')
  const save=async()=>{setSaving(true);setError('');try{await put(`/projects/${projectId}/coordinator`,{coordinatorId:Number(coordinatorId)});setEditing(false);await onSaved()}catch(err){setError(err instanceof Error?err.message:'Could not change Coordinator')}finally{setSaving(false)}}
  return <div><Text size="xs" c="dimmed">Project Coordinator</Text>{error&&<Alert color="red" role="alert" py={4}>{error}</Alert>}
    {editing?<Group gap={6} wrap="wrap"><NativeSelect size="xs" aria-label="Project Coordinator" value={coordinatorId} onChange={e=>setCoordinatorId(e.currentTarget.value)} data={employees.map(e=>({value:String(e.id),label:e.name}))}/><Button size="xs" loading={saving} disabled={Number(coordinatorId)===current} onClick={save}>Save</Button><Button size="xs" variant="default" onClick={()=>{setEditing(false);setCoordinatorId(String(current))}}>Cancel</Button></Group>
    :<Group gap={4}><Text size="sm" fw={600}>{name}</Text>{canEdit&&<ActionIcon variant="subtle" color="gray" size="md" aria-label="Edit Project Coordinator" title="Edit Project Coordinator" onClick={()=>{setCoordinatorId(String(current));setEditing(true)}}><Pencil size={14}/></ActionIcon>}<ActionIcon variant="subtle" color="gray" size="md" aria-label="Coordinator history" title="Coordinator history" onClick={onHistory}><History size={16}/></ActionIcon></Group>}</div>
}

function DeleteActions({onCancel,onDelete}:{onCancel:()=>void;onDelete:()=>Promise<void>}){const [deleting,setDeleting]=useState(false);return <Group justify="flex-end" mt="md"><Button variant="default" onClick={onCancel}>Cancel</Button><Button color="red" loading={deleting} leftSection={<Trash2 size={14}/>} onClick={async()=>{setDeleting(true);await onDelete()}}>Delete Project</Button></Group>}
