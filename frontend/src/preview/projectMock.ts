// UI PREVIEW ONLY: sample projects and sites so the linked-sales sections can be shown. Not real data.
type Asg = { role: string; employeeId: number | null; employeeName: string | null }
const stage = (id: number, name: string, status: string, position: number) => ({ id, name, position, status, evidenceRequired: false, requiredRoles: [] as string[], assignments: [] as Asg[], evidenceCount: 0, canManage: false, canUpload: false })
const sites = [
  { id: 101, name: 'Block A', address: 'Sun City, Sector 5', targetDate: '2026-12-31', status: 'IN_PROGRESS', projectId: 1, projectName: 'Sun City Complex', siteType: 'Solar Rooftop' },
  { id: 102, name: 'Block B', address: 'Sun City, Sector 6', targetDate: '2027-01-31', status: 'IN_PROGRESS', projectId: 1, projectName: 'Sun City Complex', siteType: 'Solar Rooftop' },
  { id: 201, name: 'Villa 9', address: 'Green Valley, Lane 3', targetDate: '2026-11-30', status: 'IN_PROGRESS', projectId: 2, projectName: 'Green Valley Villas', siteType: 'Villa Electrical' },
  { id: 202, name: 'Villa 12', address: 'Green Valley, Lane 4', targetDate: '2026-12-15', status: 'IN_PROGRESS', projectId: 2, projectName: 'Green Valley Villas', siteType: 'Villa Electrical' },
]
const projects = [
  { id: 1, name: 'Sun City Complex', customerName: 'Sun City Developers (sample)', customerMobile: '9000000001', address: 'Sun City, Gandhinagar', targetDate: '2027-01-31', status: 'IN_PROGRESS', coordinatorId: 7, coordinator: 'Sample Coordinator', coordinatorHistory: [] },
  { id: 2, name: 'Green Valley Villas', customerName: 'Green Valley Homes (sample)', customerMobile: '9000000002', address: 'Green Valley, Ahmedabad', targetDate: '2026-12-15', status: 'IN_PROGRESS', coordinatorId: 8, coordinator: 'Other Coordinator', coordinatorHistory: [] },
]
// Preview-only scoping: a coordinator only reaches projects/sites where they are the assigned coordinator.
const me = () => { try { return JSON.parse(localStorage.getItem('sitetrack-user') || '{}') } catch { return {} } }
const scoped = (projectId: number) => { const u = me(); if (!u.roles?.includes('COORDINATOR') || u.roles.includes('ADMIN')) return true; return projects.find(x => x.id === projectId)?.coordinatorId === u.employeeId }
// Demo stages for Block A (preview only): shows every state. Actions below change this in-memory copy only.
type DStage = ReturnType<typeof stage>
const A = (role: string, id: number | null, name: string | null) => ({ role, employeeId: id, employeeName: name })
const demo = (): DStage[] => [
  { ...stage(11, 'Site survey', 'COMPLETED', 1), requiredRoles: ['SUPERVISOR'], assignments: [A('SUPERVISOR', 21, 'Ravi Patel')], evidenceCount: 2, evidenceRequired: true },
  { ...stage(12, 'Design approval', 'REVIEW_PENDING', 2), requiredRoles: ['DESIGN_ENGINEER'], assignments: [A('DESIGN_ENGINEER', 22, 'Meera Shah')], evidenceCount: 1, evidenceRequired: true },
  { ...stage(13, 'Material procurement', 'IN_PROGRESS', 3), requiredRoles: ['PROCUREMENT_MANAGER'], assignments: [A('PROCUREMENT_MANAGER', 23, 'Kiran Desai')], evidenceCount: 0, canUpload: true, evidenceRequired: true },
  { ...stage(14, 'Installation', 'BLOCKED', 4), requiredRoles: ['SUPERVISOR', 'TEAM'], assignments: [A('SUPERVISOR', null, null), A('TEAM', null, null)], evidenceCount: 0 },
  { ...stage(15, 'Handover', 'BLOCKED', 5), evidenceCount: 0 },
]
let demoStages = demo()
const isAdmin = () => { const u = me(); return !u.roles || u.roles.includes('ADMIN') }
const unlockNext = (id: number) => { const i = demoStages.findIndex(x => x.id === id); const n = demoStages[i + 1]; if (n && n.status === 'BLOCKED') n.status = 'IN_PROGRESS'; if (n && n.status === 'IN_PROGRESS' && n.requiredRoles.length) n.canUpload = true }
function demoAction(p: string, method?: string, body?: unknown): boolean {
  let m = p.match(/^\/stages\/(\d+)\/(review|complete|submit|evidence)$/)
  if (!m || !method || method === 'GET') return false
  const st = demoStages.find(x => x.id === Number(m[1])); if (!st) return true
  if (m[2] === 'complete') { st.status = 'COMPLETED'; unlockNext(st.id) }
  else if (m[2] === 'submit') st.status = 'REVIEW_PENDING'
  else if (m[2] === 'evidence') { st.evidenceCount += 1; st.status = st.status === 'REVIEW_PENDING' ? st.status : 'IN_PROGRESS' }
  else if (typeof body === 'string' && body.includes('CHANGES_REQUESTED')) st.status = 'CHANGES_REQUESTED'
  else { st.status = 'APPROVED'; unlockNext(st.id) }
  return true
}
export function previewApi(path: string, method?: string, body?: unknown): unknown {
  const p = path.split('?')[0]
  if (demoAction(p, method, body)) return undefined
  if (/^\/stages\/\d+\/evidence$/.test(p)) return [{ id: 1, fileName: 'site-photo-1.jpg', contentType: 'image/jpeg', comment: 'Roof front view', uploadedAt: '2026-10-25T10:20:00', uploadedBy: 'Ravi Patel' }]
  if (/^\/stages\/\d+\/history$/.test(p)) return { reviews: [{ action: 'SUBMITTED', note: '—', createdAt: '2026-10-25T10:30:00', actionBy: 'Ravi Patel' }] }

  if (p === '/projects') return projects.filter(x => scoped(x.id)).map(x => ({ ...x, siteCount: sites.filter(s => s.projectId === x.id).length, completedSites: 0, coordinators: [x.coordinator], assignments: [], actionRequired: 0 }))
  let m = p.match(/^\/projects\/(\d+)$/)
  if (m) { const pr = projects.find(x => x.id === Number(m![1])); if (pr && !scoped(pr.id)) throw new Error('Not assigned to this project (preview)'); return pr ? { ...pr, sites: sites.filter(s => s.projectId === pr.id).map(s => ({ ...s, stageCount: 3, completedSites: 0, completedStages: 1 })) } : [] }
  m = p.match(/^\/sites\/(\d+)$/)
  if (m) { const s = sites.find(x => x.id === Number(m![1])); if (s && !scoped(s.projectId)) throw new Error('Not assigned to this site (preview)'); return s ? { ...s, projectCoordinatorId: projects.find(x => x.id === s.projectId)?.coordinatorId, coordinator: 'Sample Coordinator', teamId: null, team: '', canManage: s.id === 101 && isAdmin(), assignmentHistory: [], stages: s.id === 101 ? demoStages.map(x => ({ ...x, assignments: x.assignments.map(a => ({ ...a })) })) : [stage(1, 'Survey', 'COMPLETED', 1), stage(2, 'Installation', 'IN_PROGRESS', 2), stage(3, 'Handover', 'PENDING', 3)] } : [] }
  if (p === '/dashboard') return { counts: [] }
  if (p === '/notifications') return { items: [], total: 0, page: 0, size: 8 }
  if (p === '/setup') return { siteTypes: [], employees: [{ id: 21, name: 'Ravi Patel', roles: ['SUPERVISOR'] }, { id: 22, name: 'Meera Shah', roles: ['DESIGN_ENGINEER'] }, { id: 23, name: 'Kiran Desai', roles: ['PROCUREMENT_MANAGER'] }], teams: [{ id: 1, name: 'Team Alpha' }] }
  return []
}
