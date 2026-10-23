#!/usr/bin/env python3
"""Dev-only sample data for SiteTrack, loaded through the public API.

Usage (backend must be running and the Admin must exist):
  SEED_ADMIN_MOBILE=9999988888 SEED_ADMIN_PASSWORD='your-admin-password' \
      python3 scripts/seed-demo.py [API_BASE_URL]

Creates 2 site types, 3 teams, 8 employees (random passwords, printed once at
the end), and 3 projects in different states with evidence files.
Run it once on an empty database. Never run it against production.
"""
import json, urllib.request, urllib.error, subprocess, os, sys, zlib, struct, secrets, tempfile, string
B = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8081') .rstrip('/') + '/api'
AM = os.environ.get('SEED_ADMIN_MOBILE'); pw = os.environ.get('SEED_ADMIN_PASSWORD')
if not AM or not pw: sys.exit('Set SEED_ADMIN_MOBILE and SEED_ADMIN_PASSWORD')
D = tempfile.mkdtemp(prefix='seed-')
def png(path, rgb):
    w, h = 480, 320
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    def ch(t, d): c = struct.pack('>I', len(d)) + t + d; return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b''))
def pdf(path):
    objs = [b'<</Type/Catalog/Pages 2 0 R>>', b'<</Type/Pages/Kids[3 0 R]/Count 1>>',
            b'<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
            None, b'<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>']
    st = b'BT /F1 18 Tf 30 100 Td (SiteTrack sample drawing) Tj ET'
    objs[3] = b'<</Length %d>>\nstream\n' % len(st) + st + b'\nendstream'
    out = b'%PDF-1.4\n'; offs = []
    for i, o in enumerate(objs): offs.append(len(out)); out += b'%d 0 obj\n' % (i + 1) + o + b'\nendobj\n'
    x = len(out); out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1) + b''.join(b'%010d 00000 n \n' % o for o in offs)
    out += b'trailer\n<</Size %d/Root 1 0 R>>\nstartxref\n%d\n%%%%EOF' % (len(objs) + 1, x)
    open(path, 'wb').write(out)
for n, c in [('survey.png', (59, 130, 246)), ('foundation.png', (148, 163, 184)), ('install.png', (234, 179, 8)), ('steel.png', (100, 116, 139)), ('commission.png', (34, 197, 94))]: png(f'{D}/{n}', c)
pdf(f'{D}/drawing.pdf'); pdf(f'{D}/boq.pdf')
def rp(prefix): return prefix + '-' + ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))
def call(m,p,body=None,tok=None):
    r=urllib.request.Request(B+p,method=m,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+tok} if tok else {})})
    try:
        with urllib.request.urlopen(r) as x: t=x.read().decode(); return json.loads(t) if t else {}
    except urllib.error.HTTPError as e: sys.exit(f"{m} {p} {e.code} {e.read().decode()[:200]}")
def login(e,p): return call('POST','/auth/login',{'mobile':e,'password':p})['token']
adm=login(AM,pw)
# Refuse to run twice: check everything the script creates BEFORE creating anything.
_s = call('GET','/setup',None,adm)
_clash = [t['name'] for t in _s.get('siteTypes',[]) if t['name'] in ('Solar Rooftop','Industrial Shed')] \
       + [t['name'] for t in _s.get('teams',[]) if t['name'] in ('Sun Power Installers','Apex Steel Erectors','Gujarat Civil Works')]
_mob = {'9000010001','9000010002','9000010003','9000010004','9000010005','9000010006','9000010007','9000010008'}
_clash += [e['name'] for e in _s.get('employees',[]) if ''.join(c for c in str(e.get('mobile') or '') if c.isdigit())[-10:] in _mob]
_proj = [p['name'] for p in call('GET','/projects',None,adm) if p['name'] in ('Sunrise Industrial Park','Navkar Logistics Hub','Greenfield Residency')]
if _clash or _proj: sys.exit('Sample data already exists (' + ', '.join(_clash + _proj) + '). Nothing was changed. Use an empty database.')
SUP,DE,PM,CO,TEAM='SUPERVISOR','DESIGN_ENGINEER','PROCUREMENT_MANAGER','COORDINATOR','TEAM'
types={
 'Solar Rooftop':('Rooftop solar installation, survey to commissioning',[('Site Survey',None,[SUP]),('Structural Design',1,[DE]),('Material Procurement',2,[PM]),('Mounting and Panel Installation',3,[TEAM,SUP]),('Electrical and Commissioning',4,[SUP,DE])]),
 'Industrial Shed':('Pre-engineered steel shed construction',[('Site Survey',None,[SUP]),('Foundation Work',1,[TEAM]),('Fabrication Drawings',1,[DE]),('Steel Procurement',3,[PM]),('Erection and Handover',4,[TEAM,SUP])]),
}
tid={}
for n,(d,st) in types.items():
    call('POST','/setup/site-types',{'name':n,'description':d,'stages':[{'name':a,'dependsOnPosition':b,'requiredRoles':c} for a,b,c in st]},adm)
