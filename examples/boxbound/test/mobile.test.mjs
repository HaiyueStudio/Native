import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {readFileSync} from 'node:fs';
registerHooks({resolve(s,c,n){return n(s.startsWith('.')&&!c.parentURL?.includes('/node_modules/')&&!/\.[a-z]+$/i.test(s)?`${s}.ts`:s,c);}});
const {stickDirection,createStick}=await import('../src/controls.ts');
const {installWorldMap,loadWorldMap}=await import('../../../../Games/games/boxbound/world-map.ts');
installWorldMap(await loadWorldMap(new URL('../../../../Games/games/boxbound/levels/index.json',import.meta.url),async u=>JSON.parse(readFileSync(u,'utf8'))));
const {MobileSession}=await import('../src/session.ts');const {createGame}=await import('../../../../Games/games/boxbound/levels.ts');const {validState,clone}=await import('../../../../Games/games/boxbound/model.ts');
function session(){const s=new MobileSession();s.scene={moving:false,transitioning:false,celebrating:false,airborne:false,home:true,show(){},cancelMotion(){this.airborne=false;},jumpInPlace(){this.airborne=true;}};s.load(createGame());return s;}
test('floating Engine joystick captures touch center, owns one finger and cleans up',()=>{
 const {target,joystick}=createStick(()=>({x:0,y:0,width:800,height:360}),()=>true);
 assert.equal(joystick.state.active,false);target.handle('down',[{id:4,x:120,y:240}]);assert.deepEqual(joystick.state.center,{x:120,y:240});assert.equal(joystick.state.strength,0);
 target.handle('move',[{id:4,x:125,y:248}]);assert.equal(joystick.state.strength,0);
 target.handle('move',[{id:4,x:320,y:390}]);assert(joystick.state.distance<=43);assert.equal(joystick.state.pointerId,4);
 target.handle('down',[{id:8,x:220,y:240}]);target.handle('up',[{id:8,x:220,y:240}]);assert.equal(joystick.state.pointerId,4);
 target.handle('up',[{id:4,x:320,y:390}]);assert.equal(joystick.state.active,false);
 target.handle('down',[{id:5,x:200,y:180}]);assert.deepEqual(joystick.state.center,{x:200,y:180});target.cancel();assert.equal(joystick.state.active,false);
 target.handle('down',[{id:6,x:700,y:200}]);assert.equal(joystick.state.active,false);target.cancel();
 joystick.destroy();target.dispose();assert.equal(target.snapshot().listenerCount,0);
});
test('grid snapping preserves cardinal hysteresis',()=>{assert.deepEqual(stickDirection(-.9,.1),[-1,0,0]);assert.deepEqual(stickDirection(.1,-.9),[0,0,-1]);assert.deepEqual(stickDirection(.6,.64,[1,0,0]),[1,0,0]);assert.deepEqual(stickDirection(.7,.6,[0,0,1]),[0,0,1]);});
test('held stick repeats moves and release cancels future movement',()=>{const s=session();s.setDirection([0,0,-1]);s.tick(200);s.tick(400);assert.equal(s.state.moves,2);s.setDirection(null);s.tick(600);assert.equal(s.state.moves,2);assert(validState(s.state));});
test('jump combines with direction; canceled input cannot survive suspension',()=>{const s=session();s.setDirection([1,0,0]);s.jump();assert(s.scene.airborne);assert(s.state.moves>0);s.cancel();s.paused=true;const before=clone(s.state);s.tick(1000);assert.deepEqual(s.state,before);assert.equal(s.held,null);});
test('undo waits for landing and then restores full state',()=>{const s=session(),before=clone(s.state);s.act({type:'move',dir:[0,0,-1]});s.scene.moving=true;s.undo();assert.notDeepEqual(s.state.player,before.player);s.tick(400);assert.equal(s.history.length,1);s.scene.moving=false;s.tick(600);assert.deepEqual(s.state.player,before.player);assert.equal(s.state.moves,0);});
test('exiting a level preserves progress and moved puzzle objects',()=>{const s=session(),g=s.state.boxes.find(b=>b.id==='pp-gateway-1');s.state.player={room:g.inside,pos:[...s.state.rooms[g.inside].spawn],facing:[0,0,-1],route:[{box:'pp-museum',from:'world',entry:[8,0,3]},{box:'pp-chapter-intro',from:'pp-hub',entry:[3,0,6]},{box:g.id,from:g.room,entry:[g.pos[0],0,g.pos[2]+1]}]};s.state.completed=[1];const boxes=clone(s.state.boxes);s.exit();assert.equal(s.state.player.room,g.room);assert.deepEqual(s.state.boxes,boxes);assert.deepEqual(s.state.completed,[1]);assert(validState(s.state));});
test('Android compatibility methods preserve reversal without mutating input',async()=>{
 const reverse=Object.getOwnPropertyDescriptor(Array.prototype,'toReversed'),find=Object.getOwnPropertyDescriptor(Array.prototype,'findLastIndex');
 try{delete Array.prototype.toReversed;delete Array.prototype.findLastIndex;const {installGameRuntime}=await import('../src/runtime.ts');installGameRuntime();const a=[1,2,1];assert.deepEqual(a.toReversed(),[1,2,1]);assert.equal(a.findLastIndex(v=>v===1),2);const b=[1,2,3];assert.deepEqual(b.toReversed(),[3,2,1]);assert.deepEqual(b,[1,2,3]);}
 finally{if(reverse)Object.defineProperty(Array.prototype,'toReversed',reverse);if(find)Object.defineProperty(Array.prototype,'findLastIndex',find);}
});

