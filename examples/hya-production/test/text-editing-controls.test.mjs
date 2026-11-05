import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {GuiInput} from '@haiyue/engine/gui';
const js=ts.transpileModule(readFileSync(new URL('../src/text-editing-controls.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("'@haiyue/engine/gui'",JSON.stringify(import.meta.resolve('@haiyue/engine/gui')));
const {createTextEditingControls}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
function setup() {
  const field=new GuiInput({value:'你好 A'}),events=[];let request,owner;
  const focus={focused:field,blur(){events.push({type:'blur',value:field.value,composing:field.isComposing});this.focused=null;}};
  owner={focus};const session={close(){},setSelection(){},setCaretRect(){}};
  const controls=createTextEditingControls({open(value){request=value;return session;}},()=>owner,()=>events.push({type:'frame'}));
  return {field,focus,events,controls,session,get request(){return request;},dispose(){owner=null;}};
}
test('Cancel discards only unfinished composition before GUI blur; Done delegates finishing to the focus owner',()=>{
  for(const cancel of [false,true]) {
    const h=setup();h.field.setSelection(2,2);h.field.beginComposition();h.field.updateComposition('ni',[2,2]);
    h.controls.dismiss(cancel);
    assert.deepEqual(h.events,[{type:'blur',value:'你好 A',composing:!cancel},{type:'frame'}]);
    assert.equal(h.field.value,'你好 A');assert.equal(h.focus.focused,null);
  }
});
test('keyboard submit forwards once then dismisses, while other commands and an onSubmit focus change remain intact',()=>{
  const h=setup(),commands=[];
  assert.equal(h.controls.host.open({onCommand:command=>commands.push(command)}),h.session);
  h.request.onCommand('undo');assert.deepEqual(commands,['undo']);assert.equal(h.events.length,0);
  h.request.onCommand('submit');assert.deepEqual(commands,['undo','submit']);assert.equal(h.events.filter(e=>e.type==='blur').length,1);
  const moved=setup(),next=new GuiInput({value:'next'});
  moved.controls.host.open({onCommand(){moved.focus.focused=next;}});moved.request.onCommand('submit');
  assert.equal(moved.focus.focused,next);assert.equal(moved.events.length,0);
});
test('dismiss after scene disposal is inert and does not retain a GUI focus owner',()=>{
  const h=setup();h.dispose();h.controls.dismiss();h.controls.dismiss(true);assert.deepEqual(h.events,[]);
});
