const {app,BrowserWindow,session,desktopCapturer,dialog,shell,powerSaveBlocker,systemPreferences,ipcMain,screen}=require('electron');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
let win,server,origin,blocker,overlay,overlayDisplay,overlayTimer; let captureChoice=null,capturePreference={kind:'screen',display:null}; const activeSessions=new Map(); const gotLock=app.requestSingleInstanceLock(); if(!gotLock){app.quit();}
const root=path.join(__dirname,'..');
const allowed=new Map([['/','index.html'],['/index.html','index.html'],['/gaze-worker.js','gaze-worker.js']]);
function serve(){return new Promise((resolve,reject)=>{
 server=http.createServer((req,res)=>{
  let name;try{name=allowed.get(new URL(req.url,'http://localhost').pathname)}catch{}
  if(!name||req.method!=='GET'||req.headers.host!==new URL(origin).host){res.writeHead(404);res.end();return}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self' https: blob: data:; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://webgazer.cs.brown.edu; style-src 'self' 'unsafe-inline' https:; worker-src 'self' blob:; connect-src 'self' https:; object-src 'none'; base-uri 'none'; frame-src 'none'");
  const f=fs.createReadStream(path.join(root,name));f.on('error',()=>res.destroy());f.pipe(res);
 });server.once('error',reject);server.listen(47831,'127.0.0.1',()=>{origin='http://127.0.0.1:'+server.address().port;resolve()});
})}
function trusted(url){try{return new URL(url).origin===origin}catch{return false}}
function permissions(s){
 s.setPermissionCheckHandler((contents,permission,requestingOrigin,details)=>trusted(requestingOrigin)&&['media','display-capture','fullscreen'].includes(permission)&&(!details?.mediaType||details.mediaType!=='audio'));
 s.setPermissionRequestHandler(async(contents,permission,callback,details)=>{
  if(!trusted(details.requestingUrl||contents.getURL())||!['media','display-capture','fullscreen'].includes(permission)){callback(false);return}
  if(permission==='media'&&details.mediaTypes?.includes('audio')){callback(false);return}
  if(permission==='media'&&process.platform==='darwin'){try{const ok=await systemPreferences.askForMediaAccess('camera');callback(ok)}catch{callback(false)}return}
  callback(true);
 });
 s.setDisplayMediaRequestHandler(async(request,callback)=>{
  if(!trusted(request.securityOrigin)||!request.videoRequested){callback({});return}
  try{
   captureChoice=null;
   const kind=capturePreference.kind==='window'?'window':'screen';
   const sources=await desktopCapturer.getSources({types:[kind],thumbnailSize:{width:0,height:0}});
   const displays=screen.getAllDisplays(),primary=screen.getPrimaryDisplay();
   let choices=sources.filter(x=>kind==='screen'||(x.name.trim()&&!/^\d+$/.test(x.name.trim()))).map((source,i)=>{
    const d=displays.find(d=>String(d.id)===String(source.display_id))||(kind==='screen'&&sources.length===1&&displays.length===1?displays[0]:null);
    const calibrated=d&&d.id===capturePreference.display;
    return {source,d,calibrated,label:kind==='screen'?(d?.label||'Display '+(i+1))+(d?' · '+d.size.width+' × '+d.size.height:'')+(d?.id===primary.id?' · Main display':'')+(calibrated?' · Calibrated':''):source.name.slice(0,90)};
   });
   choices.sort((a,b)=>Number(!!b.calibrated)-Number(!!a.calibrated));
   choices=choices.slice(0,20);
   if(!choices.length){callback({});dialog.showErrorBox('No capture sources','Allow Screen Recording in macOS Privacy & Security, then restart GazeLab.');return}
   const {response}=await dialog.showMessageBox(win,{type:'question',title:kind==='screen'?'Record a display':'Record an application window',message:kind==='screen'?'Choose your display':'Choose an application window',detail:kind==='screen'?'Use the display you calibrated for gaze alignment.':'Window recordings require manual alignment in replay. Full display is recommended.',buttons:[...choices.map(x=>x.label),'Cancel'],cancelId:choices.length,defaultId:0,noLink:true});
   const picked=choices[response];if(!picked){callback({});return}
   captureChoice={surface:kind==='screen'?'monitor':'window',name:picked.label,displayId:picked.d?.id??null,bounds:picked.d?.bounds??null};
   callback({video:picked.source});
  }catch(e){callback({});dialog.showErrorBox('Screen capture unavailable',String(e.message||e))}
 });
}
function openWindow(){
 win=new BrowserWindow({width:1440,height:960,minWidth:780,minHeight:600,title:'GazeLab Desktop',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false,preload:path.join(__dirname,'preload.cjs')}});
 win.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//.test(url))shell.openExternal(url).catch(()=>{});return {action:'deny'}});
 win.webContents.on('will-navigate',(e,url)=>{if(!trusted(url))e.preventDefault()});
 win.webContents.on('will-redirect',(e,url)=>{if(!trusted(url))e.preventDefault()});
 for(const e of ['focus','blur','minimize','restore','show','hide'])win.on(e,()=>{if(win&&!win.isDestroyed())win.webContents.send('gaze:window-state',windowState())});
 win.on('closed',()=>{closeOverlay();win=null});
 win.loadURL(origin+'/');
 win.webContents.on('did-finish-load',()=>win?.webContents.executeJavaScript(`document.title='GazeLab Desktop'; const b=document.createElement('div'); b.textContent='DESKTOP PREVIEW · background throttling disabled · camera/recordings stay local'; b.style.cssText='background:#173d37;color:white;padding:8px 16px;font:12px system-ui;text-align:center'; document.body.prepend(b);`).catch(()=>{}));
}
app.whenReady().then(async()=>{if(!gotLock)return;await serve();permissions(session.defaultSession);registerDesktop();blocker=powerSaveBlocker.start('prevent-app-suspension');openWindow();app.on('activate',()=>{if(!win)openWindow()})}).catch(e=>{dialog.showErrorBox('GazeLab could not start',e.message);app.quit()});
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{if(blocker!==undefined&&powerSaveBlocker.isStarted(blocker))powerSaveBlocker.stop(blocker);server?.close()});

