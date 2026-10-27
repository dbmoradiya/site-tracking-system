import http.server, os, urllib.request, urllib.error
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','frontend','dist')
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s,*a,**k): super().__init__(*a,directory=D,**k)
    def proxy(s):
        n=int(s.headers.get('Content-Length') or 0); body=s.rfile.read(n) if n else None
        req=urllib.request.Request('http://127.0.0.1:8081'+s.path,data=body,method=s.command)
        for k,v in s.headers.items():
            if k.lower() not in ('host','content-length','connection','origin'): req.add_header(k,v)
        try: r=urllib.request.urlopen(req); code=r.status; hd=r.headers; data=r.read()
        except urllib.error.HTTPError as e: code=e.code; hd=e.headers; data=e.read()
        s.send_response(code)
        for k,v in hd.items():
            if k.lower() not in ('transfer-encoding','connection','content-length'): s.send_header(k,v)
        s.send_header('Content-Length',str(len(data))); s.end_headers(); s.wfile.write(data)
    do_POST=do_PUT=do_DELETE=lambda s: s.proxy()
    def do_GET(s):
        if s.path.startswith('/api'): return s.proxy()
        p=s.translate_path(s.path.split('?')[0])
        if not os.path.exists(p) or os.path.isdir(p) and not os.path.exists(p+'/index.html'): s.path='/index.html'
        super().do_GET()
http.server.ThreadingHTTPServer(('127.0.0.1',4173),H).serve_forever()
