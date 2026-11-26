const {app,BrowserWindow,session,desktopCapturer,dialog,shell,powerSaveBlocker,systemPreferences}=require('electron');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
let win,server,origin,blocker; const gotLock=app.requestSingleInstanceLock(); if(!gotLock){app.quit();}
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
   const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:0,height:0}});
   const choices=sources.slice(0,40);if(!choices.length){callback({});return}
   const {response}=await dialog.showMessageBox(win,{type:'question',title:'Choose what to record',message:'Choose a screen or window to record locally',detail:'Nothing is captured until you select a source. Use the calibrated display for aligned gaze.',buttons:[...choices.map((x,i)=>(i+1)+'. '+x.name.slice(0,100)),'Cancel'],cancelId:choices.length,defaultId:choices.length,noLink:true});
   callback(response<choices.length?{video:choices[response]}:{});
  }catch(e){callback({});dialog.showErrorBox('Screen capture unavailable',String(e.message||e))}
 });
}
function openWindow(){
 win=new BrowserWindow({width:1440,height:960,minWidth:780,minHeight:600,title:'GazeLab Desktop',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 win.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//.test(url))shell.openExternal(url).catch(()=>{});return {action:'deny'}});
 win.webContents.on('will-navigate',(e,url)=>{if(!trusted(url))e.preventDefault()});
 win.webContents.on('will-redirect',(e,url)=>{if(!trusted(url))e.preventDefault()});
 win.on('closed',()=>{win=null});
 win.loadURL(origin+'/');
 win.webContents.on('did-finish-load',()=>win?.webContents.executeJavaScript(`document.title='GazeLab Desktop'; const b=document.createElement('div'); b.textContent='DESKTOP PREVIEW · background throttling disabled · camera/recordings stay local'; b.style.cssText='background:#173d37;color:white;padding:8px 16px;font:12px system-ui;text-align:center'; document.body.prepend(b);`).catch(()=>{}));
}
app.whenReady().then(async()=>{if(!gotLock)return;await serve();permissions(session.defaultSession);blocker=powerSaveBlocker.start('prevent-app-suspension');openWindow();app.on('activate',()=>{if(!win)openWindow()})}).catch(e=>{dialog.showErrorBox('GazeLab could not start',e.message);app.quit()});
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{if(blocker!==undefined&&powerSaveBlocker.isStarted(blocker))powerSaveBlocker.stop(blocker);server?.close()});
