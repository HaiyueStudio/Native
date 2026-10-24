#include "../native/HyaPcmMixer.hpp"
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <new>
#include <stdexcept>
#include <string>
#include <vector>

static std::size_t allocations = 0;
void* operator new(std::size_t size) {++allocations; if (void* p = std::malloc(size ? size : 1)) return p; throw std::bad_alloc();}
void* operator new[](std::size_t size) {return ::operator new(size);}
void operator delete(void* p) noexcept {std::free(p);}
void operator delete[](void* p) noexcept {std::free(p);}
void operator delete(void* p, std::size_t) noexcept {std::free(p);}
void operator delete[](void* p, std::size_t) noexcept {std::free(p);}
using Mixer = haiyue::audio::PcmMixer;
using Result = Mixer::Result;
static std::size_t passed = 0, renderCalls = 0;
static void check(bool value, const char* message) {if (!value) throw std::runtime_error(message);}
static void ok(Result result) {check(result == Result::ok, "kernel command rejected");}
static void render(Mixer& mixer, float* pcm, std::size_t frames) {
  const auto before = allocations; check(mixer.render(pcm, frames), "render rejected");
  check(before == allocations, "allocation during render"); ++renderCalls;
}
static void equal(float actual, double expected) {check(std::abs(static_cast<double>(actual) - expected) <= 1e-6, "PCM differs from authored sample");}
static void complete(Mixer& mixer, Mixer::Frame token, Mixer::Frame frame, Mixer::End reason) {
  Mixer::Completion end; check(mixer.takeCompletion(end), "missing completion");
  check(end.token == token && end.frame == frame && end.reason == reason, "wrong completion");
}
static Mixer::Request request(const float* pcm, Mixer::Frame frames = 1024, Mixer::Frame token = 1) {
  Mixer::Request value; value.token = token; value.buffer = {pcm, frames, 1, 48000}; return value;
}
static double ramp(double position) {return (position + 32) / 2048;}
static void done(const char* name) {++passed; std::cout << "PASS " << name << '\n';}

