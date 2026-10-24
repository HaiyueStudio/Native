#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN
/** Example-owned byte-integrity capability; no general WebCrypto implementation. */
@interface HYAByteIntegrity : NSObject
+ (nullable NSString *)sha256Base64:(NSString *)encoded;
@end
@interface HYANativeAudioBuffer : NSObject
@property(nonatomic, readonly) double sampleRate;
@property(nonatomic, readonly) double channels;
@property(nonatomic, readonly) double frames;
@property(nonatomic, readonly) double bytes;
- (void)releasePCM;
@end

/** All control methods and completion delivery belong to the main/NativeScript producer thread. */
@interface HYANativeAudio : NSObject
- (instancetype)initWithSampleRate:(double)sampleRate offline:(BOOL)offline;
@property(nonatomic, readonly) double sampleRate;
@property(nonatomic, readonly) double nowFrame;
@property(nonatomic, readonly) double pendingVoices;
@property(nonatomic, readonly) NSString *state;
@property(nonatomic, readonly) NSString *lastError;
- (BOOL)unlock;
- (BOOL)suspend;
- (BOOL)close;
- (void)decodeBase64:(NSString *)encoded metadataJSON:(NSString *)metadata
         completion:(void (^)(HYANativeAudioBuffer * _Nullable, NSError * _Nullable))completion;
- (NSInteger)scheduleBuffer:(HYANativeAudioBuffer *)buffer token:(double)token requestJSON:(NSString *)request;
- (NSInteger)stopToken:(double)token atFrame:(double)frame;
- (NSInteger)gainToken:(double)token value:(double)value atFrame:(double)frame;
- (NSInteger)rateToken:(double)token value:(double)value atFrame:(double)frame;
- (NSInteger)cancelToken:(double)token;
/** JSON records only; no JavaScript callback is ever installed on the audio render thread. */
- (NSString *)drainCompletions;
/** Actual AVAudioEngine manual/offline output, as base64 interleaved Float32, for device probes. */
- (nullable NSString *)renderOffline:(double)frames;
@end
NS_ASSUME_NONNULL_END
