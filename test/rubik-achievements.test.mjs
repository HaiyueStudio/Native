import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTS } from './support/load-ts.mjs';
const { CubeSession } = loadTS('games/rubiks-cube/session.ts');
const { inverse } = loadTS('games/rubiks-cube/model.ts');
function settle(session) { let frames = 0; while (session.busy && frames++ < 2000) session.update(.05); assert.equal(session.busy, false); }
test('only a completed shuffle followed by manual solving earns a solve; each round earns once', () => {
  for (const kind of ['2', '3', '4', 'mirror']) {
    const solves = [], s = new CubeSession(kind, result => solves.push(result));
    s.turn({ axis: 0, layer: 0, direction: 1 }); settle(s); s.turn({ axis: 0, layer: 0, direction: -1 }); settle(s); assert.equal(solves.length, 0);
    s.shuffle(42); settle(s);
    const solution = s.model.history.slice().reverse().map(inverse);
    for (const move of solution) { s.turn(move); settle(s); }
    assert.equal(s.model.solved, true); assert.equal(solves.length, 1); assert.equal(solves[0].kind, kind); assert.ok(solves[0].seconds > 0);
    s.turn({ axis: 0, layer: 0, direction: 1 }); settle(s); s.turn({ axis: 0, layer: 0, direction: -1 }); settle(s); assert.equal(solves.length, 1);
  }
});
test('restore, undo or stopped shuffle invalidates the achievement round', () => {
  for (const action of ['restore', 'undo', 'stop']) {
    let wins = 0; const s = new CubeSession('3', () => wins++); s.shuffle(42); if (action !== 'stop') settle(s);
    s[action](); settle(s);
    for (const move of s.model.history.slice().reverse().map(inverse)) { s.turn(move); settle(s); }
    assert.equal(wins, 0);
  }
});
