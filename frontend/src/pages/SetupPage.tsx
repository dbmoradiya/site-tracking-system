import { ActionIcon, Alert, Badge, Button, Group, Modal, NativeSelect, Paper, Stack, Table, Tabs, Text, TextInput, Textarea, Title, SimpleGrid, PasswordInput } from '@mantine/core'
import { ChevronDown, ChevronUp, Building2, Layers3, Package, Store, Pencil, Plus, Save, Trash2, UsersRound, Wrench } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { api, post, put } from '../lib/api'
import { CompanyTab, MaterialTypesTab, VendorsTab } from '../preview/MaterialSetupTabs'
import { Loading } from '../components/Loading'
import { RolesSelect, titleCase, type BusinessRole } from '../components/RolesSelect'

type RawStage={id:number;name:string;position:number;dependsOnId:number|null;evidenceRequired:boolean;requiredRoles:BusinessRole[]}
type StageDraft={name:string;dependsOnPosition:number|null;requiredRoles:BusinessRole[]}
type SiteType={id:number;name:string;description:string;stages:string|RawStage[]}
type Employee={id:number;name:string;mobile:string;roles:BusinessRole[];active:boolean;projects:string[]}
type Team={id:number;name:string;contactName:string;mobile:string;notes:string;active:boolean;projects:string[]}
type Setup={siteTypes:SiteType[];employees:Employee[];teams:Team[]}
type Tab='types'|'employees'|'teams'|'materialTypes'|'vendors'|'company'
const stagesOf=(item:SiteType)=>typeof item.stages==='string'?JSON.parse(item.stages) as RawStage[]:item.stages

export function SetupPage(){
  const [data,setData]=useState<Setup|null>(null);const [tab,setTab]=useState<Tab>('types');const [error,setError]=useState('')
  const load=useCallback(()=>(import.meta.env.VITE_UI_PREVIEW?Promise.resolve({siteTypes:[],employees:[],teams:[]} as Setup):api<Setup>('/setup')).then(setData).catch(e=>setError(e.message)),[]);useEffect(()=>{load()},[load])
  if(!data)return <Loading label="Loading setup"/>
  return <Stack gap="sm" className="page-compact">
    <div><Text size="xs" fw={700} c="orange.8" tt="uppercase">Admin controls</Text><Title order={2}>Setup</Title><Text size="sm" c="dimmed">Open a row to review details. Editing starts from its detail popup.</Text></div>
    {error&&<Alert color="red" role="alert">{error}</Alert>}
    <Tabs value={tab} onChange={value=>setTab((value as Tab)||'types')} keepMounted={false}>
      <Tabs.List aria-label="Setup sections"><Tabs.Tab value="types" leftSection={<Layers3 size={14}/>}>Site Types</Tabs.Tab><Tabs.Tab value="employees" leftSection={<UsersRound size={14}/>}>Employees</Tabs.Tab><Tabs.Tab value="teams" leftSection={<Wrench size={14}/>}>Teams</Tabs.Tab><Tabs.Tab value="materialTypes" leftSection={<Package size={14}/>}>Material Types</Tabs.Tab><Tabs.Tab value="vendors" leftSection={<Store size={14}/>}>Vendors</Tabs.Tab><Tabs.Tab value="company" leftSection={<Building2 size={14}/>}>Company Setup</Tabs.Tab></Tabs.List>
      <Tabs.Panel value="types" pt="sm"><SiteTypes items={data.siteTypes} onSaved={load}/></Tabs.Panel>
      <Tabs.Panel value="employees" pt="sm"><Employees items={data.employees} onSaved={load}/></Tabs.Panel>
      <Tabs.Panel value="teams" pt="sm"><Teams items={data.teams} onSaved={load}/></Tabs.Panel>
    <Tabs.Panel value="materialTypes" pt="sm"><MaterialTypesTab/></Tabs.Panel>
      <Tabs.Panel value="vendors" pt="sm"><VendorsTab/></Tabs.Panel>
      <Tabs.Panel value="company" pt="sm"><CompanyTab/></Tabs.Panel>
    </Tabs>
  </Stack>
}

