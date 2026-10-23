import { Alert, Anchor, Badge, Button, Card, Group, Progress, SimpleGrid, Table, Text, Title } from '@mantine/core'
import { ArrowUpRight, Bell, Building2, CheckCircle2, CircleDashed, Clock3, Layers, Plus, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loading } from '../components/Loading'
import { NotificationList, type NotificationPage } from '../components/NotificationList'
import { StatusBadge } from '../components/StatusBadge'
import { api, hasRole } from '../lib/api'
import { useAuth } from '../lib/auth'

type Dashboard = { counts: { status: string; total: number }[] }
type Project = { id:number; name:string; customerName:string; status:string; targetDate:string; siteCount:number; completedSites:number; coordinators:string[]; actionRequired:number }

export function DashboardPage() {
  const { user } = useAuth()
  const [data,setData]=useState<Dashboard|null>(null)
  const [projects,setProjects]=useState<Project[]>([])
  const [notifications,setNotifications]=useState<NotificationPage|null>(null)
  const [error,setError]=useState('')
  useEffect(()=>{Promise.all([api<Dashboard>('/dashboard'),api<Project[]>('/projects'),api<NotificationPage>('/notifications?page=0&size=8')])
    .then(([dashboard,list,actions])=>{setData(dashboard);setProjects(list);setNotifications(actions)}).catch(e=>setError(e.message))},[])
  const totals=useMemo(()=>Object.fromEntries(data?.counts.map(c=>[c.status,c.total])||[]),[data])
  const today=new Date().toISOString().slice(0,10)
  const stats=useMemo(()=>{
    const sites=projects.reduce((a,p)=>a+p.siteCount,0), done=projects.reduce((a,p)=>a+p.completedSites,0)
    const overdue=projects.filter(p=>p.targetDate&&p.targetDate<today&&p.status!=='COMPLETED').length
    const actions=projects.reduce((a,p)=>a+p.actionRequired,0)
    return { sites, done, overdue, actions }
  },[projects,today])
  if(!data && !error) return <Loading label="Preparing your workspace" />
  const sorted=[...projects].sort((a,b)=>(b.actionRequired-a.actionRequired)||a.name.localeCompare(b.name))
  return <div className="page page--compact">
    <Group justify="space-between" mb="sm" wrap="nowrap">
      <div><Text size="xs" c="orange.8" fw={700} tt="uppercase">Operations overview</Text><Title order={1}>Good day, {user?.name.split(' ')[0]}</Title></div>
      {hasRole(user,'ADMIN') && <Button component={Link} to="/projects/new" leftSection={<Plus size={14}/>}>New project</Button>}
    </Group>
    {error && <Alert color="red" mb="sm" role="alert">{error}</Alert>}
    <SimpleGrid cols={{base:2,sm:3,lg:6}} spacing="xs" mb="sm" aria-label="Project status summary">
      <Stat to="/projects" icon={<Building2 size={16}/>} label="All projects" value={Object.values(totals).reduce((a,b)=>a+Number(b),0)} color="dark" />
      <Stat to="/projects?status=IN_PROGRESS" icon={<Clock3 size={16}/>} label="In progress" value={totals.IN_PROGRESS||0} color="orange" />
      <Stat to="/projects?status=NOT_STARTED" icon={<CircleDashed size={16}/>} label="Not started" value={totals.NOT_STARTED||0} color="gray" />
      <Stat to="/projects?status=COMPLETED" icon={<CheckCircle2 size={16}/>} label="Completed" value={totals.COMPLETED||0} color="green" />
      <Stat to="/projects" icon={<Layers size={16}/>} label="Sites complete" value={`${stats.done}/${stats.sites}`} color="teal" />
      <Stat to="/notifications" icon={<Bell size={16}/>} label="Pending actions" value={notifications?.total||0} color="violet" />
    </SimpleGrid>
    {stats.overdue>0&&<Alert color="red" variant="light" icon={<TriangleAlert size={16}/>} mb="sm" py={6}>{stats.overdue} project{stats.overdue>1?'s are':' is'} past the target date and not completed.</Alert>}
    <div className="dashboard-grid">
      <Card>
        <Group justify="space-between" mb={4}><Title order={2}>Action centre</Title><Group gap="xs"><Badge color="violet" variant="light">{notifications?.total||0} pending</Badge><Anchor component={Link} to="/notifications" size="xs">View all</Anchor></Group></Group>
        <NotificationList items={notifications?.items||[]}/>
      </Card>
      <Card>
        <Group justify="space-between" mb={4}><Title order={2}>Projects</Title><Anchor component={Link} to="/projects" size="xs">View all</Anchor></Group>
        <Table.ScrollContainer minWidth={520}>
          <Table highlightOnHover>
            <Table.Thead><Table.Tr><Table.Th>Project</Table.Th><Table.Th>Coordinator</Table.Th><Table.Th>Sites</Table.Th><Table.Th>Target</Table.Th><Table.Th>Status</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{sorted.slice(0,12).map(project=>{
              const pct=project.siteCount?project.completedSites/project.siteCount*100:0
              const late=project.targetDate&&project.targetDate<today&&project.status!=='COMPLETED'
              return <Table.Tr key={project.id}>
                <Table.Td><Anchor component={Link} to={`/projects/${project.id}`} size="sm" fw={600}>{project.name}</Anchor><Text size="xs" c="dimmed">{project.customerName}</Text></Table.Td>
                <Table.Td><Text size="xs">{project.coordinators?.join(', ')||'—'}</Text></Table.Td>
                <Table.Td miw={110}><Progress value={pct} size="sm" aria-label={`${project.completedSites} of ${project.siteCount} sites complete`}/><Text size="xs" c="dimmed">{project.completedSites}/{project.siteCount}</Text></Table.Td>
                <Table.Td><Text size="xs" c={late?'red.7':undefined} fw={late?700:400}>{project.targetDate||'—'}</Text></Table.Td>
                <Table.Td><StatusBadge status={project.status}/></Table.Td>
                <Table.Td>{project.actionRequired>0?<Badge color="red" variant="filled">{project.actionRequired}</Badge>:<Text size="xs" c="dimmed">0</Text>}</Table.Td>
              </Table.Tr>})}{sorted.length===0&&<Table.Tr><Table.Td colSpan={6}><Text size="sm" c="dimmed" ta="center" py="sm">No projects yet. Projects you are assigned to will show here.</Text></Table.Td></Table.Tr>}</Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </div>
  </div>
}

function Stat({to,icon,label,value,color}:{to:string;icon:ReactNode;label:string;value:number|string;color:string}) {
  return <Card component={Link} to={to} className="stat-card" aria-label={`${label}: ${value}`}>
    <Group gap="xs" wrap="nowrap" justify="space-between">
      <div><Text size="xs" c="dimmed">{label}</Text><Text fz={22} fw={700} lh={1.1}>{value}</Text></div>
      <Text c={color==='dark'?'dark.4':`${color}.7`} aria-hidden="true">{icon}</Text>
    </Group>
    <ArrowUpRight className="stat-card__arrow" size={12} aria-hidden="true"/>
  </Card>
}