int main(int argc, char** argv) {
  try {
    check(argc == 2, "supply raw PCM JSON path");
    std::vector<float> source(1024); for (std::size_t i = 0; i < source.size(); ++i) source[i] = static_cast<float>(ramp(static_cast<double>(i)));
    struct Case {const char* id; int start, offset, end; double rate; int gainAt, rateAt; bool loop;};
    const Case cases[] = {
      {"scheduled-start-and-source-offset",67,19,233,1,-1,-1,false},
      {"start-duration-argument",61,23,134,1,-1,-1,false},
      {"scheduled-stop",31,0,173,1,-1,-1,false},
      {"scheduled-gain",32,0,224,1,128,-1,false},
      {"constant-playback-rate",32,0,224,2,-1,-1,false},
      {"scheduled-playback-rate",32,0,224,1,-1,128,false},
      {"loop-subrange",37,11,241,1,-1,-1,true},
    };
    std::ofstream raw(argv[1]); check(raw.good(), "cannot open raw output"); raw << std::setprecision(9) << "[";
    bool comma = false;
    for (const auto& test : cases) {
      Mixer mixer(48000,1); auto value = request(source.data());
      value.start = static_cast<Mixer::Frame>(test.start); value.offset = static_cast<Mixer::Frame>(test.offset); value.stop = static_cast<Mixer::Frame>(test.end);
      value.gain = test.gainAt < 0 ? 1 : .25; value.rate = test.rate; value.loop = test.loop; value.loopStart = 19; value.loopEnd = 47;
      ok(mixer.start(value)); if (test.gainAt >= 0) ok(mixer.setGain(1,.75,static_cast<Mixer::Frame>(test.gainAt)));
      if (test.rateAt >= 0) ok(mixer.setRate(1,2,static_cast<Mixer::Frame>(test.rateAt)));
      std::array<float,512> pcm{}; render(mixer,pcm.data(),pcm.size());
      for (int frame = 0; frame < 512; ++frame) {
        double expected = 0;
        if (frame >= test.start && frame < test.end) {
          double position = test.offset + (frame - test.start) * test.rate;
          if (test.rateAt >= 0 && frame >= test.rateAt) position += frame - test.rateAt;
          if (test.loop && position >= 47) position = 19 + std::fmod(position - 19,28);
          expected = ramp(position) * (test.gainAt < 0 ? 1 : frame >= test.gainAt ? .75 : .25);
        }
        equal(pcm[static_cast<std::size_t>(frame)],expected);
      }
      complete(mixer,1,static_cast<Mixer::Frame>(test.end),Mixer::End::stopped);
      check(mixer.reserved() == 0 && mixer.pendingEvents() == 0, "case leaked ownership");
      if (comma) raw << ','; comma = true; raw << "{\"id\":\"" << test.id << "\",\"pcm\":[";
      for (std::size_t i = 0; i < pcm.size(); ++i) {if (i) raw << ','; raw << pcm[i];} raw << "]}";
      done(test.id);
    }
    raw << "]\n"; raw.close();
    {
      Mixer mixer(48000,1); auto value = request(source.data()); value.start = 32; value.stop = 224; ok(mixer.start(value));
      ok(mixer.setRate(1,2,137)); ok(mixer.setGain(1,.5,139)); std::array<float,512> pcm{}; render(mixer,pcm.data(),pcm.size());
      for (int f = 0; f < 512; ++f) equal(pcm[static_cast<std::size_t>(f)],f < 32 || f >= 224 ? 0 : ramp(f - 32 + (f >= 137 ? f - 137 : 0)) * (f >= 139 ? .5 : 1));
      done("automation-not-quantized-to-128-frame-boundaries");
    }
    {
      Mixer left(48000,1),right(48000,1); auto value = request(source.data()); value.start=37; value.stop=417; value.loop=true; value.loopStart=19; value.loopEnd=47;
      for (auto* mixer : {&left,&right}) {ok(mixer->start(value)); ok(mixer->setGain(1,.3,139)); ok(mixer->setRate(1,1.5,201));}
      std::array<float,512> a{},b{}; render(left,a.data(),a.size());
      const std::size_t chunks[] = {1,17,63,128,3,211,89}; std::size_t at = 0;
      for (auto count : chunks) {render(right,b.data()+at,count); at += count;}
      check(at==512 && a==b,"render quantum changed PCM");complete(left,1,417,Mixer::End::stopped);complete(right,1,417,Mixer::End::stopped);
      done("render-chunk-invariance");
    }
    {
      Mixer mixer(48000,1); auto value=request(source.data());value.buffer.sampleRate=24000;value.start=16;value.offset=9;value.stop=200;ok(mixer.start(value));
      std::array<float,256> pcm{};render(mixer,pcm.data(),pcm.size());for(int f=0;f<256;++f)equal(pcm[static_cast<std::size_t>(f)],f<16||f>=200?0:ramp(9+(f-16)*.5));
      done("source-rate-conversion-and-fractional-interpolation");
    }
    {
      Mixer up(48000,2),down(48000,1);auto a=request(source.data(),8);ok(up.start(a));std::array<float,32> pcm{};render(up,pcm.data(),16);
      for(std::size_t i=0;i<16;++i){equal(pcm[2*i],i<8?ramp(static_cast<double>(i)):0);equal(pcm[2*i+1],pcm[2*i]);}
      const float stereo[]={.25f,.75f,.5f,.25f};auto b=request(stereo,2);b.buffer.channels=2;ok(down.start(b));std::array<float,4> mono{};render(down,mono.data(),4);equal(mono[0],.5);equal(mono[1],.375);equal(mono[2],0);equal(mono[3],0);
      complete(up,1,8,Mixer::End::natural);complete(down,1,2,Mixer::End::natural);done("mono-stereo-mapping-and-natural-completion");
    }
    {
      Mixer mixer(48000,1);auto value=request(source.data());value.stop=100;ok(mixer.start(value));ok(mixer.stop(1,200));ok(mixer.setGain(1,.75,150));ok(mixer.setGain(1,.5,100));
      check(mixer.pendingEvents()==1,"future gain was not cancelled");std::array<float,256> pcm{};render(mixer,pcm.data(),pcm.size());for(int f=0;f<256;++f)equal(pcm[static_cast<std::size_t>(f)],f>=200?0:ramp(f)*(f>=100?.5:1));
      complete(mixer,1,200,Mixer::End::stopped);done("stop-reschedule-and-future-param-replacement");
    }
    {
      Mixer mixer(48000,1);auto a=request(source.data(),1024,1),b=request(source.data(),1024,2);a.gain=.25;b.gain=.5;a.stop=b.stop=200;ok(mixer.start(a));ok(mixer.start(b));
      std::array<float,256> pcm{};render(mixer,pcm.data(),64);ok(mixer.release(1));render(mixer,pcm.data()+64,192);
      for(int f=0;f<256;++f)equal(pcm[static_cast<std::size_t>(f)],f>=200?0:ramp(f)*(f<64?.75:.5));
      complete(mixer,1,64,Mixer::End::released);complete(mixer,2,200,Mixer::End::stopped);check(mixer.reserved()==0,"peer residue");done("shared-PCM-peer-isolation-and-once-completion");
    }
    {
      Mixer mixer(48000,1);auto value=request(source.data());value.start=100;ok(mixer.start(value));ok(mixer.setGain(1,.5,99));ok(mixer.release(1));
      std::array<float,128> pcm{};render(mixer,pcm.data(),pcm.size());for(float sample:pcm)equal(sample,0);complete(mixer,1,0,Mixer::End::released);
      check(mixer.setGain(1,1,130)==Result::retired&&mixer.release(1)==Result::retired&&mixer.pendingEvents()==0,"retired voice revived");done("cancel-before-start-retires-events");
    }
    {
      Mixer mixer(48000,1);for(std::size_t i=1;i<=Mixer::maxVoices;++i)ok(mixer.start(request(source.data(),1024,static_cast<Mixer::Frame>(i))));
      check(mixer.start(request(source.data(),1024,1))==Result::duplicate,"duplicate accepted");check(mixer.start(request(source.data(),1024,65))==Result::capacity,"voice cap lost");
      for(std::size_t i=1;i<=Mixer::maxEvents;++i)ok(mixer.setGain(1,.5,static_cast<Mixer::Frame>(i)));
      check(mixer.setGain(1,.75,513)==Result::capacity&&mixer.pendingEvents()==512,"event capacity mutated");ok(mixer.setGain(1,.25,256));check(mixer.pendingEvents()==256,"event replacement did not free slots");
      mixer.releaseAll();check(mixer.reserved()==64&&mixer.pendingEvents()==0,"completion released PCM early");check(mixer.start(request(source.data(),1024,65))==Result::capacity,"undrained completion overwritten");
      Mixer::Completion end;std::size_t completed=0;while(mixer.takeCompletion(end))++completed;check(completed==64&&mixer.reserved()==0,"bounded completions lost");done("bounded-slots-events-and-completion-backpressure");
    }
    {
      Mixer mixer(48000,1);auto value=request(source.data());value.token=0;check(mixer.start(value)==Result::invalid,"zero token accepted");value=request(source.data());value.rate=std::nan("");check(mixer.start(value)==Result::invalid,"NaN accepted");
      value=request(source.data());value.offset=1024;check(mixer.start(value)==Result::invalid,"invalid offset accepted");value=request(source.data());value.loop=true;value.loopStart=10;value.loopEnd=10;check(mixer.start(value)==Result::invalid,"empty loop accepted");
      value=request(source.data());value.gain=-1;check(mixer.start(value)==Result::invalid,"negative gain accepted");value=request(source.data());value.buffer.channels=3;check(mixer.start(value)==Result::invalid,"undeclared channel mapping accepted");
      check(!mixer.render(nullptr,16)&&mixer.now()==0&&mixer.reserved()==0,"invalid render advanced clock");done("invalid-requests-fail-without-publication");
    }
    {
      Mixer mixer(48000,1);std::array<float,256> pcm{};render(mixer,pcm.data(),100);auto value=request(source.data());value.offset=7;value.stop=150;ok(mixer.start(value));render(mixer,pcm.data()+100,156);
      for(int f=0;f<256;++f)equal(pcm[static_cast<std::size_t>(f)],f<100||f>=150?0:ramp(7+f-100));complete(mixer,1,150,Mixer::End::stopped);done("late-start-does-not-double-catch-up");
    }
    {
      Mixer mixer(48000,1);std::array<float,16> pcm{};const auto before=allocations;
      for(std::size_t i=1;i<=10000;++i){auto value=request(source.data(),16,static_cast<Mixer::Frame>(i));value.start=mixer.now();ok(mixer.start(value));ok(mixer.setGain(value.token,.5,mixer.now()+7));render(mixer,pcm.data(),pcm.size());complete(mixer,value.token,value.start+16,Mixer::End::natural);}
      check(allocations==before&&mixer.reserved()==0&&mixer.pendingEvents()==0,"continuous cycles allocated or retained state");done("10000-complete-cycles-with-no-heap-allocation");
    }
    std::cout << "SUMMARY {\"passed\":" << passed << ",\"renderCalls\":" << renderCalls << ",\"kernelRenderAllocations\":0,\"physicalNativeQualified\":false}\n";
    return 0;
  }catch(const std::exception& error){std::cerr << "FAIL " << error.what() << '\n';return 1;}
}
