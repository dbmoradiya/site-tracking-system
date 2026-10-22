import { ActionIcon, Alert, Anchor, Badge, Button, Group, NativeSelect, Paper, SimpleGrid, Stack, Text, TextInput, Textarea, Title } from '@mantine/core'
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { RolesSelect } from '../components/RolesSelect'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, post } from '../lib/api'

import type { BusinessRole } from '../components/RolesSelect'
type Employee={id:number;name:string;roles:string[];active:boolean}
type SiteType={id:number;name:string}
type Team={id:number;name:string}
type Setup={siteTypes:SiteType[];employees:Employee[];teams:Team[]}
type DefaultStage={name:string;position:number;dependsOnPosition:number|null;evidenceRequired:boolean;requiredRoles:BusinessRole[]}

export function NewSitePage(){
  const {projectId}=useParams();const navigate=useNavigate();const [setup,setSetup]=useState<Setup|null>(null);const [saving,setSaving]=useState(false);const [error,setError]=useState('')
  const [form,setForm]=useState({name:'',siteTypeId:'',address:'',targetDate:''});const [stages,setStages]=useState<DefaultStage[]>([]);
  useEffect(()=>{api<Setup>('/setup').then(setSetup).catch(err=>setError(err instanceof Error?err.message:'Could not load Setup'))},[])
    const selectType=async(value:string)=>{setForm({...form,siteTypeId:value});if(!value){setStages([]);return}setStages(await api<DefaultStage[]>(`/projects/site-types/${value}/defaults`))}
  const updateStage=(index:number,key:keyof DefaultStage,value:unknown)=>setStages(stages.map((stage,i)=>i===index?{...stage,[key]:value}:stage))
  const normalize=(next:DefaultStage[])=>{const dependencies=new Map(stages.map(stage=>[stage,stage.dependsOnPosition?stages[stage.dependsOnPosition-1]:null]));return next.map((stage,index)=>{const dependency=dependencies.get(stage);const dependencyIndex=dependency?next.indexOf(dependency):-1;return {...stage,position:index+1,dependsOnPosition:dependencyIndex>=0&&dependencyIndex<index?dependencyIndex+1:null}})}
  const removeStage=(index:number)=>setStages(normalize(stages.filter((_,i)=>i!==index)))
  const moveStage=(index:number,direction:-1|1)=>{const target=index+direction;if(target<0||target>=stages.length)return;const next=[...stages];const [stage]=next.splice(index,1);next.splice(target,0,stage);setStages(normalize(next))}
  const submit=async(e:FormEvent)=>{e.preventDefault();if(stages.length===0){setError('Add at least one Stage');return}setSaving(true);setError('');try{const result=await post<{id:number}>(`/projects/${projectId}/sites`,{...form,siteTypeId:Number(form.siteTypeId),stages});navigate(`/sites/${result.id}`)}catch(err){setError(err instanceof Error?err.message:'Could not create Site')}finally{setSaving(false)}}
  const field=(patch:Partial<typeof form>)=>setForm({...form,...patch})
  return <Stack gap="sm" className="page-compact" maw={1000}>
    <Anchor component={Link} to={`/projects/${projectId}`} size="sm"><Group gap={4}><ArrowLeft size={14}/>Back to project</Group></Anchor>
    <div><Text size="xs" fw={700} c="orange.8" tt="uppercase">Admin workflow</Text><Title order={2}>Create a Site</Title><Text size="sm" c="dimmed">Customize the delivery Stages, then assign people per Stage from the Site page.</Text></div>
    <form onSubmit={submit}><Stack gap="sm">{error&&<Alert color="red" role="alert">{error}</Alert>}
      <Paper withBorder p="md"><Title order={4} mb="xs">Site details</Title><SimpleGrid cols={{base:1,sm:2}} spacing="sm">
        <TextInput required label="Site name" value={form.name} onChange={e=>field({name:e.currentTarget.value})}/>
        <NativeSelect required label="Site Type" value={form.siteTypeId} onChange={e=>selectType(e.currentTarget.value)} data={[{value:'',label:'Select a type'},...(setup?.siteTypes||[]).map(t=>({value:String(t.id),label:t.name}))]}/>
        <TextInput type="date" label="Target date" value={form.targetDate} onChange={e=>field({targetDate:e.currentTarget.value})}/>
      </SimpleGrid><Textarea mt="sm" label="Site address" autosize minRows={2} value={form.address} onChange={e=>field({address:e.currentTarget.value})}/></Paper>
      <Paper withBorder p="md"><Group justify="space-between" mb="xs"><div><Title order={4}>Stages and dependencies</Title><Text size="xs" c="dimmed">Evidence is required for every Stage. A Stage may have no required roles, or require a Team.</Text></div>
        <Button size="xs" variant="default" leftSection={<Plus size={14}/>} onClick={()=>setStages([...stages,{name:'',position:stages.length+1,dependsOnPosition:stages.length||null,evidenceRequired:true,requiredRoles:[]}])}>Add Stage</Button></Group>
        <Stack gap="xs">{stages.map((stage,index)=><Paper withBorder p="xs" key={index}><Group align="flex-end" gap="xs" wrap="wrap">
          <Badge circle size="lg" color="dark">{index+1}</Badge>
          <TextInput required style={{flex:'1 1 150px'}} label="Stage name" value={stage.name} onChange={e=>updateStage(index,'name',e.currentTarget.value)}/>
          <NativeSelect style={{flex:'1 1 130px'}} label="Depends on" value={String(stage.dependsOnPosition??'')} onChange={e=>updateStage(index,'dependsOnPosition',e.currentTarget.value?Number(e.currentTarget.value):null)} data={[{value:'',label:'No dependency'},...stages.slice(0,index).map((s,i)=>({value:String(i+1),label:`${i+1}. ${s.name||'Untitled Stage'}`}))]}/>
          <div style={{flex:'1 1 170px'}}><RolesSelect includeTeam label="Required Roles" selected={stage.requiredRoles} onChange={roles=>updateStage(index,'requiredRoles',roles)}/></div>
          <Group gap={4}><ActionIcon variant="default" size="lg" disabled={index===0} onClick={()=>moveStage(index,-1)} aria-label={`Move ${stage.name||'Stage'} up`}><ChevronUp size={14}/></ActionIcon><ActionIcon variant="default" size="lg" disabled={index===stages.length-1} onClick={()=>moveStage(index,1)} aria-label={`Move ${stage.name||'Stage'} down`}><ChevronDown size={14}/></ActionIcon><ActionIcon color="red" variant="light" size="lg" onClick={()=>removeStage(index)} aria-label={`Remove ${stage.name||'Stage'}`}><Trash2 size={14}/></ActionIcon></Group>
        </Group></Paper>)}</Stack>
        {stages.length>0&&<Text size="xs" c="dimmed" mt="xs">After the Site is created, the Admin or Project Coordinator assigns people (and Teams) to each Stage's required roles from the Site page.</Text>}</Paper>
      <Group justify="flex-end"><Button component={Link} to={`/projects/${projectId}`} variant="default">Cancel</Button><Button type="submit" loading={saving} rightSection={<ArrowRight size={14}/>}>Create Site</Button></Group>
    </Stack></form>
  </Stack>
}
