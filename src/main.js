
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,0.1,1000);
camera.position.z=90;
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),1.6,0.5,0.8));

const count=15000;
const positions=new Float32Array(count*3);
const targets=[];
for(let i=0;i<count;i++){
 const r=25*Math.cbrt(Math.random());
 const t=Math.random()*Math.PI*2;
 const p=Math.acos(2*Math.random()-1);
 const x=r*Math.sin(p)*Math.cos(t), y=r*Math.sin(p)*Math.sin(t), z=r*Math.cos(p);
 targets.push(new THREE.Vector3(x,y,z));
 positions[i*3]=x; positions[i*3+1]=y; positions[i*3+2]=z;
}
const geo=new THREE.BufferGeometry();
geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
const pts=new THREE.Points(geo,new THREE.PointsMaterial({size:0.25,color:0x88ccff}));
scene.add(pts);

let scatter=0,targetX=0,targetY=0,targetScale=1;

(async()=>{
 const video=document.getElementById('video');
 try{
  video.srcObject=await navigator.mediaDevices.getUserMedia({video:true});
  const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
  const hand=await HandLandmarker.createFromOptions(vision,{
   baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'},
   runningMode:'VIDEO',numHands:1
  });
  const detect=()=>{
   const r=hand.detectForVideo(video,performance.now());
   if(r.landmarks.length){
    const lm=r.landmarks[0];
    scatter=Math.hypot(lm[8].x-lm[20].x,lm[8].y-lm[20].y)>0.25?120:0;
    targetX=(lm[0].x-0.5)*120;
    targetY=-(lm[0].y-0.5)*70;
    targetScale=1+(0.2-lm[0].z)*2.5;
   }
   requestAnimationFrame(detect);
  };
  detect();
 }catch(e){console.error(e)}
})();

function animate(){
 requestAnimationFrame(animate);
 const a=geo.attributes.position.array;
 for(let i=0;i<count;i++){
  const tx=targets[i].x+(Math.random()-0.5)*scatter;
  const ty=targets[i].y+(Math.random()-0.5)*scatter;
  const tz=targets[i].z+(Math.random()-0.5)*scatter;
  a[i*3]+=(tx-a[i*3])*0.03;
  a[i*3+1]+=(ty-a[i*3+1])*0.03;
  a[i*3+2]+=(tz-a[i*3+2])*0.03;
 }
 geo.attributes.position.needsUpdate=true;
 pts.position.x+=(targetX-pts.position.x)*0.08;
 pts.position.y+=(targetY-pts.position.y)*0.08;
 pts.scale.lerp(new THREE.Vector3(targetScale,targetScale,targetScale),0.05);
 pts.rotation.y+=0.001;
 composer.render();
}
animate();
