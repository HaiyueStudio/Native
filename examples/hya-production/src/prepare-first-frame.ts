import type {HyaPlayer,HyaFrameRequest,HyaFrame} from '@haiyue/extensions/hya-player';

/** Startup resource barrier only. It never samples a timeline or activates a renderer. */
export async function prepareFirstHyaFrame(player:HyaPlayer,request:HyaFrameRequest,signal:AbortSignal,timeoutMs=30000):Promise<HyaFrame> {
  if(request.deltaSeconds!==0||!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new RangeError('Initial HYA preparation requires zero delta and a finite positive deadline.');
  const fixed=Object.freeze({...request,viewport:Object.freeze([...request.viewport]) as HyaFrameRequest['viewport']}),until=Date.now()+timeoutMs;
  for(;;){
    if(signal.aborted){const error=new Error('Initial HYA frame preparation cancelled.');error.name='AbortError';throw error;}
    const frame=player.advance(fixed);if(frame.ready)return frame;
    if(Date.now()>=until)throw new Error('Required HYA resources did not prepare the initial draw frame before the startup deadline.');
    await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
}
