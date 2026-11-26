// Classic worker permits the MediaPipe 0.10.21 WASM loader's importScripts.
// No camera data leaves this device.
let model,reader,active=false,paused=false,previous=-1,canvas,ctx,mode='none',generation=0;
const clock=()=>performance.timeOrigin+performance.now();
const send=(type,data={})=>postMessage({type,...data});
async function init(){
  send('progress',{text:'Loading MediaPipe in worker…',step:1});
  const {FaceLandmarker,FilesetResolver}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/+esm');
  send('progress',{text:'Loading worker WebAssembly…',step:2});
  const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
  send('progress',{text:'Loading face model in worker…',step:3});
  model=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numFaces:1,canvas:new OffscreenCanvas(1,1)});
  send('ready',{trackProcessor:typeof MediaStreamTrackProcessor==='function'});
}
function detect(frame,stamp){
  const started=clock();
  try{
    if(paused||!active)return;
    let w=frame.displayWidth||frame.width,h=frame.displayHeight||frame.height;
    if(!canvas||canvas.width!==w||canvas.height!==h){canvas=new OffscreenCanvas(w,h);ctx=canvas.getContext('2d')}
    ctx.drawImage(frame,0,0,w,h);
    let t=Math.max(previous+.01,stamp-performance.timeOrigin);previous=t;
    const p=model.detectForVideo(canvas,t).faceLandmarks[0]||null;
    send('result',{p,stamp,inference_ms:clock()-started,width:w,height:h,mode});
  }catch(e){send('frameError',{message:e.message||String(e)})}
  finally{frame.close?.();if(mode==='bitmap')send('frameDone')}
}
async function consume(readable,id){
  let r=readable.getReader();reader=r;
  try{while(active&&generation===id){let {done,value}=await r.read();if(done)break;if(!active||generation!==id){value?.close();break}detect(value,clock())}}
  catch(e){if(active&&generation===id)send('streamError',{message:e.message||String(e)})}
  finally{try{r.releaseLock()}catch{}if(reader===r)reader=null;if(active&&generation===id)send('streamEnded')}
}
self.onmessage=async({data:m})=>{
  try{
    if(m.type==='init'){await init();return}
    if(m.type==='stream'||m.type==='track'||m.type==='bitmapMode'){
      generation++;active=true;paused=false;previous=-1;mode=m.type==='bitmapMode'?'bitmap':'track';
      if(m.type==='track'){if(typeof MediaStreamTrackProcessor!=='function')throw Error('Worker track processor unavailable');let processor=new MediaStreamTrackProcessor({track:m.track,maxBufferSize:1});send('streamReady');consume(processor.readable,generation)}
      else if(m.type==='stream'){send('streamReady');consume(m.readable,generation)}
      else send('streamReady');
    }else if(m.type==='frame'){detect(m.frame,m.stamp)}
    else if(m.type==='pause'){paused=!!m.value}
    else if(m.type==='stop'){active=false;generation++;try{await reader?.cancel()}catch{}}
  }catch(e){send(m.type==='init'?'initError':'streamError',{message:e.message||String(e)})}
};
