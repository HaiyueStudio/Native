#include "../native/HyaPcmBridge.hpp"
#include <cstdlib>
#include <chrono>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <new>
#include <stdexcept>
#include <thread>
#include <vector>

static thread_local bool inRender = false;
static std::atomic<std::size_t> renderNew{0},renderDelete{0};
void* operator new(std::size_t size) {if(inRender)renderNew.fetch_add(1);if(void* p=std::malloc(size?size:1))return p;throw std::bad_alloc();}
void* operator new[](std::size_t size) {return ::operator new(size);}
void operator delete(void* p) noexcept {if(inRender&&p)renderDelete.fetch_add(1);std::free(p);}
void operator delete[](void* p) noexcept {::operator delete(p);}
void operator delete(void* p,std::size_t) noexcept {::operator delete(p);}
void operator delete[](void* p,std::size_t) noexcept {::operator delete(p);}
using Mixer=haiyue::audio::PcmMixer;
using Bridge=haiyue::audio::PcmBridge;
using Result=Bridge::Result;
static std::size_t passed=0,renderCalls=0;
static void check(bool value,const char* message){if(!value)throw std::runtime_error(message);}
static void ok(Result value){check(value==Result::ok,"bridge command rejected");}
static void render(Bridge& bridge,float* out,std::size_t frames){inRender=true;const bool result=bridge.render(out,frames);inRender=false;check(result,"bridge render rejected");++renderCalls;}
static void done(const char* name){++passed;std::cout<<"PASS "<<name<<'\n';}
struct Owner {
  std::array<float,1024> pcm{};std::atomic<std::size_t>* destroyed=nullptr;std::atomic<std::size_t>* wrongThread=nullptr;std::thread::id producer;
  Owner(std::atomic<std::size_t>* ended=nullptr,std::atomic<std::size_t>* wrong=nullptr):destroyed(ended),wrongThread(wrong),producer(std::this_thread::get_id()){for(std::size_t i=0;i<pcm.size();++i)pcm[i]=static_cast<float>((static_cast<double>(i)+32)/2048);}
  ~Owner(){if(wrongThread&&producer!=std::this_thread::get_id())wrongThread->fetch_add(1);if(destroyed)destroyed->fetch_add(1);}
};
static Mixer::Request request(const Owner& owner,Mixer::Frame token=1,Mixer::Frame frames=1024){Mixer::Request r;r.token=token;r.buffer={owner.pcm.data(),frames,1,48000};return r;}
static void completion(Bridge& bridge,Mixer::Frame token,Mixer::Frame frame,Mixer::End reason){Bridge::Completion c;check(bridge.takeCompletion(c),"missing bridge completion");check(c.status==Result::ok&&c.voice.token==token&&c.voice.frame==frame&&c.voice.reason==reason,"wrong bridge completion");}