s=call('GET','/setup',None,adm); tid={t['name']:t['id'] for t in s['siteTypes']}
teams={}
for n,c,m in [('Sun Power Installers','Ramesh Bhai','+91 98250 11001'),('Apex Steel Erectors','Jayesh Patel','+91 98250 11002'),('Gujarat Civil Works','Nilesh Mehta','+91 98250 11003')]:
    teams[n]=call('POST','/setup/teams',{'name':n,'contactName':c,'mobile':m,'notes':''},adm)['id']
emps={}
people=[('Kavita Shah','90000 10001',CO,rp('x'),'+91 98250 20001'),('Imran Khan','90000 10002',CO,rp('x'),'+91 98250 20002'),
 ('Rakesh Solanki','90000 10003',SUP,rp('x'),'+91 98250 20003'),('Mehul Parmar','90000 10004',SUP,rp('x'),'+91 98250 20004'),
 ('Dev Patel','90000 10005',DE,rp('x'),'+91 98250 20005'),('Anita Desai','90000 10006',DE,rp('x'),'+91 98250 20006'),
 ('Priya Nair','90000 10007',PM,rp('x'),'+91 98250 20007'),('Vikram Rao','90000 10008',PM,rp('x'),'+91 98250 20008')]
cred={}
for n,e,r,p,m in people:
    emps[n]=call('POST','/setup/employees',{'name':n,'mobile':e,'roles':[r],'password':p},adm)['id']; cred[n]=(e,p,r)
tok={n:login(c[0],c[1]) for n,c in cred.items()}
def mkproject(name,cust,mob,addr,date,coord):
    return call('POST','/projects',{'name':name,'customerName':cust,'customerMobile':mob,'address':addr,'targetDate':date,'coordinatorId':emps[coord]},adm)['id']
def mksite(pid,name,typ,addr,date):
    d=call('GET',f'/projects/site-types/{tid[typ]}/defaults',None,adm)
    sid=call('POST',f'/projects/{pid}/sites',{'name':name,'siteTypeId':tid[typ],'address':addr,'targetDate':date,'stages':[{'name':x['name'],'dependsOnPosition':x['dependsOnPosition'],'requiredRoles':x['requiredRoles']} for x in d]},adm)['id']
    return sid
def stages(sid):
    return call('GET',f'/sites/{sid}',None,adm)['stages']
FILES={'Site Survey':'survey.png','Structural Design':'drawing.pdf','Fabrication Drawings':'drawing.pdf','Material Procurement':'boq.pdf','Steel Procurement':'boq.pdf','Foundation Work':'foundation.png','Mounting and Panel Installation':'install.png','Erection and Handover':'steel.png','Electrical and Commissioning':'commission.png'}
def assign(sid,coord,mapping):
    for st in stages(sid):
        m={}
        for r in st['requiredRoles'] if 'requiredRoles' in st else []:
            if r in mapping: m[r]=mapping[r]
        if m: call('PUT',f'/sites/{sid}/stages/{st["id"]}/assignments',{'roleAssignments':m},tok[coord])
def upload(who,stid,fn,comment):
    out=subprocess.run(['curl','-s','-o','/dev/null','-w','%{http_code}','-X','POST',f'{B}/stages/{stid}/evidence','-H','Authorization: Bearer '+tok[who],'-F','file=@'+D+'/'+fn,'-F','comment='+comment],capture_output=True,text=True).stdout
    if out!='200': sys.exit(f'upload {stid} {out}')
def actor(st,mapping,coord,asg):
    roles=st['requiredRoles']; r=[x for x in roles if x!=TEAM]
    return asg[r[0]] if r else coord
