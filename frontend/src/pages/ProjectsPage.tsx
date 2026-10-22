import { Anchor, Badge, Button, Collapse, Group, NativeSelect, Paper, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { Filter, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Loading } from '../components/Loading'
import { StatusBadge } from '../components/StatusBadge'
import { api, hasRole } from '../lib/api'
import { useAuth } from '../lib/auth'

type ProjectAssignment={role:string;name:string}
type Project={id:number;name:string;customerName:string;customerMobile:string;address:string;targetDate:string;status:string;siteCount:number;completedSites:number;coordinators:string[];assignments:ProjectAssignment[];actionRequired:number}
type Filters={location:string;dateFrom:string;dateTo:string;role:string;assignee:string;coordinator:string;status:string;action:string}
const emptyFilters:Filters={location:'',dateFrom:'',dateTo:'',role:'',assignee:'',coordinator:'',status:'',action:''}

export function ProjectsPage(){
  const {user}=useAuth();const [searchParams,setSearchParams]=useSearchParams();const [items,setItems]=useState<Project[]|null>(null);const [query,setQuery]=useState('');const [showFilters,setShowFilters]=useState(false);const [filters,setFilters]=useState<Filters>(()=>({...emptyFilters,status:validStatus(searchParams.get('status'))}))
  useEffect(()=>{api<Project[]>('/projects').then(setItems)},[])
  useEffect(()=>{setFilters(current=>({...current,status:validStatus(searchParams.get('status'))}))},[searchParams])
  const roles=useMemo(()=>unique(items?.flatMap(p=>p.assignments.map(item=>item.role))||[]),[items]);const assignees=useMemo(()=>unique(items?.flatMap(p=>p.assignments.filter(item=>!filters.role||item.role===filters.role).map(item=>item.name))||[]),[items,filters.role]);const coordinators=useMemo(()=>unique(items?.flatMap(p=>p.coordinators)||[]),[items])
  const activeCount=Object.values(filters).filter(Boolean).length
  const filtered=useMemo(()=>items?.filter(p=>{
    const search=`${p.name} ${p.customerName} ${p.address}`.toLowerCase().includes(query.toLowerCase())
    return search&&(!filters.location||p.address.toLowerCase().includes(filters.location.toLowerCase()))&&(!filters.dateFrom||(!!p.targetDate&&p.targetDate>=filters.dateFrom))&&(!filters.dateTo||(!!p.targetDate&&p.targetDate<=filters.dateTo))&&(!filters.role||p.assignments.some(item=>item.role===filters.role))&&(!filters.assignee||p.assignments.some(item=>item.name===filters.assignee&&(!filters.role||item.role===filters.role)))&&(!filters.coordinator||p.coordinators.includes(filters.coordinator))&&(!filters.status||p.status===filters.status)&&(!filters.action||(filters.action==='required'?p.actionRequired>0:p.actionRequired===0))
  })||[],[items,query,filters])
  const change=(key:keyof Filters,value:string)=>{setFilters({...filters,[key]:value,...(key==='role'?{assignee:''}:{})});if(key==='status'){const next=new URLSearchParams(searchParams);if(value)next.set('status',value);else next.delete('status');setSearchParams(next)}}
  const clearFilters=()=>{setFilters(emptyFilters);const next=new URLSearchParams(searchParams);next.delete('status');setSearchParams(next)}
  if(!items)return <Loading label="Loading projects"/>
  const sel=(label:string,key:keyof Filters,data:{value:string;label:string}[])=><NativeSelect size="xs" label={label} value={filters[key]} onChange={e=>change(key,e.currentTarget.value)} data={data}/>
  return <Stack gap="sm" className="page-compact">
    <Group justify="space-between" align="flex-end"><div><Text size="xs" fw={700} c="orange.8" tt="uppercase">Portfolio</Text><Title order={2}>Projects</Title></div>
      {hasRole(user,'ADMIN')&&<Button component={Link} to="/projects/new" size="xs" leftSection={<Plus size={14}/>}>New project</Button>}</Group>
    <Group gap="xs" wrap="wrap"><TextInput aria-label="Search projects" style={{flex:'1 1 220px'}} size="xs" leftSection={<Search size={14}/>} value={query} onChange={e=>setQuery(e.currentTarget.value)} placeholder="Search projects, customers or locations"/>
      <Button size="xs" variant={activeCount?'filled':'default'} leftSection={<Filter size={14}/>} onClick={()=>setShowFilters(!showFilters)} aria-expanded={showFilters}>Filters{activeCount>0?` (${activeCount})`:''}</Button>
      <Text size="xs" c="dimmed">{filtered.length} projects</Text></Group>
    <Collapse expanded={showFilters}><Paper withBorder p="sm" aria-label="Advanced project filters"><SimpleGrid cols={{base:1,xs:2,md:4}} spacing="xs">
      <TextInput size="xs" label="Location" value={filters.location} onChange={e=>change('location',e.currentTarget.value)} placeholder="City, area or address"/>
      <TextInput size="xs" type="date" label="Completion from" value={filters.dateFrom} onChange={e=>change('dateFrom',e.currentTarget.value)}/>
      <TextInput size="xs" type="date" label="Completion to" value={filters.dateTo} onChange={e=>change('dateTo',e.currentTarget.value)}/>
      {sel('Assigned role','role',[{value:'',label:'All roles'},...roles.map(r=>({value:r,label:titleCase(r)}))])}
      {sel('Assignee','assignee',[{value:'',label:'All assignees'},...assignees.map(n=>({value:n,label:n}))])}
      {sel('Project Coordinator','coordinator',[{value:'',label:'All Coordinators'},...coordinators.map(n=>({value:n,label:n}))])}
      {sel('Status','status',[{value:'',label:'All statuses'},{value:'NOT_STARTED',label:'Not started'},{value:'IN_PROGRESS',label:'In progress'},{value:'COMPLETED',label:'Completed'}])}
      {sel('Action required','action',[{value:'',label:'All projects'},{value:'required',label:'Action required'},{value:'clear',label:'No action required'}])}
    </SimpleGrid><Group justify="flex-end" mt="xs"><Button size="xs" variant="subtle" onClick={clearFilters} disabled={activeCount===0}>Clear all filters</Button></Group></Paper></Collapse>
    {filtered.length===0?<EmptyState title="No projects found" description="Change or clear filters to see more Projects."/>:
    <Paper withBorder><Table.ScrollContainer minWidth={640}><Table verticalSpacing={6} horizontalSpacing="sm" highlightOnHover fz="sm">
      <Table.Thead><Table.Tr><Table.Th>Project</Table.Th><Table.Th>Customer</Table.Th><Table.Th>Sites</Table.Th><Table.Th>Target</Table.Th><Table.Th>Status</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{filtered.map(p=><Table.Tr key={p.id}>
        <Table.Td><Anchor component={Link} to={`/projects/${p.id}`} fw={600} size="sm">{p.name}</Anchor><Text size="xs" c="dimmed" lineClamp={1}>{p.address||'No location'}</Text></Table.Td>
        <Table.Td>{p.customerName}</Table.Td>
        <Table.Td>{p.completedSites}/{p.siteCount}</Table.Td>
        <Table.Td>{p.targetDate||'Not set'}</Table.Td>
        <Table.Td><StatusBadge status={p.status}/></Table.Td>
        <Table.Td>{p.actionRequired>0?<Badge color="red" variant="filled" size="sm">{p.actionRequired}</Badge>:<Text size="xs" c="dimmed">None</Text>}</Table.Td>
      </Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Paper>}
  </Stack>
}

function unique(values:string[]){return [...new Set(values)].sort((a,b)=>a.localeCompare(b))}
function titleCase(value:string){return value.toLowerCase().replaceAll('_',' ').replace(/\b\w/g,character=>character.toUpperCase())}
function validStatus(value:string|null){return ['NOT_STARTED','IN_PROGRESS','COMPLETED'].includes(value||'')?value||'':''}