function Section({title,count,action,onAdd,children}:{title:string;count:string;action:string;onAdd:()=>void;children:ReactNode}){
  return <Stack gap="xs"><Group justify="space-between"><div><Title order={4}>{title}</Title><Text size="xs" c="dimmed">{count}</Text></div><Button size="xs" leftSection={<Plus size={14}/>} onClick={onAdd}>{action}</Button></Group>
    <Paper withBorder><Table.ScrollContainer minWidth={520}><Table verticalSpacing={6} horizontalSpacing="sm" highlightOnHover fz="sm">{children}</Table></Table.ScrollContainer></Paper></Stack>
}
function Row({onOpen,children}:{onOpen:()=>void;children:ReactNode}){return <Table.Tr onClick={onOpen} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpen()}}} tabIndex={0} style={{cursor:'pointer'}}>{children}</Table.Tr>}
function ReadRow({label,value}:{label:string;value:string}){return <div><Text size="xs" c="dimmed">{label}</Text><Text size="sm" fw={600}>{value}</Text></div>}
function Chips({projects}:{projects:string[]}){return projects.length===0?<Text size="xs" c="dimmed">Not assigned</Text>:<Group gap={4}>{projects.slice(0,2).map(n=><Badge key={n} variant="light" color="gray" size="sm">{n}</Badge>)}{projects.length>2&&<Badge variant="light" color="gray" size="sm">+{projects.length-2}</Badge>}</Group>}
function AssignedProjects({projects}:{projects:string[]}){return <div><Text size="xs" c="dimmed">Assigned Projects</Text>{projects.length===0?<Text size="sm">No Projects assigned.</Text>:<Group gap={4} mt={2}>{projects.map(n=><Badge key={n} variant="light" color="orange" size="sm">{n}</Badge>)}</Group>}</div>}
function Actions({onCancel,saving}:{onCancel:()=>void;saving:boolean}){return <Group justify="flex-end" mt="md"><Button variant="default" onClick={onCancel}>Cancel</Button><Button type="submit" loading={saving} leftSection={<Save size={14}/>}>Save changes</Button></Group>}
function EditButton({onClick}:{onClick:()=>void}){return <Group justify="flex-end" mt="md"><Button leftSection={<Pencil size={14}/>} onClick={onClick}>Edit</Button></Group>}

function SiteTypes({items,onSaved}:{items:SiteType[];onSaved:()=>void}){
  const [selected,setSelected]=useState<SiteType|null>(null);const [editing,setEditing]=useState(false)
  const close=()=>{setSelected(null);setEditing(false)}
  return <>
    <Section title="Site Types" count={`${items.length} types`} action="Add Site Type" onAdd={()=>{setSelected({id:0,name:'',description:'',stages:[]});setEditing(true)}}>
      <Table.Thead><Table.Tr><Table.Th>Site Type</Table.Th><Table.Th>Description</Table.Th><Table.Th>Stages</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{items.map(item=><Row key={item.id} onOpen={()=>setSelected(item)}><Table.Td fw={600}>{item.name}</Table.Td><Table.Td>{item.description||'No description'}</Table.Td><Table.Td>{stagesOf(item).length} default stages</Table.Td></Row>)}</Table.Tbody>
    </Section>
    <Modal opened={selected!==null} onClose={close} size="lg" title={selected?.id?selected.name:'Add Site Type'}>{selected&&(editing
      ?<SiteTypeForm item={selected} onCancel={selected.id?()=>setEditing(false):close} onSaved={()=>{onSaved();close()}}/>
      :<Stack gap="sm"><ReadRow label="Description" value={selected.description||'Not provided'}/><div><Text size="xs" c="dimmed">Default stages</Text><Stack gap={4} mt={2}>{stagesOf(selected).map(stage=><div key={stage.id}><Text size="sm" fw={600}>{stage.position}. {stage.name}</Text><Text size="xs" c="dimmed">{stage.dependsOnId?'Dependency configured':'No dependency'} · Evidence required · {stage.requiredRoles.length?stage.requiredRoles.map(titleCase).join(', '):'No required roles'}</Text></div>)}</Stack></div><EditButton onClick={()=>setEditing(true)}/></Stack>)}</Modal>
  </>
}