int main(int argc,char** argv){
 try{
  check(argc==2,"supply bridge PCM JSON output");
  {
   haiyue::audio::SpscRing<std::uint64_t,2> ring;std::uint64_t out=0;
   check(ring.push(1)&&ring.push(2)&&!ring.push(3),"ring fullness wrong");check(ring.pop(out)&&out==1&&ring.push(3),"ring wrap push wrong");check(ring.pop(out)&&out==2&&ring.pop(out)&&out==3&&!ring.pop(out),"ring order wrong");done("spsc-fullness-order-and-wrap");
  }
  {
   std::atomic<std::size_t> destroyed{0},wrong{0};auto owner=std::make_shared<Owner>(&destroyed,&wrong);std::weak_ptr<Owner> weak=owner;
   Bridge bridge(48000,1);ok(bridge.start(request(*owner,1,8),owner));owner.reset();check(!weak.expired(),"queued PCM released");
   std::array<float,8> pcm{};render(bridge,pcm.data(),8);check(!weak.expired()&&destroyed==0,"render completed PCM freed before producer acknowledgment");
   completion(bridge,1,8,Mixer::End::natural);check(weak.expired()&&destroyed==1&&wrong==0,"PCM not released on producer");done("pcm-retained-through-queued-active-and-undrained-completion");
  }
  {
   auto owner=std::make_shared<Owner>();Bridge bridge(48000,1);ok(bridge.start(request(*owner),owner));
   for(std::size_t i=1;i<Bridge::commandCapacity;++i)ok(bridge.stop(1,100000+i));
   check(bridge.stop(1,200000)==Result::capacity,"full command queue accepted stop");check(bridge.setGain(1,.5,1000)==Result::capacity&&bridge.reservedEvents()==0,"failed enqueue leaked event reservation");
   auto rejected=std::make_shared<Owner>();std::weak_ptr<Owner> weak=rejected;check(bridge.start(request(*rejected,2),rejected)==Result::capacity,"full queue accepted start");rejected.reset();check(weak.expired()&&bridge.reserved()==1,"failed start retained PCM/slot");
   ok(bridge.release(1));std::array<float,16> pcm{};render(bridge,pcm.data(),16);for(float value:pcm)check(value==0,"cancellation waited for queue space");completion(bridge,1,0,Mixer::End::released);check(bridge.faults()==0,"queue saturation fault");done("full-command-ring-rejects-atomically-and-release-needs-no-slot");
  }
  {
   auto owner=std::make_shared<Owner>();Bridge bridge(48000,1);auto r=request(*owner);r.start=100000;r.stop=200000;ok(bridge.start(r,owner));
   for(std::size_t i=0;i<255;++i)ok(bridge.setGain(1,.5,1000+i));std::array<float,1> pcm{};render(bridge,pcm.data(),1);
   for(std::size_t i=255;i<511;++i)ok(bridge.setGain(1,.5,1000+i));render(bridge,pcm.data(),1);ok(bridge.setGain(1,.5,1511));
   check(bridge.reservedEvents()==512&&bridge.setGain(1,.5,1512)==Result::capacity,"queued plus kernel event capacity not reserved");render(bridge,pcm.data(),1);ok(bridge.release(1));render(bridge,pcm.data(),1);
   check(bridge.reservedEvents()==0&&bridge.faults()==0,"cancel did not return all event reservations");completion(bridge,1,3,Mixer::End::released);done("future-event-reservations-cover-ring-and-kernel");
  }
  {
   auto owner=std::make_shared<Owner>();Bridge bridge(48000,1);auto r=request(*owner);r.start=10000;ok(bridge.start(r,owner));
   for(std::size_t i=0;i<64;++i)ok(bridge.setGain(1,.5,500));check(bridge.reservedEvents()==64,"queued reservations absent");std::array<float,1> pcm{};render(bridge,pcm.data(),1);
   check(bridge.reservedEvents()==1,"replaced events kept reservations");ok(bridge.release(1));render(bridge,pcm.data(),1);completion(bridge,1,1,Mixer::End::released);check(bridge.reservedEvents()==0,"release retained replacement event");done("replacement-and-release-return-event-credit");
  }
  {
   auto owner=std::make_shared<Owner>();Bridge bridge(48000,1);ok(bridge.start(request(*owner,1,1),owner));std::array<float,1> pcm{};render(bridge,pcm.data(),1);ok(bridge.setRate(1,2,200));render(bridge,pcm.data(),1);
   check(bridge.reservedEvents()==0&&bridge.faults()==0,"late control fault or credit leak");completion(bridge,1,1,Mixer::End::natural);done("controls-racing-completion-do-not-revive-voice");
  }
  {
   auto owner=std::make_shared<Owner>();Bridge bridge(48000,1);for(std::size_t i=1;i<=64;++i)ok(bridge.start(request(*owner,i,1),owner));std::array<float,1> pcm{};render(bridge,pcm.data(),1);
   check(bridge.reserved()==64&&bridge.start(request(*owner,65,1),owner)==Result::capacity,"undrained completions lost reservation");
   for(std::size_t i=1;i<=64;++i)completion(bridge,i,1,Mixer::End::natural);check(bridge.reserved()==0,"completion ring lost records");ok(bridge.start(request(*owner,65,1),owner));render(bridge,pcm.data(),1);completion(bridge,65,2,Mixer::End::natural);check(bridge.faults()==0,"completion ring overflow");done("all-64-completions-preserved-with-backpressure");
  }
  {
   auto owner=std::make_shared<Owner>();Bridge bridge(48000,1);auto r=request(*owner,1,8);r.start=80;ok(bridge.start(r,owner));ok(bridge.release(1));std::array<float,8> pcm{};render(bridge,pcm.data(),1);completion(bridge,1,0,Mixer::End::released);
   ok(bridge.start(request(*owner,1,8),owner));render(bridge,pcm.data(),8);check(pcm[0]==owner->pcm[0],"stale cancellation affected reused token");completion(bridge,1,9,Mixer::End::natural);done("reused-slot-cannot-inherit-stale-cancellation");
  }
  {
   auto owner=std::make_shared<Owner>();Bridge bridge(48000,1);for(std::size_t i=1;i<=64;++i){ok(bridge.start(request(*owner,i),owner));ok(bridge.setGain(i,.5,1000));}
   bridge.close();check(bridge.start(request(*owner,65),owner)==Result::closed&&bridge.setGain(1,1,0)==Result::closed,"close accepted work");bridge.sealRender();check(bridge.finalizeAfterRenderStopped(),"quiescent finalization rejected");
   for(std::size_t i=1;i<=64;++i)completion(bridge,i,0,Mixer::End::released);check(bridge.reserved()==0&&bridge.reservedEvents()==0&&bridge.now()==0&&bridge.faults()==0,"quiescent close retained resources");done("suspended-close-flushes-without-another-audio-callback");
  }
  {
   auto owner=std::make_shared<Owner>();Bridge bridge(48000,1);ok(bridge.start(request(*owner),owner));std::array<float,16> pcm{};render(bridge,pcm.data(),16);bridge.close();render(bridge,pcm.data(),16);
   for(float value:pcm)check(value==0,"closed callback emitted PCM");check(bridge.now()==16,"closed render advanced clock");completion(bridge,1,16,Mixer::End::released);done("live-close-silences-output-and-freezes-clock");
  }
  {
   auto owner=std::make_shared<Owner>();Bridge bridge(48000,1);auto r=request(*owner);check(bridge.start(r,{})==Result::invalid,"missing owner accepted");r.rate=std::nan("");check(bridge.start(r,owner)==Result::invalid,"invalid metadata accepted");r=request(*owner);ok(bridge.start(r,owner));
   check(bridge.start(r,owner)==Result::duplicate&&bridge.setGain(1,-1,0)==Result::invalid&&bridge.setRate(1,17,0)==Result::invalid&&bridge.setGain(9,1,0)==Result::retired,"preflight allowed bad command");
   check(bridge.reserved()==1&&bridge.reservedEvents()==0&&bridge.now()==0,"preflight mutated publication");bridge.sealRender();check(bridge.finalizeAfterRenderStopped(),"preflight finalization rejected");completion(bridge,1,0,Mixer::End::released);done("producer-preflight-rejects-without-publication");
  }
  {
   auto owner=std::make_shared<Owner>();std::ofstream raw(argv[1]);check(raw.good(),"cannot save bridge PCM");raw<<std::setprecision(9)<<'[';
   struct Case{const char* id;int start,offset,stop;double rate;int gainAt,rateAt;bool loop;};
   const Case tests[]={{"scheduled-start-and-source-offset",67,19,233,1,-1,-1,false},{"start-duration-argument",61,23,134,1,-1,-1,false},{"scheduled-stop",31,0,173,1,-1,-1,false},{"scheduled-gain",32,0,224,1,128,-1,false},{"constant-playback-rate",32,0,224,2,-1,-1,false},{"scheduled-playback-rate",32,0,224,1,-1,128,false},{"loop-subrange",37,11,241,1,-1,-1,true}};
   bool comma=false;for(const auto& test:tests){Bridge bridge(48000,1);Mixer direct(48000,1);auto r=request(*owner);r.start=test.start;r.offset=test.offset;r.stop=test.stop;r.rate=test.rate;r.gain=test.gainAt<0?1:.25;r.loop=test.loop;r.loopStart=19;r.loopEnd=47;ok(bridge.start(r,owner));check(direct.start(r)==Mixer::Result::ok,"direct start failed");
    if(test.gainAt>=0){ok(bridge.setGain(1,.75,test.gainAt));check(direct.setGain(1,.75,test.gainAt)==Mixer::Result::ok,"direct gain failed");}if(test.rateAt>=0){ok(bridge.setRate(1,2,test.rateAt));check(direct.setRate(1,2,test.rateAt)==Mixer::Result::ok,"direct rate failed");}
    std::array<float,512> a{},b{};render(bridge,a.data(),a.size());check(direct.render(b.data(),b.size())&&a==b,"queue changed PCM");completion(bridge,1,test.stop,Mixer::End::stopped);check(bridge.reservedEvents()==0&&bridge.faults()==0,"PCM test bridge residue");
    if(comma)raw<<',';comma=true;raw<<"{\"id\":\""<<test.id<<"\",\"pcm\":[";for(std::size_t i=0;i<a.size();++i){if(i)raw<<',';raw<<a[i];}raw<<"]}";
   }raw<<"]\n";done("seven-PCM-oracles-identical-through-command-bridge");
  }
  {
   constexpr std::size_t rounds=20000;std::atomic<bool> exit{false},threadFailure{false};std::atomic<std::size_t> destroyed{0},wrong{0},callbacks{0};std::size_t created=0,sent=0,received=0;
   Bridge bridge(48000,1);std::vector<bool> seen(rounds+1,false);std::thread callback([&]{std::array<float,64> pcm{};while(!exit.load(std::memory_order_acquire)){inRender=true;const bool good=bridge.render(pcm.data(),pcm.size());inRender=false;if(!good)threadFailure.store(true);callbacks.fetch_add(1);std::this_thread::yield();}});
   struct Join {std::atomic<bool>& exit;std::thread& callback;~Join(){exit.store(true,std::memory_order_release);if(callback.joinable())callback.join();}} join{exit,callback};
   const auto until=std::chrono::steady_clock::now()+std::chrono::seconds(20);bool timeout=false;
   while(sent<rounds||received<sent){
    Bridge::Completion end;while(bridge.takeCompletion(end)){check(end.voice.token>0&&end.voice.token<=rounds&&!seen[end.voice.token],"duplicate concurrent completion");check(end.status==Result::ok,"concurrent command fault");seen[end.voice.token]=true;++received;}
    if(sent<rounds&&bridge.reserved()<Mixer::maxVoices){auto owner=std::make_shared<Owner>(&destroyed,&wrong);++created;auto r=request(*owner,sent+1,32);r.start=bridge.now()+64;
     const auto accepted=bridge.start(r,owner);if(accepted==Result::ok){++sent;auto gain=bridge.setGain(sent,.5,r.start+7);auto rate=bridge.setRate(sent,2,r.start+9);check((gain==Result::ok||gain==Result::capacity)&&(rate==Result::ok||rate==Result::capacity),"invalid concurrent control status");if(sent%3==0)ok(bridge.release(sent));}else check(accepted==Result::capacity,"concurrent start rejected unexpectedly");
    }
    if(std::chrono::steady_clock::now()>until){timeout=true;break;}std::this_thread::yield();
   }
   exit.store(true,std::memory_order_release);callback.join();bridge.sealRender();check(bridge.finalizeAfterRenderStopped(),"stress finalization rejected");Bridge::Completion rest;while(bridge.takeCompletion(rest))++received;
   check(!timeout&&!threadFailure&&sent==rounds&&received==rounds,"two-thread stress incomplete");check(destroyed==created&&wrong==0,"PCM destruction ran off producer or leaked");check(bridge.reserved()==0&&bridge.reservedEvents()==0&&bridge.faults()==0,"concurrent bridge residue/fault");
   check(callbacks>0,"callback thread did not run");std::cout<<"CONCURRENCY {\"accepted\":"<<sent<<",\"completed\":"<<received<<",\"createdOwners\":"<<created<<",\"destroyedOwners\":"<<destroyed<<",\"wrongThreadDestructors\":"<<wrong<<",\"audioCallbacks\":"<<callbacks<<"}\n";done("20000-two-thread-voices-complete-with-producer-only-destruction");
  }
  {
   auto owner=std::make_shared<Owner>();Bridge bridge(48000,1);for(std::size_t i=1;i<=64;++i){auto r=request(*owner,i);r.loop=true;r.loopStart=0;r.loopEnd=1024;ok(bridge.start(r,owner));}
   check(!bridge.finalizeAfterRenderStopped(),"unsealed finalization allowed");
   std::vector<float> pcm(262144);std::atomic<bool> firstDone{false},sealed{false},bad{false};
   std::thread callback([&]{inRender=true;if(!bridge.render(pcm.data(),pcm.size()))bad=true;inRender=false;firstDone.store(true,std::memory_order_release);while(!sealed.load(std::memory_order_acquire))std::this_thread::yield();std::array<float,16> silence{};for(std::size_t i=0;i<4096;++i){inRender=true;const bool good=bridge.render(silence.data(),silence.size());inRender=false;if(!good)bad=true;for(float sample:silence)if(sample!=0)bad=true;}});
   struct JoinGate {std::atomic<bool>& signal;std::thread& thread;~JoinGate(){signal.store(true,std::memory_order_release);if(thread.joinable())thread.join();}} join{sealed,callback};
   while(!bridge.rendering()&&!firstDone.load(std::memory_order_acquire))std::this_thread::yield();
   bridge.sealRender();sealed.store(true,std::memory_order_release);
   while(!bridge.finalizeAfterRenderStopped())std::this_thread::yield();
   for(std::size_t i=1;i<=64;++i)completion(bridge,i,bridge.now(),Mixer::End::released);
   callback.join();check(bridge.renderQuiescent()&&!bad&&bridge.reserved()==0&&bridge.faults()==0,"seal raced callback/finalization");done("atomic-seal-hands-mixer-back-to-producer-while-later-callbacks-only-silence");
  }
  {
   auto owner=std::make_shared<Owner>();Bridge bridge(48000,1);ok(bridge.start(request(*owner,1,32),owner));ok(bridge.start(request(*owner,2,32),owner));
   std::array<float,16> pcm{};render(bridge,pcm.data(),8);check(bridge.now()==8,"initial peer clock wrong");check(bridge.suspendRender(),"suspend rejected");
   render(bridge,pcm.data(),16);for(float value:pcm)check(value==0,"suspended callback emitted PCM");check(bridge.now()==8,"suspension advanced samples");
   ok(bridge.release(1));ok(bridge.setGain(2,.5,10));ok(bridge.stop(2,18));check(bridge.serviceSuspended(),"suspended command service rejected");completion(bridge,1,8,Mixer::End::released);
   check(bridge.reserved()==1&&bridge.now()==8&&!bridge.finalizeAfterRenderStopped(),"suspend released peer or admitted final destruction");
   check(bridge.resumeRender(),"resume rejected");render(bridge,pcm.data(),16);
   for(std::size_t i=0;i<16;++i)check(std::abs(pcm[i]-(i<10?owner->pcm[8+i]*(i>=2?.5f:1.0f):0))<=1e-6,"resumed peer phase/gain differs");completion(bridge,2,18,Mixer::End::stopped);
   check(bridge.suspendRender(),"second suspend rejected");std::atomic<std::size_t> destroyed{0},wrong{0};auto late=std::make_shared<Owner>(&destroyed,&wrong);std::weak_ptr<Owner> weak=late;
   ok(bridge.start(request(*late,3,32),late));ok(bridge.release(3));late.reset();check(!weak.expired(),"suspended queued PCM released before service");check(bridge.serviceSuspended(),"suspended release did not service");completion(bridge,3,24,Mixer::End::released);
   check(weak.expired()&&destroyed==1&&wrong==0,"suspended disposal required audio restart or wrong thread");bridge.sealRender();check(!bridge.resumeRender()&&!bridge.serviceSuspended()&&bridge.finalizeAfterRenderStopped(),"closed suspension reopened");
   check(bridge.reserved()==0&&bridge.reservedEvents()==0&&bridge.faults()==0,"suspension retained resources");done("hardware-suspend-freezes-clock-services-disposal-and-preserves-peer-resume");
  }
  check(renderNew==0&&renderDelete==0,"C++ allocation/destruction occurred in audio callback");
  std::cout<<"SUMMARY {\"passed\":"<<passed<<",\"serialRenderCalls\":"<<renderCalls<<",\"operatorNewDuringRender\":"<<renderNew<<",\"operatorDeleteDuringRender\":"<<renderDelete<<",\"physicalNativeQualified\":false}\n";return 0;
 }catch(const std::exception& error){inRender=false;std::cerr<<"FAIL "<<error.what()<<'\n';return 1;}
}
