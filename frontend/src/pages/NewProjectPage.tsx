import { ArrowLeft, ArrowRight, Building2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { post } from '../lib/api'

export function NewProjectPage(){
  const navigate=useNavigate(); const [saving,setSaving]=useState(false); const [error,setError]=useState('')
  const [form,setForm]=useState({name:'',customerName:'',customerMobile:'',address:'',targetDate:''})
  const change=(key:string,value:string)=>setForm({...form,[key]:value})
  const submit=async(e:FormEvent)=>{e.preventDefault();setSaving(true);setError('');try{const result=await post<{id:number}>('/projects',form);navigate(`/projects/${result.id}`)}catch(err){setError(err instanceof Error?err.message:'Could not create project')}finally{setSaving(false)}}
  return <div className="page page--narrow"><Link className="back-link" to="/projects"><ArrowLeft/>Back to projects</Link><header className="page-header"><div><p className="eyebrow">Admin workflow</p><h1>Create a new Project</h1><p>Capture the customer and delivery details. Add Sites after saving.</p></div></header>
    <form className="form-card" onSubmit={submit}><div className="form-card__intro"><span><Building2/></span><div><h2>Project details</h2><p>Fields marked with * are required.</p></div></div>{error&&<div className="alert alert--error">{error}</div>}
      <div className="form-grid"><label>Project name *<input required value={form.name} onChange={e=>change('name',e.target.value)} placeholder="e.g. Sunrise Campus"/></label><label>Target completion date<input type="date" value={form.targetDate} onChange={e=>change('targetDate',e.target.value)}/></label><label>Customer name *<input required value={form.customerName} onChange={e=>change('customerName',e.target.value)} placeholder="Customer or company name"/></label><label>Customer mobile number *<input required inputMode="tel" value={form.customerMobile} onChange={e=>change('customerMobile',e.target.value)} placeholder="e.g. 98765 43210"/></label><label className="form-grid__wide">Project address<textarea rows={3} value={form.address} onChange={e=>change('address',e.target.value)} placeholder="Street, area, city and state"/></label></div>
      <div className="form-actions"><Link className="button button--secondary" to="/projects">Cancel</Link><button className="button button--primary" disabled={saving}>{saving?'Creating…':<>Create project <ArrowRight/></>}</button></div>
    </form>
  </div>
}
