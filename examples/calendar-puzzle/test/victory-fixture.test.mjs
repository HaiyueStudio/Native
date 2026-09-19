import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CALENDAR_BOARD_CELLS, CALENDAR_PIECES, normalizeCalendarCells} from '../../../../Games/games/calendar-puzzle/model.ts';

test('victory fixture is an exact legal tiling of February 28, 2024',()=>{
  const solution=JSON.parse(readFileSync(new URL('../src/victory-fixture.json',import.meta.url),'utf8'));
  const target=new Set(['m2','d28','w3']);
  const remaining=new Set(CALENDAR_BOARD_CELLS.filter(c=>!target.has(c.key)).map(c=>`${c.col},${c.row}`));
  assert.equal(solution.length,10);
  solution.forEach((p,i)=>{
    let cells=CALENDAR_PIECES[i].cells.map(c=>({x:p.flipped?-c.x:c.x,y:c.y}));
    for(let r=0;r<p.rotation;r++)cells=cells.map(c=>({x:c.y,y:-c.x}));
    for(const c of normalizeCalendarCells(cells))assert.equal(remaining.delete(`${p.col+c.x},${p.row+c.y}`),true);
  });
  assert.equal(remaining.size,0);
});