test('jump with held stick climbs onto a box without pushing it',()=>{const s=session();const box=clone(s.state.boxes.find(b=>b.id==='island-weight'));s.state.player.pos=[box.pos[0],0,box.pos[2]+1];s.setDirection([0,0,-1]);s.jump();assert.deepEqual(s.state.player.pos,[box.pos[0],1,box.pos[2]]);assert.deepEqual(s.state.boxes.find(b=>b.id===box.id),box);assert.equal(s.history.at(-1).jump,true);});

test('holding against an obstacle does not rebuild the scene or repaint each frame',()=>{
 const s=session();s.state.player.pos=[0,0,0];let draws=0,updates=0,saves=0;
 s.scene.show=()=>draws++;s.changed=()=>updates++;s.save=()=>saves++;
 s.setDirection([-1,0,0]);s.tick(1);assert.equal(s.state.moves,0);assert.equal(s.state.message,'');
 const blocked=s.state,notifications=updates;for(let i=2;i<300;i++)s.tick(i*20);
 assert.equal(s.state,blocked);assert.equal(draws,0);assert.equal(updates,notifications);assert.equal(saves,0);
 s.setDirection(null);s.setDirection([0,0,1]);s.tick(6001);assert.notEqual(s.state,blocked);
});
test('new direction is sampled on the next frame without the repeat cooldown',()=>{
 const s=session();s.setDirection([0,0,-1]);s.tick(1);assert.equal(s.state.moves,1);
 s.setDirection([1,0,0]);s.tick(2);assert.equal(s.state.moves,2);
 s.scene.moving=true;s.setDirection([0,0,-1]);s.tick(3);s.setDirection(null);s.scene.moving=false;s.tick(500);assert.equal(s.state.moves,2);
});
test('only completion writes an automatic checkpoint, outside the finished puzzle',()=>{
 const s=session(),saved=[];s.save=state=>saved.push(clone(state));
 s.act({type:'move',dir:[0,0,-1]});s.undo();assert.equal(saved.length,0);
 const gate=s.state.boxes.find(b=>b.id==='pp-gateway-1');
 s.state.player={room:gate.inside,pos:[...s.state.rooms[gate.inside].spawn],facing:[0,0,-1],route:[{box:'pp-museum',from:'world',entry:[8,0,3]},{box:'pp-chapter-intro',from:'pp-hub',entry:[3,0,6]},{box:gate.id,from:gate.room,entry:[gate.pos[0],0,gate.pos[2]+1]}]};
 s.reset();assert.equal(saved.length,0);
 for(const key of 'wwdddsswwwaaaa')s.act({type:'move',dir:({w:[0,0,-1],s:[0,0,1],a:[-1,0,0],d:[1,0,0]})[key]});
 assert(s.state.completed.includes(11));s.tick(10000);
 assert.equal(saved.length,1);assert.equal(saved[0].player.room,'pp-intro');assert(saved[0].completed.includes(11));assert(validState(saved[0]));
 s.tick(10100);assert.equal(saved.length,1);
});
test('blocked input can sleep and a changed direction wakes the host',()=>{
 const s=session();let wakes=0;s.wake=()=>wakes++;s.state.player.pos=[0,0,0];s.setDirection([-1,0,0]);assert(s.needsTick);s.tick(1);assert.equal(s.needsTick,false);const count=wakes;s.setDirection([0,0,1]);assert(wakes>count);assert(s.needsTick);s.cancel();assert.equal(s.needsTick,false);
});
test('fast state snapshots detach every mutable nested gameplay field',async()=>{
 const {copyState}=await import('../../../../Games/games/boxbound/model.ts');const s=createGame();s.player.route=[{box:'pp-museum',from:'world',entry:[8,0,3]}];const before=clone(s);const next=copyState(s);
 next.boxes[0].pos[0]++;next.boxes[0].inside='world';next.player.pos[0]++;next.player.facing[2]=1;next.player.route[0].entry[0]++;next.completed.push(1);
 assert.deepEqual(s,before);assert.equal(next.rooms,s.rooms);
});

test('mirrored stick and buffered movement stay screen-relative and undo restores orientation',()=>{
 const s=session();s.state.player.mirrored=true;const x=s.state.player.pos[0];
 s.setDirection([1,0,0]);s.tick(200);assert.equal(s.state.player.pos[0],x-1);
 s.cancel();s.undo();assert.equal(s.state.player.pos[0],x);assert.equal(s.state.player.mirrored,true);
 s.scene.moving=true;s.act({type:'move',dir:[1,0,0],jump:true});
 s.state.player.mirrored=false;s.scene.moving=false;s.tick(400);
 assert.equal(s.state.player.pos[0],x+1); // resolve orientation when dequeued, not when buffered
});
