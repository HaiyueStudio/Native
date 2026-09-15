/** Bounded CPU/frame-interval samples. CPU includes command encoding and present,
 * not GPU execution; frame intervals include scheduling and GPU back-pressure. */
export class FramePerformance {
  private readonly maxSamples=600;
  private cpu:number[]=[];
  private intervals:number[]=[];
  private lastStart:number|null=null;
  private started=0;
  begin(now:number):void {
    if(this.lastStart!==null && this.intervals.length<this.maxSamples)this.intervals.push(now-this.lastStart);
    this.lastStart=now;this.started=now;
  }
  end(now:number):void {if(this.cpu.length<this.maxSamples)this.cpu.push(now-this.started);}
  reset():void {this.cpu=[];this.intervals=[];this.lastStart=null;}
  take() {
    const stats=(a:number[])=>{const sorted=[...a].sort((a,b)=>a-b);return {samples:a.length,meanMs:a.reduce((s,v)=>s+v,0)/Math.max(1,a.length),p95Ms:sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)]??0};};
    const result={cpu:stats(this.cpu),interval:stats(this.intervals)};
    this.cpu=[];this.intervals=[];return result;
  }
}
