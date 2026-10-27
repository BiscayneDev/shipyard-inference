# Manual bounded offline browser qualification. Requires Chrome and Python websocket-client.
# Uses fictional identities/tokens only; blocks external browser URLs and mocks all server fetch.
import http.server,threading,subprocess,json,urllib.request,time,os,websocket,base64
repo=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
serverproc=subprocess.Popen(['node','--import','tsx','test/portal-browser-callback.fixture.mjs'],cwd=repo,stdout=open('/tmp/portal-callback-node.txt','w'),stderr=subprocess.STDOUT)
for attempt in range(100):
 try: urllib.request.urlopen('http://127.0.0.1:18949/api/auth/config',timeout=1);break
 except: time.sleep(.1)
p=subprocess.Popen([os.environ.get('CHROME_BIN','/usr/bin/google-chrome'),'--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=18950','--remote-allow-origins=*','--user-data-dir=/tmp/portal-fictional-chrome','--window-size=1440,1000','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for i in range(50):
  try: tabs=json.load(urllib.request.urlopen('http://127.0.0.1:18950/json'));break
  except:time.sleep(.1)
 ws=websocket.create_connection(tabs[0]['webSocketDebuggerUrl'],timeout=6); seq=0
 def call(method,params={}):
  global seq;seq+=1;ws.send(json.dumps({'id':seq,'method':method,'params':params}))
  while True:
   r=json.loads(ws.recv())
   if r.get('id')==seq:return r
 call('Page.enable');call('Runtime.enable');call('Network.enable');call('Network.setBlockedURLs',{'urls':['https://*','http://fictional*']});call('Page.navigate',{'url':'http://127.0.0.1:18949/'})
 time.sleep(1)
 result=call('Runtime.evaluate',{'expression':"(async()=>{const r=await fetch('api/wallet/connect',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({wallet:'paybox'})});return await r.json()})()",'awaitPromise':True,'returnByValue':True})
 print(json.dumps(result,indent=2));target=result['result']['result']['value']['redirect'];call('Page.navigate',{'url':target});time.sleep(1)
 result=call('Runtime.evaluate',{'expression':"(async()=>{const a=await(await fetch('api/session')).json();const sid=a.sessionId;localStorage.setItem('fixture-owner','b');const b=await(await fetch('api/session')).json();localStorage.setItem('fixture-owner','a');const r=await(await fetch('/fixture-result')).json();return {a,b,check:r,url:location.href,httpOnly:!document.cookie.includes('portal.session'),local:localStorage.getItem('portal.session')}})()",'awaitPromise':True,'returnByValue':True})
 shot=call('Page.captureScreenshot',{'format':'png'})
 os.makedirs('/downloads/appsec',exist_ok=True);open('/downloads/appsec/portal49-fictional-callback-browser.png','wb').write(base64.b64decode(shot['result']['data']))
 print(json.dumps(result,indent=2));v=result['result']['result']['value'];assert v['a']['sessionId'] and v['b']['sessionId'] is None and v['check']['exchange']==1 and v['httpOnly'] and 'portalSession' not in v['url']
finally:p.terminate();p.wait();serverproc.terminate();serverproc.wait()
