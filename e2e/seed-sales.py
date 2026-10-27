import json,urllib.request,urllib.error,datetime
B='http://127.0.0.1:8081/api'
def call(m,p,b=None,t=None):
    r=urllib.request.Request(B+p,data=json.dumps(b).encode() if b is not None else None,method=m,headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+t} if t else {})})
    try: return urllib.request.urlopen(r).status, json.load(urllib.request.urlopen(r)) if False else None
    except urllib.error.HTTPError as e: return e.code,None
def login(m): 
    r=urllib.request.Request(B+'/auth/login',data=json.dumps({'mobile':m,'password':'SiteTrack123!'}).encode(),headers={'Content-Type':'application/json'});return json.load(urllib.request.urlopen(r))['token']
def get(p,t,raw=False):
    r=urllib.request.Request(B+p,headers={'Authorization':'Bearer '+t})
    try:
        x=urllib.request.urlopen(r);return x.status,(x.read() if raw else json.load(x))
    except urllib.error.HTTPError as e: return e.code,None
def post(p,b,t):
    r=urllib.request.Request(B+p,data=json.dumps(b).encode(),method='POST',headers={'Content-Type':'application/json','Authorization':'Bearer '+t});return json.load(urllib.request.urlopen(r))
a=login('9000000009');k=login('9000000001');o=login('9000000006')
today=datetime.date.today().isoformat()

def purchase(t):
    import uuid
    bd=uuid.uuid4().hex
    data=json.dumps({'date':today,'vendor':'Moradiya Traders','vendorMobile':'9825011111','vendorGst':'','vendorAddress':'Vasna','billNumber':'B1','items':[{'material':'Cement OPC','uom':'Bag','qty':100,'rate':400,'gst':28}]})
    body=('--%s\r\nContent-Disposition: form-data; name="data"\r\nContent-Type: application/json\r\n\r\n%s\r\n--%s--\r\n'%(bd,data,bd)).encode()
    r=urllib.request.Request(B+'/material/purchases',data=body,method='POST',headers={'Content-Type':'multipart/form-data; boundary='+bd,'Authorization':'Bearer '+t});return json.load(urllib.request.urlopen(r))
purchase(a)
item={'material':'Cement OPC','uom':'Bag','qty':30,'rate':400,'gst':28}
s1=post('/material/sales',{'type':'DEBIT','date':today,'vendor':'Patel Constructions','newVendor':{'name':'Patel Constructions','mobile':'9898011122','gst':'','address':'Gandhinagar'},'siteIds':[1,3],'items':[item]},a)
s2=post('/material/sales',{'type':'DEBIT','date':today,'vendor':'Patel Constructions','siteIds':[],'items':[{**item,'qty':1}]},a)
import os;os.makedirs('e2e-out',exist_ok=True);open('e2e-out/siteless.txt','w').write(s2['saleId'])
print('linked',s1['saleId'],'sitesless',s2['saleId'])
R=[]
def chk(n,ok): R.append(ok);print('OK  ' if ok else 'FAIL',n)
chk('Kavita project 1 lists only linked sale',[x['id'] for x in get('/projects/1/sales',k)[1]]==[s1['id']])
chk('Kavita site 1 lists only linked sale',[x['id'] for x in get('/sites/1/sales',k)[1]]==[s1['id']])
chk('Kavita linked challan 200 PDF',(lambda r:r[0]==200 and r[1][:4]==b'%PDF')(get(f"/material/sales/{s1['id']}/challan",k,True)))
chk('Kavita site-less challan 404',get(f"/material/sales/{s2['id']}/challan",k)[0]==404)
chk('Kavita cannot see other project 2',get('/projects/2/sales',k)[0]==403)
chk('Other coord sees whole linked doc but only own site',(lambda l:len(l)==1 and l[0]['siteIds']==[3])(get('/projects/2/sales',o)[1]))
chk('Kavita linked sale shows only her site',(lambda l:l[0]['siteIds']==[1])(get('/projects/1/sales',k)[1]))
chk('Kavita /material 403',get('/material/bootstrap',k)[0]==403)
chk('Admin sees both',(lambda l:{s1['id'],s2['id']}<={x['id'] for x in l})(get('/material/bootstrap',a)[1]['sales']))
chk('Admin site-less challan 200',get(f"/material/sales/{s2['id']}/challan",a,True)[0]==200)
print('api scenarios',sum(R),'/',len(R))

raise SystemExit(0 if all(R) else 1)
