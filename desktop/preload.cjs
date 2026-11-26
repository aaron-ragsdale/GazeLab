const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('gazeDesktop',{
 capturePreference:(kind,display)=>ipcRenderer.invoke('gaze:capture-preference',kind,display),
 captureChoice:()=>ipcRenderer.invoke('gaze:capture-choice'),
 state:()=>ipcRenderer.invoke('gaze:state'),
 onState:fn=>{const listener=(_,state)=>fn(state);ipcRenderer.on('gaze:window-state',listener);return()=>ipcRenderer.removeListener('gaze:window-state',listener)},
 metrics:()=>ipcRenderer.invoke('gaze:metrics'),
 beginSession:()=>ipcRenderer.invoke('gaze:begin-session'),
 saveChunk:(id,name,bytes,first)=>ipcRenderer.invoke('gaze:save-chunk',id,name,bytes,first),
 finishSession:(id,manifest)=>ipcRenderer.invoke('gaze:finish-session',id,manifest),
 listSessions:()=>ipcRenderer.invoke('gaze:list-sessions'),
 openSession:id=>ipcRenderer.invoke('gaze:open-session',id),
 overlayEnable:enabled=>ipcRenderer.invoke('gaze:overlay-enable',enabled),
 overlayPoint:point=>ipcRenderer.send('gaze:overlay-point',point),
 calibrationDisplay:()=>ipcRenderer.invoke('gaze:calibration-display')
});
