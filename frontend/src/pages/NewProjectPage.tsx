import { Alert, Anchor, Button, Group, NativeSelect, Paper, SimpleGrid, Stack, Text, Textarea, TextInput, Title } from '@mantine/core'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, post } from '../lib/api'

type Employee={id:number;name:string;roles:string[];active:boolean}
type Setup={employees:Employee[]}

export function NewProjectPage(){
  const navigate=useNavigate(); const [saving,setSaving]=useState(false); const [error,setError]=useState('')
  const [employees,setEmployees]=useState<Employee[]>([])
  const [form,setForm]=useState({name:'',customerName:'',customerMobile:'',address:'',targetDate:'',coordinatorId:''})
  useEffect(()=>{api<Setup>('/setup').then(data=>setEmployees(data.employees.filter(employee=>employee.active&&employee.roles.includes('COORDINATOR')))).catch(err=>setError(err instanceof Error?err.message:'Could not load Coordinators'))},[])
  const change=(key:string,value:string)=>setForm({...form,[key]:value})
  const submit=async(e:FormEvent)=>{e.preventDefault();setSaving(true);setError('');try{const result=await post<{id:number}>('/projects',{...form,coordinatorId:Number(form.coordinatorId)});navigate(`/projects/${result.id}`)}catch(err){setError(err instanceof Error?err.message:'Could not create project')}finally{setSaving(false)}}
  return <Stack gap="sm" className="page-compact" maw={820}>
    <Anchor component={Link} to="/projects" size="sm"><Group gap={4}><ArrowLeft size={14}/>Back to projects</Group></Anchor>
    <div><Text size="xs" fw={700} c="orange.8" tt="uppercase">Admin workflow</Text><Title order={2}>Create a new Project</Title><Text size="sm" c="dimmed">Capture the customer and delivery details. Add Sites after saving.</Text></div>
    <Paper withBorder p="md" component="form" onSubmit={submit}>
      {error&&<Alert color="red" mb="sm" role="alert">{error}</Alert>}
      <SimpleGrid cols={{base:1,sm:2}} spacing="sm">
        <TextInput required label="Project name" value={form.name} onChange={e=>change('name',e.currentTarget.value)} placeholder="e.g. Sunrise Campus"/>
        <NativeSelect required label="Project Coordinator" value={form.coordinatorId} onChange={e=>change('coordinatorId',e.currentTarget.value)} data={[{value:'',label:'Select a Coordinator'},...employees.map(e=>({value:String(e.id),label:e.name}))]}/>
        <TextInput type="date" label="Target completion date" value={form.targetDate} onChange={e=>change('targetDate',e.currentTarget.value)}/>
        <TextInput required label="Customer name" value={form.customerName} onChange={e=>change('customerName',e.currentTarget.value)} placeholder="Customer or company name"/>
        <TextInput required inputMode="tel" label="Customer mobile number" value={form.customerMobile} onChange={e=>change('customerMobile',e.currentTarget.value)} placeholder="e.g. 98765 43210"/>
      </SimpleGrid>
      <Textarea mt="sm" label="Project address" autosize minRows={2} value={form.address} onChange={e=>change('address',e.currentTarget.value)} placeholder="Street, area, city and state"/>
      <Group justify="flex-end" mt="md"><Button component={Link} to="/projects" variant="default">Cancel</Button><Button type="submit" loading={saving} rightSection={<ArrowRight size={14}/>}>Create project</Button></Group>
    </Paper>
  </Stack>
}
