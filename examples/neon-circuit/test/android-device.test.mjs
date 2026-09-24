import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const encode=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const compile=p=>ts.transpileModule(readFileSync(new URL(p,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText;
const math=encode(compile('../../../bridge/motion/motion-sample.ts'));
const reading=encode(compile('../../../bridge/motion/android-reading.ts'));
const {androidMotionReading}=await import(reading);
const {createMotionSample}=await import(math);
const zero={x:0,y:0,z:0};
test('Android quaternion and acceleration normalize to gravity in g; both landscape directions steer correctly',()=>{
  const rest=androidMotionReading(1,[0,0,0,1],zero,{x:0,y:0,z:9.80665});
  assert.equal(rest.gravity.z,-1);assert.deepEqual(rest.userAcceleration,zero);
  for(const rotation of [90,270])for(const sign of [-1,1]){
    // Screen right is device +Y at ROTATION_90, device -Y at ROTATION_270.
    const angle=sign*(rotation===90?1:-1)*Math.PI/6;
    const raw=androidMotionReading(1,[Math.sin(angle/2),0,0,Math.cos(angle/2)],zero,zero);
    const sample=createMotionSample(raw,16,16,rotation);
    assert.ok(Math.abs(sample.tilt.right-sign*30)<1e-8);
  }
  assert.throws(()=>androidMotionReading(1,[0,0,0,0],zero,zero));
});
const handlers=new Map();let now=1000, callback, failAt=0, registered=[],unregistered=0;
const app={on:(e,f)=>{if(!handlers.has(e))handlers.set(e,new Set());handlers.get(e).add(f);},off:(e,f)=>handlers.get(e)?.delete(f),suspendEvent:'suspend',resumeEvent:'resume',exitEvent:'exit'};
const emit=e=>{for(const f of handlers.get(e)??[])f();};
const manager={getDefaultSensor:type=>({type}),registerListener:(listener,sensor,interval)=>{callback=listener;registered.push({sensor,interval});return registered.length!==failAt;},unregisterListener:()=>unregistered++};
let amplitude=true,hardware=true;const effects=[];
const vibrator={hasVibrator:()=>hardware,hasAmplitudeControl:()=>amplitude,vibrate:e=>effects.push(e),cancel:()=>effects.push('cancel')};
globalThis.__androidCore={Application:app,Utils:{android:{getApplicationContext:()=>({getSystemService:name=>name==='sensor'?manager:vibrator})}}};
globalThis.android={content:{Context:{SENSOR_SERVICE:'sensor',VIBRATOR_SERVICE:'vibrator'}},hardware:{Sensor:{TYPE_GAME_ROTATION_VECTOR:15,TYPE_ROTATION_VECTOR:11,TYPE_GYROSCOPE:4,TYPE_ACCELEROMETER:1},SensorEventListener:class{constructor(impl){Object.assign(this,impl);}}},os:{SystemClock:{elapsedRealtimeNanos:()=>now*1e6,uptimeMillis:()=>now},Build:{VERSION:{SDK_INT:34}},VibrationEffect:{DEFAULT_AMPLITUDE:-1,createOneShot:(duration,strength)=>({duration,strength})}}};
const core=encode('export const {Application,Utils}=globalThis.__androidCore;');
const source=compile('../../../bridge/motion/device-motion.android.ts').replace("'@nativescript/core'",`'${core}'`).replace("'./motion-sample'",`'${math}'`).replace("'./android-reading'",`'${reading}'`);
const {NativeDeviceMotion}=await import(encode(source));
const sensor=(type,stamp=now+10,values=type===1?[0,0,9.80665]:type===15?[0,0,0,1]:[0,0,0])=>callback.onSensorChanged({timestamp:stamp*1e6,values,sensor:{getType:()=>type}});
test('Android sensors register once, emit once per fresh sample, discard stale readings and cleanly resume/dispose',()=>{
  const motion=new NativeDeviceMotion({updateIntervalMs:20});const received=[];motion.onUpdate(s=>received.push(s));
  try{
    assert.throws(()=>new NativeDeviceMotion());assert.equal(motion.start(),true);motion.start();assert.equal(registered.length,3);assert.equal(registered[0].interval,20000);
    sensor(4);sensor(1);sensor(15);assert.equal(motion.update(16).sensorDeltaMs,0);assert.equal(motion.update(16),null);assert.equal(received.length,1);
    emit('suspend');assert.equal(motion.active,false);assert.equal(motion.latest,null);now=2000;emit('resume');sensor(4,1500);sensor(1,1500);sensor(15,1500);assert.equal(motion.update(16),null);
    sensor(4);sensor(1);sensor(15);assert.equal(motion.update(16).sensorDeltaMs,0);
    motion.setUpdateInterval(50);assert.equal(registered.at(-1).interval,50000);
    motion.stop();emit('resume');assert.equal(motion.active,false);
    assert.throws(()=>motion.update(NaN));assert.throws(()=>motion.setScreenRotation(45));
  }finally{motion.dispose();}
  assert.equal([...handlers.values()].reduce((n,s)=>n+s.size,0),0);assert.throws(()=>motion.start());
});
test('partial sensor registration failures unregister and cannot restart on resume',()=>{
  registered=[];failAt=2;const before=unregistered;const motion=new NativeDeviceMotion();
  try{assert.throws(()=>motion.start());assert.equal(unregistered,before+1);assert.equal(motion.active,false);emit('resume');assert.equal(registered.length,2);}finally{failAt=0;motion.dispose();}
});
const {NativeHaptics}=await import(encode(compile('../../../bridge/feedback/haptics.android.ts').replace("'@nativescript/core'",`'${core}'`)));
test('Android haptics throttle repeated cues, allow stronger impacts, degrade without amplitude control and cancel on suspend',()=>{
  const h=new NativeHaptics();h.impact('light');assert.equal(effects.length,0);h.resume();h.impact('light');h.impact('light');h.impact('heavy');assert.equal(h.snapshot().impactsRequested,2);assert.equal(effects[0].strength,55);assert.equal(effects[1].strength,210);
  now+=300;amplitude=false;h.impact('medium');assert.equal(effects.at(-1).strength,-1);h.suspend();const count=h.snapshot().impactsRequested;h.impact('heavy');assert.equal(h.snapshot().impactsRequested,count);
  h.resume();hardware=false;h.impact('heavy');assert.equal(h.snapshot().impactsRequested,count);h.dispose();h.resume();assert.equal(h.snapshot().active,false);
});