function SiteTypeForm({item,onCancel,onSaved}:{item:SiteType;onCancel:()=>void;onSaved:()=>void}){
  const raw=useMemo(()=>stagesOf(item),[item])
  const initial=useMemo(()=>({name:item.name,description:item.description,stages:raw.length?raw.map(stage=>({name:stage.name,dependsOnPosition:stage.dependsOnId?raw.find(s=>s.id===stage.dependsOnId)?.position??null:null,requiredRoles:stage.requiredRoles||[]})):[{name:'',dependsOnPosition:null,requiredRoles:[]}] as StageDraft[]}),[raw,item])
  const [form,setForm]=useState(initial);const [saving,setSaving]=useState(false);const [error,setError]=useState('')
  const normalize=(next:StageDraft[])=>{const dependencies=new Map(form.stages.map(stage=>[stage,stage.dependsOnPosition?form.stages[stage.dependsOnPosition-1]:null]));return next.map((stage,index)=>{const dependency=dependencies.get(stage);const dependencyIndex=dependency?next.indexOf(dependency):-1;return {...stage,dependsOnPosition:dependencyIndex>=0&&dependencyIndex<index?dependencyIndex+1:null}})}
  const move=(index:number,direction:-1|1)=>{const target=index+direction;if(target<0||target>=form.stages.length)return;const next=[...form.stages];const [stage]=next.splice(index,1);next.splice(target,0,stage);setForm({...form,stages:normalize(next)})}
  const setStage=(index:number,patch:Partial<StageDraft>)=>setForm({...form,stages:form.stages.map((s,i)=>i===index?{...s,...patch}:s)})
  const save=async(e:FormEvent)=>{e.preventDefault();setSaving(true);setError('');try{if(item.id)await put(`/setup/site-types/${item.id}`,form);else await post('/setup/site-types',form);onSaved()}catch(err){setError(err instanceof Error?err.message:'Save failed')}finally{setSaving(false)}}
  return <form onSubmit={save}>{error&&<Alert color="red" mb="xs" role="alert">{error}</Alert>}
    <SimpleGrid cols={{base:1,sm:2}}><TextInput required label="Site Type name" value={form.name} onChange={e=>setForm({...form,name:e.currentTarget.value})}/><TextInput label="Description" value={form.description} onChange={e=>setForm({...form,description:e.currentTarget.value})}/></SimpleGrid>
    <Group justify="space-between" mt="md" mb="xs"><div><Title order={5}>Default stages</Title><Text size="xs" c="dimmed">Every Stage requires evidence. Required Roles may be empty. A Stage can also require a Team.</Text></div>
      <Button size="xs" variant="default" leftSection={<Plus size={14}/>} onClick={()=>setForm({...form,stages:[...form.stages,{name:'',dependsOnPosition:form.stages.length||null,requiredRoles:[]}]})}>Add Stage</Button></Group>
    <Stack gap="xs">{form.stages.map((stage,index)=><Paper withBorder p="xs" key={index}><Group align="flex-end" gap="xs" wrap="wrap">
      <Badge circle size="lg" color="dark">{index+1}</Badge>
      <TextInput required style={{flex:'1 1 150px'}} label="Stage name" value={stage.name} onChange={e=>setStage(index,{name:e.currentTarget.value})}/>
      <NativeSelect style={{flex:'1 1 130px'}} label="Dependency" value={String(stage.dependsOnPosition??'')} onChange={e=>setStage(index,{dependsOnPosition:e.currentTarget.value?Number(e.currentTarget.value):null})} data={[{value:'',label:'No dependency'},...form.stages.slice(0,index).map((s,i)=>({value:String(i+1),label:`${i+1}. ${s.name||'Untitled'}`}))]}/>
      <div style={{flex:'1 1 170px'}}><RolesSelect includeTeam excludeCoordinator label="Required Roles" selected={stage.requiredRoles} onChange={roles=>setStage(index,{requiredRoles:roles})}/></div>
      <Group gap={4}><ActionIcon variant="default" size="lg" disabled={index===0} onClick={()=>move(index,-1)} aria-label="Move Stage up"><ChevronUp size={14}/></ActionIcon><ActionIcon variant="default" size="lg" disabled={index===form.stages.length-1} onClick={()=>move(index,1)} aria-label="Move Stage down"><ChevronDown size={14}/></ActionIcon><ActionIcon color="red" variant="light" size="lg" onClick={()=>setForm({...form,stages:normalize(form.stages.filter((_,i)=>i!==index))})} aria-label="Remove Stage"><Trash2 size={14}/></ActionIcon></Group>
    </Group></Paper>)}</Stack>
    <Actions onCancel={onCancel} saving={saving}/></form>
}

