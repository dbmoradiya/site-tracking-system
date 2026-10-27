// UI PREVIEW ONLY: sample projects and sites so the linked-sales sections can be shown. Not real data.
const stage = (id: number, name: string, status: string, position: number) => ({ id, name, position, status, evidenceRequired: false, requiredRoles: [] as string[], assignments: [] as unknown[], evidenceCount: 0, canManage: false, canUpload: false })
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
export function previewApi(path: string): unknown {
  const p = path.split('?')[0]
  if (p === '/projects') return projects.filter(x => scoped(x.id)).map(x => ({ ...x, siteCount: sites.filter(s => s.projectId === x.id).length, completedSites: 0, coordinators: [x.coordinator], assignments: [], actionRequired: 0 }))
  let m = p.match(/^\/projects\/(\d+)$/)
  if (m) { const pr = projects.find(x => x.id === Number(m![1])); if (pr && !scoped(pr.id)) throw new Error('Not assigned to this project (preview)'); return pr ? { ...pr, sites: sites.filter(s => s.projectId === pr.id).map(s => ({ ...s, stageCount: 3, completedSites: 0, completedStages: 1 })) } : [] }
  m = p.match(/^\/sites\/(\d+)$/)
  if (m) { const s = sites.find(x => x.id === Number(m![1])); if (s && !scoped(s.projectId)) throw new Error('Not assigned to this site (preview)'); return s ? { ...s, projectCoordinatorId: projects.find(x => x.id === s.projectId)?.coordinatorId, coordinator: 'Sample Coordinator', teamId: null, team: '', canManage: false, assignmentHistory: [], stages: [stage(1, 'Survey', 'COMPLETED', 1), stage(2, 'Installation', 'IN_PROGRESS', 2), stage(3, 'Handover', 'PENDING', 3)] } : [] }
  if (p === '/dashboard') return { counts: [] }
  if (p === '/notifications') return { items: [], total: 0, page: 0, size: 8 }
  if (p === '/setup') return { siteTypes: [], employees: [], teams: [] }
  return []
}