def run(sid,coord,asg,upto,reject=(),pending=None):
    """approve first `upto` stages in order; reject names get one change request first; pending=name left submitted"""
    for i,st in enumerate(stages(sid)):
        if i>=upto and st['name']!=pending: continue
        who=actor(st,None,coord,asg)
        upload(who,st['id'],FILES[st['name']],f"{st['name']} evidence")
        if st['name'] in reject:
            call('POST',f'/stages/{st["id"]}/submit',None,tok[who]); call('POST',f'/stages/{st["id"]}/review',{'action':'CHANGES_REQUESTED','note':'Please add a clearer photo with the measurements visible.'},tok[coord])
            upload(who,st['id'],FILES[st['name']],'Updated evidence after review')
        call('POST',f'/stages/{st["id"]}/submit',None,tok[who])
        if st['name']==pending: return
        call('POST',f'/stages/{st["id"]}/review',{'action':'APPROVED','note':''},tok[coord])
T=teams
# Project 1: completed
p1=mkproject('Sunrise Industrial Park','Sunrise Industries Pvt Ltd','+91 79 4000 1100','GIDC Vatva, Ahmedabad','2026-11-30','Kavita Shah')
for n,sup,de,pm,tm in [('Rooftop Block A','Rakesh Solanki','Dev Patel','Priya Nair','Sun Power Installers'),('Rooftop Block B','Mehul Parmar','Anita Desai','Vikram Rao','Sun Power Installers')]:
    sid=mksite(p1,n,'Solar Rooftop','GIDC Vatva, Ahmedabad','2026-11-30')
    asg={SUP:emps[sup],DE:emps[de],PM:emps[pm],TEAM:T[tm]}; 
    # SUPERVISOR etc names for tokens
    names={SUP:sup,DE:de,PM:pm}
    assign(sid,'Kavita Shah',asg)
    asgn={k:names[k] for k in names}
    run(sid,'Kavita Shah',asgn,5,reject=('Site Survey',) if n.endswith('A') else ())
# Project 2: in progress
p2=mkproject('Navkar Logistics Hub','Navkar Logistics LLP','+91 2717 220 330','Sanand, Gujarat','2027-01-31','Imran Khan')
s=mksite(p2,'Warehouse Shed 1','Industrial Shed','Sanand, Gujarat','2027-01-15')
asg={SUP:emps['Mehul Parmar'],DE:emps['Anita Desai'],PM:emps['Vikram Rao'],TEAM:T['Apex Steel Erectors']}; assign(s,'Imran Khan',asg)
names={SUP:'Mehul Parmar',DE:'Anita Desai',PM:'Vikram Rao'}
# survey, foundation approved; drawings changes requested then left changes requested -> custom
sts=stages(s)
def appr(st,who):
    upload(who,st['id'],FILES[st['name']],st['name']+' evidence'); call('POST',f'/stages/{st["id"]}/submit',None,tok[who]); call('POST',f'/stages/{st["id"]}/review',{'action':'APPROVED','note':''},tok['Imran Khan'])
appr(sts[0],'Mehul Parmar'); appr(sts[1],'Imran Khan')
upload('Anita Desai',sts[2]['id'],'drawing.pdf','Fabrication drawings Rev A'); call('POST',f'/stages/{sts[2]["id"]}/submit',None,tok['Anita Desai'])
call('POST',f'/stages/{sts[2]["id"]}/review',{'action':'CHANGES_REQUESTED','note':'Anchor bolt layout is missing. Please update the drawing and resubmit.'},tok['Imran Khan'])
s2=mksite(p2,'Rooftop Solar Canopy','Solar Rooftop','Sanand, Gujarat','2027-01-31')
asg2={SUP:emps['Rakesh Solanki'],DE:emps['Dev Patel'],PM:emps['Priya Nair'],TEAM:T['Sun Power Installers']}; assign(s2,'Imran Khan',asg2)
names2={SUP:'Rakesh Solanki',DE:'Dev Patel',PM:'Priya Nair'}
run(s2,'Imran Khan',names2,1,pending='Structural Design')
s3=mksite(p2,'Warehouse Shed 2','Industrial Shed','Sanand, Gujarat','2027-01-31')  # not started, unassigned
# Project 3: not started
p3=mkproject('Greenfield Residency','Greenfield Developers','+91 98250 77000','Bopal, Ahmedabad','2027-03-15','Kavita Shah')
mksite(p3,'Clubhouse Rooftop Solar','Solar Rooftop','Bopal, Ahmedabad','2027-03-15')
mksite(p3,'Tower B Rooftop Solar','Solar Rooftop','Bopal, Ahmedabad','2027-03-15')
print('Seed OK. Employee logins (mobile / password / role):')
for n,(m,p,r) in cred.items(): print(f'  {n}: {m.replace(" ","")} / {p} / {r}')
