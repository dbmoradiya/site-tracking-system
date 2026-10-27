import json,urllib.request
B='http://127.0.0.1:8081/api'
def call(m,p,b=None,t=None):
    r=urllib.request.Request(B+p,data=json.dumps(b).encode() if b is not None else None,method=m,headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+t} if t else {})})
    return json.load(urllib.request.urlopen(r))
t=call('POST','/auth/login',{'mobile':'9000000009','password':'SiteTrack123!'})['token']
for n,m,r in [('Kavita Shah','9000000001','COORDINATOR'),('Other Coord','9000000006','COORDINATOR'),('Rakesh S','9000000002','SUPERVISOR')]:
    call('POST','/setup/employees',{'name':n,'mobile':m,'roles':[r],'password':'SiteTrack123!'},t)
call('POST','/setup/teams',{'name':'Team A','contactName':'Lead','mobile':'9825000000','notes':''},t)
ty=call('POST','/setup/site-types',{'name':'Solar','description':'d','stages':[{'name':'Design','requiredRoles':['SUPERVISOR']},{'name':'Install','dependsOnPosition':1,'requiredRoles':['SUPERVISOR']}]},t)['id']
emps={e['name']:e['id'] for e in call('GET','/setup',None,t)['employees']}
pa=call('POST','/projects',{'name':'Sun City Complex','customerName':'A','customerMobile':'9999999999','coordinatorId':emps['Kavita Shah']},t)['id']
pb=call('POST','/projects',{'name':'Green Valley Villas','customerName':'B','customerMobile':'9999999999','coordinatorId':emps['Other Coord']},t)['id']
st=lambda p,n:call('POST',f'/projects/{p}/sites',{'name':n,'siteTypeId':ty,'stages':[{'name':'Design','requiredRoles':['SUPERVISOR']},{'name':'Install','dependsOnPosition':1,'requiredRoles':['SUPERVISOR']}]},t)['id']
print(pa,pb,st(pa,'Block A'),st(pa,'Block B'),st(pb,'Villa 9'))
