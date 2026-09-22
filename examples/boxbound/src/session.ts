import {viewAction} from '../../../../Games/games/boxbound/model';
import {createGame,advanceGame,resetLevel} from '../../../../Games/games/boxbound/levels';
import {canJump,reverseTransfers,type State,type Action,type Vec} from '../../../../Games/games/boxbound/model';
import {remember,type UndoEntry} from '../../../../Games/games/boxbound/history';
import {finishedLevel,returnFromCompletedLevel} from '../../../../Games/games/boxbound/completion';
import {soundCues,type SoundCue} from '../../../../Games/games/boxbound/sound-events';
import type {BoxboundScene} from '../../../../Games/games/boxbound/scene';
export class MobileSession {
  state:State=createGame(); history:UndoEntry[]=[]; home=true; paused=false; held:Vec|null=null;
  scene!:BoxboundScene; changed:()=>void=()=>{}; save:(state:State)=>void=()=>{}; audio:(cues:SoundCue[])=>void=()=>{};
  private pending:Action|'hop'|null=null;private pendingUndo=false;private completion:number|null=null;private lastStep=-Infinity;private blocked:{state:State;key:string}|null=null;
  wake:()=>void=()=>{};
  get needsTick(){return !this.home&&!this.paused&&!!(this.pending||this.pendingUndo||this.completion!==null||(this.held&&this.blocked?.state!==this.state));}
  load(state:State){this.cancel();this.state=state;this.history=[];this.home=false;this.completion=finishedLevel(state);this.scene.home=false;this.scene.cancelMotion();this.scene.show(state);this.changed();}
  cancel(){this.blocked=null;this.held=null;this.pending=null;this.pendingUndo=false;}
  setDirection(dir:Vec|null){if(dir?.join()!==this.held?.join()){this.blocked=null;this.lastStep=-Infinity;this.wake();}this.held=dir;}
  act(action:Action){
    this.wake();
    if(this.home||this.paused)return;
    if(this.scene.moving||this.scene.transitioning||this.scene.celebrating){if(action.type!=='move'||action.jump)this.pending=action;return;}
    const before=this.state,result=advanceGame(before,viewAction(before,action));this.state=result.state;
    if(!result.changed){
      if(action.type==='move')this.blocked={state:this.state,key:action.dir.join()+':'+!!action.jump};
      // Facing and useful NPC/rule messages may change, but no geometry moved.
      if(before.message!==this.state.message)this.changed();
      return;
    }
    this.blocked=null;
    if(result.changed){remember(this.history,before,action.type==='move'&&!!action.jump,result.transfers,false,result.playerCrossing);this.audio(soundCues(before,this.state,action,result.recoil,this.scene.airborne,result.playerCrossing));
      const level=finishedLevel(this.state);if(level!==null&&level!==finishedLevel(before)){this.completion=level;this.cancel();}
    }
    this.scene.show(this.state,before,result.changed&&action.type==='move'&&!!action.jump,result.transfers,false,false,result.recoil,result.playerCrossing);this.changed();
  }
  jump(){if(this.home||this.paused||this.scene.airborne||this.scene.celebrating||this.scene.transitioning||!canJump(this.state))return;
    if(this.scene.moving){this.pending=this.held?{type:'move',dir:[...this.held],jump:true}:'hop';return;}
    this.wake();this.scene.jumpInPlace();this.audio([{name:'jump',delay:0}]);if(this.held)this.act({type:'move',dir:[...this.held],jump:true});
  }
  exit(){this.cancel();this.completion=null;if(this.state.rooms[this.state.player.room]!.level)this.act({type:'exit-level'});else if(this.state.player.route.length)this.act({type:'leave'});}
  undo(){if(!this.history.length||this.home||this.paused)return;this.cancel();this.completion=null;if(this.scene.moving||this.scene.transitioning){this.pendingUndo=true;return;}this.performUndo();}
  private performUndo(){const entry=this.history.pop();if(!entry)return;const before=this.state;this.state=entry.state;this.state.message='已撤销上一步。';this.scene.cancelMotion();this.scene.show(this.state,before,entry.jump,reverseTransfers(entry.transfers),true,!!entry.reset,undefined,entry.playerCrossing?{...entry.playerCrossing,entering:!entry.playerCrossing.entering}:undefined);this.changed();}
  reset(){if(this.home||!this.state.rooms[this.state.player.room]!.level)return;this.cancel();this.completion=null;remember(this.history,this.state,false,[],true);this.state=resetLevel(this.state);this.scene.cancelMotion();this.scene.show(this.state);this.changed();}
  tick(now:number){if(this.home||this.paused)return;
    if(this.pendingUndo&&!this.scene.moving&&!this.scene.transitioning){this.pendingUndo=false;this.performUndo();return;}
    if(this.scene.moving||this.scene.transitioning||this.scene.celebrating)return;
    if(this.pending){const action=this.pending;this.pending=null;if(action==='hop')this.jump();else this.act(action);return;}
    if(this.completion!==null){const next=returnFromCompletedLevel(this.state,this.completion);this.completion=null;if(next){const before=this.state;this.state=next;this.cancel();this.scene.show(next,before);this.save(next);this.changed();return;}}
    if(this.held&&this.blocked?.state===this.state&&this.blocked.key===this.held.join()+':'+this.scene.airborne)return;
    if(this.held&&now-this.lastStep>=165){this.lastStep=now;this.act({type:'move',dir:[...this.held],jump:this.scene.airborne});}
  }
}