function Employees({items,onSaved}:{items:Employee[];onSaved:()=>void}){
  const [selected,setSelected]=useState<Employee|null>(null);const [editing,setEditing]=useState(false);const close=()=>{setSelected(null);setEditing(false)}
  return <>
    <Section title="Employees" count={`${items.length} active`} action="Add Employee" onAdd={()=>{setSelected({id:0,name:'',mobile:'',roles:['COORDINATOR'],active:true,projects:[]});setEditing(true)}}>
      <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Roles</Table.Th><Table.Th>Mobile</Table.Th><Table.Th>Projects</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{items.map(item=><Row key={item.id} onOpen={()=>setSelected(item)}><Table.Td fw={600}>{item.name}</Table.Td><Table.Td>{item.roles.map(titleCase).join(', ')}</Table.Td><Table.Td>{item.mobile||'No mobile'}</Table.Td><Table.Td><Chips projects={item.projects}/></Table.Td></Row>)}</Table.Tbody>
    </Section>
    <Modal opened={selected!==null} onClose={close} title={selected?.id?selected.name:'Add Employee'}>{selected&&(editing
      ?<EmployeeForm item={selected} onCancel={selected.id?()=>setEditing(false):close} onSaved={()=>{onSaved();close()}}/>
      :<Stack gap="sm"><ReadRow label="Roles" value={selected.roles.map(titleCase).join(', ')}/><ReadRow label="Mobile (login)" value={selected.mobile}/><AssignedProjects projects={selected.projects}/><EditButton onClick={()=>setEditing(true)}/></Stack>)}</Modal>
  </>
}
function EmployeeForm({item,onCancel,onSaved}:{item:Employee;onCancel:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({name:item.name,mobile:item.mobile,roles:item.roles,password:''});const [saving,setSaving]=useState(false);const [error,setError]=useState('')
  const save=async(e:FormEvent)=>{e.preventDefault();if(!form.roles.length){setError('Select at least one role');return}if((!item.id||form.password)&&form.password.length<10){setError('Password must be at least 10 characters');return}setSaving(true);setError('');try{if(item.id)await put(`/setup/employees/${item.id}`,form);else await post('/setup/employees',form);onSaved()}catch(err){setError(err instanceof Error?err.message:'Save failed')}finally{setSaving(false)}}
  return <form onSubmit={save}><Stack gap="sm">{error&&<Alert color="red" role="alert">{error}</Alert>}
    <TextInput required label="Name" value={form.name} onChange={e=>setForm({...form,name:e.currentTarget.value})}/>
    <TextInput required type="tel" inputMode="tel" label="Mobile number (used to sign in)" placeholder="e.g. 98765 43210" value={form.mobile} onChange={e=>setForm({...form,mobile:e.currentTarget.value})}/>
    <PasswordInput label="Login password" required={!item.id} description={item.id?'Leave blank to keep the current password. Enter a new one to reset it.':'Required. At least 10 characters. The employee signs in with the mobile number above and this password, and can change it later.'} autoComplete="new-password" minLength={10} maxLength={72} value={form.password} onChange={e=>setForm({...form,password:e.currentTarget.value})}/>
    <RolesSelect label="Roles" selected={form.roles} onChange={roles=>setForm({...form,roles})}/></Stack><Actions onCancel={onCancel} saving={saving}/></form>
}

function Teams({items,onSaved}:{items:Team[];onSaved:()=>void}){
  const [selected,setSelected]=useState<Team|null>(null);const [editing,setEditing]=useState(false);const close=()=>{setSelected(null);setEditing(false)}
  return <>
    <Section title="Teams" count={`${items.length} contacts`} action="Add Team" onAdd={()=>{setSelected({id:0,name:'',contactName:'',mobile:'',notes:'',active:true,projects:[]});setEditing(true)}}>
      <Table.Thead><Table.Tr><Table.Th>Team</Table.Th><Table.Th>Contact</Table.Th><Table.Th>Mobile</Table.Th><Table.Th>Projects</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>{items.map(item=><Row key={item.id} onOpen={()=>setSelected(item)}><Table.Td fw={600}>{item.name}</Table.Td><Table.Td>{item.contactName}</Table.Td><Table.Td>{item.mobile}</Table.Td><Table.Td><Chips projects={item.projects}/></Table.Td></Row>)}</Table.Tbody>
    </Section>
    <Modal opened={selected!==null} onClose={close} title={selected?.id?selected.name:'Add Team'}>{selected&&(editing
      ?<TeamForm item={selected} onCancel={selected.id?()=>setEditing(false):close} onSaved={()=>{onSaved();close()}}/>
      :<Stack gap="sm"><ReadRow label="Contact person" value={selected.contactName}/><ReadRow label="Mobile" value={selected.mobile}/><ReadRow label="Notes" value={selected.notes||'Not provided'}/><AssignedProjects projects={selected.projects}/><EditButton onClick={()=>setEditing(true)}/></Stack>)}</Modal>
  </>
}
function TeamForm({item,onCancel,onSaved}:{item:Team;onCancel:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({name:item.name,contactName:item.contactName,mobile:item.mobile,notes:item.notes});const [saving,setSaving]=useState(false);const [error,setError]=useState('')
  const save=async(e:FormEvent)=>{e.preventDefault();setSaving(true);setError('');try{if(item.id)await put(`/setup/teams/${item.id}`,form);else await post('/setup/teams',form);onSaved()}catch(err){setError(err instanceof Error?err.message:'Save failed')}finally{setSaving(false)}}
  return <form onSubmit={save}><Stack gap="sm">{error&&<Alert color="red" role="alert">{error}</Alert>}
    <TextInput required label="Team name" value={form.name} onChange={e=>setForm({...form,name:e.currentTarget.value})}/>
    <TextInput required label="Contact person" value={form.contactName} onChange={e=>setForm({...form,contactName:e.currentTarget.value})}/>
    <TextInput required inputMode="tel" label="Mobile" value={form.mobile} onChange={e=>setForm({...form,mobile:e.currentTarget.value})}/>
    <Textarea label="Notes" autosize minRows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.currentTarget.value})}/></Stack><Actions onCancel={onCancel} saving={saving}/></form>
}
