import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/steering.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } }).outputText;
const { TiltSteering, landscapeMotionRotation } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const motionSource = ts.transpileModule(readFileSync(new URL('../../../bridge/motion/motion-sample.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } }).outputText;
const { createMotionSample } = await import(`data:text/javascript;base64,${Buffer.from(motionSource).toString('base64')}`);

test('both UIKit landscape orientations map a lowered right edge to right steering', () => {
  for (const [orientation, deviceY] of [['left',1],['right',-1]]) {
    for (const direction of [-1,1]) {
      const tilt = new TiltSteering(); tilt.update(0,16);
      const raw = { timestamp:1, attitude:{pitch:0,roll:0,yaw:0,quaternion:{x:0,y:0,z:0,w:1}},
        rotationRate:{x:0,y:0,z:0}, userAcceleration:{x:0,y:0,z:0},
        gravity:{x:0,y:deviceY*direction*0.5,z:-Math.sqrt(0.75)} };
      const sample = createMotionSample(raw,16,16,landscapeMotionRotation(orientation));
      for (let i=0;i<120;i++) tilt.update(sample.tilt.right,1000/60);
      assert.ok(tilt.axis*direction < -0.99, `${orientation}, tilt ${direction}`);
    }
  }
});

test('handheld position calibrates to neutral and hand tremor does not steer', () => {
  const tilt = new TiltSteering();
  assert.equal(tilt.update(35, 16), 0);
  for (const angle of [34,36,35,33,37]) assert.equal(tilt.update(angle,16),0);
});
test('screen-right tilt turns right, screen-left turns left, and output is bounded', () => {
  for (const side of [-1,1]) {
    const tilt = new TiltSteering(); tilt.update(12,16);
    for (let i=0;i<120;i++) tilt.update(12+side*60,1000/60);
    assert.ok(Math.abs(tilt.axis+side)<1e-8);
    assert.ok(Math.abs(tilt.axis)<=1);
  }
});
test('smoothing agrees at 30/60/120 Hz and resume recalibrates without a steering jump', () => {
  const axes=[30,60,120].map(rate=>{
    const tilt=new TiltSteering();tilt.update(-15,0);
    for(let i=0;i<rate;i++)tilt.update(-3,1000/rate);
    const axis=tilt.axis; tilt.reset(); assert.equal(tilt.axis,0); assert.equal(tilt.update(45,16),0); return axis;
  });
  assert.ok(axes.every(axis=>Math.abs(axis-axes[0])<1e-10));
});
test('invalid sensor data never propagates a NaN into racing physics', () => {
  const tilt=new TiltSteering();tilt.update(0,16);tilt.update(10,16);
  const value=tilt.axis;assert.equal(tilt.update(NaN,16),value);assert.equal(tilt.update(Infinity,16),value);
});
