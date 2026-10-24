#import "HYANativeAudio.h"
#import <AVFoundation/AVFoundation.h>
#import <CommonCrypto/CommonDigest.h>
#include "generated/HyaPcmBridge.hpp"
#include <algorithm>
#include <cstring>
#include <cstdio>
#include <stdexcept>
#include <vector>

#if !__has_feature(objc_arc)
#error HYANativeAudio requires Objective-C ARC
#endif
using haiyue::audio::PcmBridge;
using haiyue::audio::PcmMixer;
@implementation HYAByteIntegrity
+ (nullable NSString *)sha256Base64:(NSString *)encoded {
  if (encoded.length > ((64ULL * 1024 * 1024 + 2) / 3) * 4) return nil;
  NSData *bytes = [[NSData alloc] initWithBase64EncodedString:encoded options:0];
  if (!bytes || bytes.length > 64ULL * 1024 * 1024) return nil;
  unsigned char digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(bytes.bytes, (CC_LONG)bytes.length, digest);
  return [[NSData dataWithBytes:digest length:sizeof(digest)] base64EncodedStringWithOptions:0];
}
@end
namespace {
constexpr size_t MaxEncoded = 64 * 1024 * 1024, MaxPcm = 256 * 1024 * 1024;
struct PCM {std::vector<float> samples; uint32_t rate = 0, channels = 0; uint64_t frames = 0;};
struct AudioState {
  explicit AudioState(uint32_t rate):bridge(rate,2) {bridge.suspendRender();}
  PcmBridge bridge; std::array<float,2048> scratch{}; std::atomic<uint32_t> callbackFaults{0};
};
NSError *Error(NSString *message) {return [NSError errorWithDomain:@"Haiyue.HyaAudio" code:1 userInfo:@{NSLocalizedDescriptionKey:message}];}
bool Number(id value,double& result) {
  if (![value isKindOfClass:NSNumber.class] || CFGetTypeID((__bridge CFTypeRef)value)==CFBooleanGetTypeID()) return false;
  result=[value doubleValue]; return std::isfinite(result);
}
bool Frame(id value,uint64_t& result) {double number; if(!Number(value,number)||number<0||number>PcmMixer::maxFrame||std::floor(number)!=number)return false;result=static_cast<uint64_t>(number);return true;}
bool FrameNumber(double value,uint64_t& result) {if(!std::isfinite(value)||value<0||value>PcmMixer::maxFrame||std::floor(value)!=value)return false;result=static_cast<uint64_t>(value);return true;}
NSDictionary *JSON(NSString *text) {id value=[NSJSONSerialization JSONObjectWithData:[text dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];return [value isKindOfClass:NSDictionary.class]?value:nil;}
void Silence(AudioBufferList *output) {if(output)for(UInt32 i=0;i<output->mNumberBuffers;++i)if(output->mBuffers[i].mData)std::memset(output->mBuffers[i].mData,0,output->mBuffers[i].mDataByteSize);}
OSStatus Render(AudioState& state,BOOL *isSilence,AVAudioFrameCount frames,AudioBufferList *output) noexcept {
  if(!output) return kAudio_ParamError;
  const bool planar=output->mNumberBuffers==2&&output->mBuffers[0].mNumberChannels==1&&output->mBuffers[1].mNumberChannels==1;
  const bool interleaved=output->mNumberBuffers==1&&output->mBuffers[0].mNumberChannels==2;
  if(!planar&&!interleaved){Silence(output);state.callbackFaults.fetch_add(1);return kAudio_ParamError;}
  for(UInt32 i=0;i<output->mNumberBuffers;++i)if(!output->mBuffers[i].mData||output->mBuffers[i].mDataByteSize<static_cast<uint64_t>(frames)*sizeof(float)*(interleaved?2:1)){Silence(output);state.callbackFaults.fetch_add(1);return kAudio_ParamError;}
  for(uint32_t offset=0;offset<frames;){
    const auto count=std::min<uint32_t>(1024,frames-offset);
    if(!state.bridge.render(state.scratch.data(),count)){Silence(output);state.callbackFaults.fetch_add(1);return kAudio_ParamError;}
    if(interleaved)std::memcpy(static_cast<float*>(output->mBuffers[0].mData)+offset*2,state.scratch.data(),count*2*sizeof(float));
    else for(uint32_t frame=0;frame<count;++frame)for(uint32_t channel=0;channel<2;++channel)static_cast<float*>(output->mBuffers[channel].mData)[offset+frame]=state.scratch[frame*2+channel];
    offset+=count;
  }
  if(isSilence)*isSilence=NO;return noErr;
}
bool Wait(const std::shared_ptr<AudioState>& state) {
  const auto deadline=NSProcessInfo.processInfo.systemUptime+.5;
  while(!state->bridge.renderQuiescent()&&NSProcessInfo.processInfo.systemUptime<deadline)[NSThread sleepForTimeInterval:.001];
  return state->bridge.renderQuiescent();
}
// GC fallback owns these values independently of the dying ObjC object. Cleanup is always main-thread.
void Retire(std::shared_ptr<AudioState> state,AVAudioEngine *engine,AVAudioSourceNode *source) {
  state->bridge.sealRender();[engine stop];
  if(!state->bridge.renderQuiescent()){
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW,10*NSEC_PER_MSEC),dispatch_get_main_queue(),^{Retire(state,engine,source);});return;
  }
  state->bridge.finalizeAfterRenderStopped();PcmBridge::Completion completion;while(state->bridge.takeCompletion(completion)){}
  if(source)[engine detachNode:source];
}
}