function windowState(){return !win||win.isDestroyed()?'unfocused':win.isMinimized()||!win.isVisible()?'minimized':win.isFocused()?'foreground':'unfocused'}
function validSender(e){return win&&!win.isDestroyed()&&e.sender===win.webContents&&trusted(e.senderFrame?.url)}
function handler(name,fn){ipcMain.handle('gaze:'+name,async(e,...args)=>{if(!validSender(e))throw Error('Untrusted desktop request');return fn(...args)})}
function sessionRoot(){return path.join(app.getPath('documents'),'GazeLab Sessions')}
function sessionPath(id){if(typeof id!=='string'||!/^Session_[0-9T-]+_[a-f0-9]{8}$/.test(id))throw Error('Invalid session');return path.join(sessionRoot(),id)}
function closeOverlay(){clearTimeout(overlayTimer);if(overlay&&!overlay.isDestroyed())overlay.destroy();overlay=null;overlayDisplay=null}
function registerDesktop(){
 handler('state',windowState);
 handler('capture-preference',(kind,display)=>{capturePreference={kind:kind==='window'?'window':'screen',display:Number.isInteger(display)?display:null};captureChoice=null;return true});
 handler('capture-choice',()=>captureChoice);
 handler('metrics',()=>{const ms=app.getAppMetrics();return {cpu:ms.reduce((n,x)=>n+(x.cpu?.percentCPUUsage||0),0),memoryMB:ms.reduce((n,x)=>n+(x.memory?.workingSetSize||0),0)/1024,processes:ms.length}});
 handler('begin-session',async()=>{const id='Session_'+new Date().toISOString().replace(/[:.Z]/g,'-')+'_'+require('node:crypto').randomBytes(4).toString('hex');const dir=sessionPath(id);await fs.promises.mkdir(sessionRoot(),{recursive:true});await fs.promises.mkdir(dir);activeSessions.set(id,{files:new Set()});return {id,path:dir}});
 handler('save-chunk',async(id,name,bytes,first)=>{const entry=activeSessions.get(id);if(!entry||typeof name!=='string'||!/^(screen|webcam|combined|gaze_overlay|gaze_data|session|calibration)\.(webm|mp4|csv|json)$/.test(name)||!(bytes instanceof Uint8Array)&&!(bytes instanceof ArrayBuffer)||bytes.byteLength>8*1024*1024)throw Error('Invalid session file');const file=path.join(sessionPath(id),name);const buffer=Buffer.from(bytes);if(first){if(entry.files.has(name))throw Error('File already exists');await fs.promises.writeFile(file,buffer,{flag:'wx'});entry.files.add(name)}else{if(!entry.files.has(name))throw Error('Missing initial chunk');await fs.promises.appendFile(file,buffer)}return true});
 handler('finish-session',async(id,manifest)=>{const entry=activeSessions.get(id);if(!entry)throw Error('Unknown session');const content=JSON.stringify({createdAt:new Date().toISOString(),files:[...entry.files],summary:manifest},null,2);if(content.length>100000)throw Error('Manifest too large');await fs.promises.writeFile(path.join(sessionPath(id),'manifest.json'),content,{flag:'wx'});activeSessions.delete(id);return sessionPath(id)});
 handler('list-sessions',async()=>{await fs.promises.mkdir(sessionRoot(),{recursive:true});const dirs=await fs.promises.readdir(sessionRoot(),{withFileTypes:true});return dirs.filter(d=>d.isDirectory()&&/^Session_[0-9T-]+_[a-f0-9]{8}$/.test(d.name)).map(d=>d.name).sort().reverse().slice(0,100)});
 handler('open-session',async id=>{const dir=id?sessionPath(id):sessionRoot();await fs.promises.mkdir(sessionRoot(),{recursive:true});const error=await shell.openPath(dir);if(error)throw Error(error)});
 handler('calibration-display',()=>screen.getDisplayMatching(win.getBounds()).id);
 handler('overlay-enable',enabled=>{closeOverlay();if(!enabled)return false;overlay=new BrowserWindow({width:44,height:44,frame:false,transparent:true,hasShadow:false,alwaysOnTop:true,focusable:false,skipTaskbar:true,resizable:false,movable:false,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});overlay.setIgnoreMouseEvents(true);overlay.setAlwaysOnTop(true,'floating');if(process.platform==='darwin')overlay.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});overlay.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><style>html,body{margin:0;background:transparent;overflow:hidden}i{position:absolute;inset:7px;border:3px solid #ff395e;border-radius:50%;background:#ff395e35;box-shadow:0 0 0 2px white}</style><i></i>'));return true});
 ipcMain.on('gaze:overlay-point',(e,p)=>{if(!validSender(e)||!overlay||overlay.isDestroyed())return;clearTimeout(overlayTimer);if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1){overlay.hide();return}const d=screen.getAllDisplays().find(d=>d.id===p.display);if(!d){overlay.hide();return}const b=d.bounds;overlay.setPosition(Math.round(b.x+p.x*b.width-22),Math.round(b.y+p.y*b.height-22),false);if(!overlay.isVisible())overlay.showInactive();overlayTimer=setTimeout(()=>{if(overlay&&!overlay.isDestroyed())overlay.hide()},350)});
}