@interface HYANativeAudioBuffer () { @public std::shared_ptr<const PCM> _pcm; }
@end
@implementation HYANativeAudioBuffer
- (double)sampleRate {return _pcm?_pcm->rate:0;}
- (double)channels {return _pcm?_pcm->channels:0;}
- (double)frames {return _pcm?static_cast<double>(_pcm->frames):0;}
- (double)bytes {return _pcm?static_cast<double>(_pcm->samples.size()*sizeof(float)):0;}
- (void)releasePCM {NSAssert(NSThread.isMainThread,@"PCM release belongs to the control producer");_pcm.reset();}
@end

@implementation HYANativeAudio {
  std::shared_ptr<AudioState> _audio; AVAudioEngine *_engine; AVAudioSourceNode *_source;
  NSMutableArray<id> *_observers; NSMutableArray<NSDictionary*> *_completed;
  NSString *_failure; uint32_t _rate; BOOL _offline,_running,_closed;
}
- (instancetype)initWithSampleRate:(double)rate offline:(BOOL)offline {
  if(!(self=[super init]))return nil;_failure=@"";_offline=offline;_observers=[NSMutableArray new];_completed=[NSMutableArray new];
  if(!NSThread.isMainThread||!std::isfinite(rate)||rate<8000||rate>192000||std::floor(rate)!=rate){_failure=@"Invalid native audio producer/rate";_closed=YES;return self;}
  _rate=static_cast<uint32_t>(rate);
  @try {
    _audio=std::make_shared<AudioState>(_rate);_engine=[AVAudioEngine new];
    AVAudioFormat *format=[[AVAudioFormat alloc] initWithCommonFormat:AVAudioPCMFormatFloat32 sampleRate:rate channels:2 interleaved:NO];
    auto state=_audio;
    _source=[[AVAudioSourceNode alloc] initWithFormat:format renderBlock:^OSStatus(BOOL *silence,const AudioTimeStamp *timestamp,AVAudioFrameCount frames,AudioBufferList *output){(void)timestamp;return Render(*state,silence,frames,output);}];
    [_engine attachNode:_source];[_engine connect:_source to:_engine.mainMixerNode format:format];_engine.mainMixerNode.outputVolume=1;
    if(offline){NSError *error=nil;if(![_engine enableManualRenderingMode:AVAudioEngineManualRenderingModeOffline format:format maximumFrameCount:1024 error:&error]){_failure=error.localizedDescription?:@"Offline mode failed";_closed=YES;}}
    [_engine prepare];
    if(!offline){__weak HYANativeAudio *weak=self;NSNotificationCenter *center=NSNotificationCenter.defaultCenter;
      [_observers addObject:[center addObserverForName:AVAudioSessionInterruptionNotification object:nil queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *note){if([note.userInfo[AVAudioSessionInterruptionTypeKey] unsignedIntegerValue]==AVAudioSessionInterruptionTypeBegan)[weak suspend];}]];
      [_observers addObject:[center addObserverForName:AVAudioSessionRouteChangeNotification object:nil queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *note){if([note.userInfo[AVAudioSessionRouteChangeReasonKey] unsignedIntegerValue]==AVAudioSessionRouteChangeReasonOldDeviceUnavailable)[weak suspend];}]];
      [_observers addObject:[center addObserverForName:AVAudioEngineConfigurationChangeNotification object:_engine queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *note){(void)note;HYANativeAudio *owner=weak;if(owner&&owner->_running&&!owner->_engine.running)[owner suspend];}]];
    }
  }@catch(NSException *exception){_failure=exception.reason?:@"Native audio initialization failed";_closed=YES;}
  return self;
}
- (BOOL)producer {if(!NSThread.isMainThread){_failure=@"Native audio control must run on the main producer";return NO;}return YES;}
- (double)sampleRate {return _rate;}
- (double)nowFrame {return _audio?static_cast<double>(_audio->bridge.now()):0;}
- (double)pendingVoices {return _audio&&NSThread.isMainThread?_audio->bridge.reserved():0;}
- (NSString*)state {return _closed?@"closed":_running?@"running":@"suspended";}
- (NSString*)lastError {if(_audio&&(_audio->callbackFaults.load()||_audio->bridge.faults()))return @"Native audio render/bridge fault";return _failure;}
- (BOOL)unlock {
  if(![self producer]||_closed||!_audio)return NO;if(_running)return YES;NSError *error=nil;
  if(!_offline){AVAudioSession *session=AVAudioSession.sharedInstance;if(![session setCategory:AVAudioSessionCategoryAmbient error:&error]||![session setActive:YES error:&error]){_failure=error.localizedDescription?:@"Native audio session could not activate";return NO;}}
  if(!_audio->bridge.resumeRender()){_failure=@"An earlier audio callback is not quiescent";return NO;}
  if(![_engine startAndReturnError:&error]){_audio->bridge.suspendRender();_failure=error.localizedDescription?:@"Native audio start failed";return NO;}_failure=@"";_running=YES;return YES;
}
- (BOOL)suspend {
  if(![self producer]||_closed||!_audio)return NO;_audio->bridge.suspendRender();[_engine pause];_running=NO;
  if(!Wait(_audio)||!_audio->bridge.serviceSuspended()){_failure=@"Native audio suspension did not become quiescent";return NO;}_failure=@"";return YES;
}
- (BOOL)close {
  if(![self producer])return NO;_closed=YES;_running=NO;
  for(id observer in _observers)[NSNotificationCenter.defaultCenter removeObserver:observer];[_observers removeAllObjects];
  if(!_audio)return YES;_audio->bridge.sealRender();[_engine stop];
  if(!Wait(_audio)||!_audio->bridge.finalizeAfterRenderStopped()){_failure=@"Native audio close did not become quiescent; PCM retained";return NO;}
  [self collect];if(_source){[_engine detachNode:_source];_source=nil;}return YES;
}
- (void)dealloc {
  for(id observer in _observers)[NSNotificationCenter.defaultCenter removeObserver:observer];
  if(_audio){auto state=_audio;AVAudioEngine *engine=_engine;AVAudioSourceNode *source=_source;
    if(NSThread.isMainThread)Retire(state,engine,source);else dispatch_async(dispatch_get_main_queue(),^{Retire(state,engine,source);});}
}
- (void)collect {
  if(!_audio)return;PcmBridge::Completion c;while(_audio->bridge.takeCompletion(c))[_completed addObject:@{@"token":@(c.voice.token),@"frame":@(c.voice.frame),@"status":c.status==PcmBridge::Result::ok?@"ok":@"error"}];
}
- (NSString*)drainCompletions {
  if(![self producer])return @"[]";
  if(_audio&&!_running&&!_closed)_audio->bridge.serviceSuspended();[self collect];
  NSData *data=[NSJSONSerialization dataWithJSONObject:_completed options:0 error:nil];[_completed removeAllObjects];return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]?:@"[]";
}
- (NSInteger)scheduleBuffer:(HYANativeAudioBuffer*)buffer token:(double)token requestJSON:(NSString*)text {
  if(![self producer]||_closed||!_audio)return 5;if(!_running||!buffer||!buffer->_pcm)return 1;NSDictionary *json=JSON(text);PcmMixer::Request r;
  if(!FrameNumber(token,r.token)||!Frame(json[@"startFrame"],r.start)||!Frame(json[@"offsetFrame"],r.offset)||!Number(json[@"gain"],r.gain)||!Number(json[@"rate"],r.rate))return 1;
  if(json[@"stopFrame"]&&!Frame(json[@"stopFrame"],r.stop))return 1;
  if(json[@"loop"]){NSDictionary *loop=json[@"loop"];if(![loop isKindOfClass:NSDictionary.class]||!Frame(loop[@"startFrame"],r.loopStart)||!Frame(loop[@"endFrame"],r.loopEnd))return 1;r.loop=true;}
  auto pcm=buffer->_pcm;r.buffer={pcm->samples.data(),pcm->frames,pcm->channels,pcm->rate};return static_cast<NSInteger>(_audio->bridge.start(r,pcm));
}
- (NSInteger)stopToken:(double)token atFrame:(double)frame {uint64_t id,at;if(![self producer]||!_audio||!FrameNumber(token,id)||!FrameNumber(frame,at))return 1;return static_cast<NSInteger>(_audio->bridge.stop(id,at));}
- (NSInteger)gainToken:(double)token value:(double)value atFrame:(double)frame {uint64_t id,at;if(![self producer]||!_audio||!FrameNumber(token,id)||!FrameNumber(frame,at))return 1;return static_cast<NSInteger>(_audio->bridge.setGain(id,value,at));}
- (NSInteger)rateToken:(double)token value:(double)value atFrame:(double)frame {uint64_t id,at;if(![self producer]||!_audio||!FrameNumber(token,id)||!FrameNumber(frame,at))return 1;return static_cast<NSInteger>(_audio->bridge.setRate(id,value,at));}
- (NSInteger)cancelToken:(double)token {uint64_t id;if(![self producer]||!_audio||!FrameNumber(token,id))return 1;return static_cast<NSInteger>(_audio->bridge.release(id));}
- (NSString*)renderOffline:(double)frames {
  uint64_t count;if(![self producer]||!_offline||!_running||!FrameNumber(frames,count)||count>48000*10){_failure=@"Invalid offline render request";return nil;}
  NSMutableData *data=[NSMutableData dataWithLength:static_cast<NSUInteger>(count)*2*sizeof(float)];float *out=static_cast<float*>(data.mutableBytes);uint64_t offset=0;
  AVAudioPCMBuffer *buffer=[[AVAudioPCMBuffer alloc] initWithPCMFormat:_engine.manualRenderingFormat frameCapacity:1024];
  while(offset<count){AVAudioFrameCount chunk=static_cast<AVAudioFrameCount>(std::min<uint64_t>(1024,count-offset));NSError *error=nil;AVAudioEngineManualRenderingStatus status=[_engine renderOffline:chunk toBuffer:buffer error:&error];
    if(status!=AVAudioEngineManualRenderingStatusSuccess||buffer.frameLength!=chunk){_failure=error.localizedDescription?:@"Offline audio engine did not produce requested PCM";return nil;}
    for(uint32_t f=0;f<chunk;++f)for(uint32_t c=0;c<2;++c)out[(offset+f)*2+c]=buffer.floatChannelData[c][f];offset+=chunk;
  }return [data base64EncodedStringWithOptions:0];
}
- (void)decodeBase64:(NSString*)encoded metadataJSON:(NSString*)text completion:(void(^)(HYANativeAudioBuffer*,NSError*))completion {
  if(![self producer]||_closed){completion(nil,Error(@"Native decoder is closed"));return;}
  // Bounded application resource jobs; no file IO/decoder/ObjC message occurs in Render().
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY,0),^{@autoreleasepool{
    HYANativeAudioBuffer *decoded=nil;NSError *error=nil;NSURL *url=nil;
    try{@try{
      NSDictionary *metadata=JSON(text);uint64_t rate,channels,frames;
      if(!Frame(metadata[@"sampleRate"],rate)||!Frame(metadata[@"channels"],channels)||!Frame(metadata[@"frameLength"],frames)||!rate||rate>384000||!frames||(channels!=1&&channels!=2)||frames>MaxPcm/(channels*4))throw std::runtime_error("Invalid declared PCM metadata");
      if(encoded.length>((MaxEncoded+2)/3)*4)throw std::runtime_error("Encoded audio exceeds native ceiling");
      NSData *bytes=[[NSData alloc] initWithBase64EncodedString:encoded options:0];if(!bytes||!bytes.length||bytes.length>MaxEncoded)throw std::runtime_error("Invalid encoded audio");
      NSString *expected=metadata[@"integrity"][@"digest"];if(![metadata[@"integrity"][@"algorithm"] isEqualToString:@"sha256"]||![expected isKindOfClass:NSString.class]||expected.length!=64)throw std::runtime_error("Missing encoded SHA-256");
      unsigned char digest[CC_SHA256_DIGEST_LENGTH];
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
      CC_SHA256(bytes.bytes,static_cast<CC_LONG>(bytes.length),digest);
#pragma clang diagnostic pop
      char hex[65];for(size_t i=0;i<32;++i)std::snprintf(hex+i*2,3,"%02x",digest[i]);hex[64]=0;
      if(![expected isEqualToString:[NSString stringWithUTF8String:hex]])throw std::runtime_error("Encoded audio SHA-256 mismatch");
      NSString *codec=metadata[@"codec"];if(![@[@"wav",@"mp3",@"aac",@"opus",@"vorbis",@"flac"] containsObject:codec])throw std::runtime_error("Unsupported native encoded codec; raw PCM needs an explicit channel-layout contract");
      NSString *extension=[codec isEqualToString:@"vorbis"]?@"ogg":codec;
      url=[NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:[[NSUUID.UUID.UUIDString stringByAppendingString:@"."] stringByAppendingString:extension]]];
      if(![bytes writeToURL:url options:NSDataWritingAtomic error:&error])throw std::runtime_error("Native encoded temporary write failed");
      AVAudioFile *file=[[AVAudioFile alloc] initForReading:url commonFormat:AVAudioPCMFormatFloat32 interleaved:NO error:&error];
      if(!file||file.length!=static_cast<AVAudioFramePosition>(frames)||file.processingFormat.sampleRate!=rate||file.processingFormat.channelCount!=channels)throw std::runtime_error("Native decoder metadata differs from HYA source");
      AVAudioPCMBuffer *buffer=[[AVAudioPCMBuffer alloc] initWithPCMFormat:file.processingFormat frameCapacity:static_cast<AVAudioFrameCount>(frames)];
      if(!buffer||![file readIntoBuffer:buffer error:&error]||buffer.frameLength!=frames||!buffer.floatChannelData)throw std::runtime_error("Native PCM decode failed");
      auto pcm=std::make_shared<PCM>();pcm->rate=static_cast<uint32_t>(rate);pcm->channels=static_cast<uint32_t>(channels);pcm->frames=frames;pcm->samples.resize(static_cast<size_t>(frames*channels));
      for(uint64_t f=0;f<frames;++f)for(uint32_t c=0;c<channels;++c){const float sample=buffer.floatChannelData[c][f];if(!std::isfinite(sample))throw std::runtime_error("Native PCM contains nonfinite samples");pcm->samples[static_cast<size_t>(f*channels+c)]=sample;}
      decoded=[HYANativeAudioBuffer new];decoded->_pcm=pcm;
    }@catch(NSException *exception){error=Error(exception.reason?:@"Native decoder exception");}}
    catch(const std::exception& exception){if(!error)error=Error([NSString stringWithUTF8String:exception.what()]);}
    if(url)[NSFileManager.defaultManager removeItemAtURL:url error:nil];
    dispatch_async(dispatch_get_main_queue(),^{completion(decoded,error);});
  }});
}
@end
