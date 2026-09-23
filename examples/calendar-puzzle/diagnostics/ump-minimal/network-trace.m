#import <Foundation/Foundation.h>
#import <objc/runtime.h>
#import <TargetConditionals.h>

#if !TARGET_OS_SIMULATOR
#error This network observer is for the isolated simulator probe only.
#endif

// Observe the SDK's URLSession request and completion without modifying either.
// No proxy, trust changes, TLS bypass, replay or consent-state writes.
static id Redact(id value) {
    if ([value isKindOfClass:NSDictionary.class]) {
        NSMutableDictionary *result = [NSMutableDictionary dictionary];
        NSSet *privateKeys = [NSSet setWithArray:@[@"device_id", @"device_identifier", @"advertising_id", @"idfa", @"idfv",
            @"consent_sync_id", @"stored_infos", @"stored_info", @"stored_infos_map", @"cookie", @"set-cookie", @"authorization",
            @"consent_string", @"tc_string", @"iabtcf_tcstring", @"request_id", @"session_id", @"token",
            @"client_side_pingback_url", @"consent_form_payload"]];
        for (NSString *key in value) {
            result[key] = [privateKeys containsObject:key.lowercaseString] ? @"[redacted]" : Redact(value[key]);
        }
        return result;
    }
    if ([value isKindOfClass:NSArray.class]) {
        NSMutableArray *result = [NSMutableArray array];
        for (id item in value) [result addObject:Redact(item)];
        return result;
    }
    if ([value isKindOfClass:NSString.class] && ([value hasPrefix:@"{"] || [value hasPrefix:@"["])) {
        id nested = [NSJSONSerialization JSONObjectWithData:[value dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
        if (nested) return Redact(nested);
    }
    return value ?: NSNull.null;
}

static id Body(NSData *data) {
    if (!data.length) return NSNull.null;
    id json = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingFragmentsAllowed error:nil];
    if (json) return Redact(json);
    // Google's JSON APIs may prepend an anti-XSSI line. Strip it for logging only;
    // the original response bytes still go unchanged to the SDK completion.
    NSString *text = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    if ([text hasPrefix:@")]}'"]) {
        NSRange newline = [text rangeOfString:@"\n"];
        if (newline.location != NSNotFound) {
            NSData *payload = [[text substringFromIndex:NSMaxRange(newline)] dataUsingEncoding:NSUTF8StringEncoding];
            id stripped = [NSJSONSerialization JSONObjectWithData:payload options:NSJSONReadingFragmentsAllowed error:nil];
            if (stripped) return @{ @"antiXSSIPrefix": @YES, @"json": Redact(stripped) };
        }
    }
    // Never dump arbitrary HTML or binary payloads.
    return @{ @"nonJSONBytes": @(data.length) };
}

static void Record(NSDictionary *event) {
    static NSObject *lock;
    static dispatch_once_t once;
    dispatch_once(&once, ^{ lock = [NSObject new]; });
    @synchronized(lock) {
        NSMutableDictionary *record = [event mutableCopy];
        record[@"timestamp"] = @([[NSDate date] timeIntervalSince1970]);
        NSData *json = [NSJSONSerialization dataWithJSONObject:record options:NSJSONWritingSortedKeys error:nil];
        if (!json) return;
        NSString *line = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
        NSLog(@"[ump-network] %@", line);
        NSString *directory = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
        NSString *file = [directory stringByAppendingPathComponent:@"ump-network.jsonl"];
        if (![NSFileManager.defaultManager fileExistsAtPath:file]) [NSFileManager.defaultManager createFileAtPath:file contents:nil attributes:nil];
        NSFileHandle *handle = [NSFileHandle fileHandleForWritingAtPath:file];
        [handle seekToEndOfFile];
        [handle writeData:[[line stringByAppendingString:@"\n"] dataUsingEncoding:NSUTF8StringEncoding]];
        [handle closeFile];
    }
}

typedef void (^Completion)(NSData *, NSURLResponse *, NSError *);
typedef NSURLSessionDataTask *(*DataTaskIMP)(id, SEL, NSURLRequest *, Completion);
static DataTaskIMP OriginalDataTask;
static NSURLSessionDataTask *ObservedTask(id session, SEL selector, NSURLRequest *request, Completion completion) {
    NSString *host = request.URL.host.lowercaseString ?: @"";
    BOOL google = [host isEqualToString:@"google.com"] || [host hasSuffix:@".google.com"];
    if (!google) return OriginalDataTask(session, selector, request, completion);
    NSString *requestKey = NSUUID.UUID.UUIDString;
    NSString *endpoint = [NSString stringWithFormat:@"%@://%@%@", request.URL.scheme, host, request.URL.path];
    // requestKey is a locally generated correlation ID, not a device ID.
    Record(@{ @"event": @"request", @"correlation": requestKey, @"endpoint": endpoint,
        @"method": request.HTTPMethod ?: @"GET", @"body": Body(request.HTTPBody),
        @"hasBodyStream": @(request.HTTPBodyStream != nil),
        @"contentType": [request valueForHTTPHeaderField:@"Content-Type"] ?: @"" });
    NSTimeInterval started = NSProcessInfo.processInfo.systemUptime;
    return OriginalDataTask(session, selector, request, ^(NSData *data, NSURLResponse *response, NSError *error) {
        NSHTTPURLResponse *http = [response isKindOfClass:NSHTTPURLResponse.class] ? (NSHTTPURLResponse *)response : nil;
        NSMutableDictionary *headers = [NSMutableDictionary dictionary];
        for (NSString *key in http.allHeaderFields) {
            NSString *name = key.lowercaseString;
            if ([@[@"content-type", @"date", @"server", @"cache-control", @"content-encoding"] containsObject:name] || [name hasPrefix:@"x-ump-"])
                headers[key] = Redact(http.allHeaderFields[key]);
        }
        Record(@{ @"event": @"response", @"correlation": requestKey, @"endpoint": endpoint,
            @"status": @(http.statusCode), @"elapsedMs": @((NSProcessInfo.processInfo.systemUptime - started) * 1000),
            @"headers": headers, @"body": Body(data),
            @"error": error ? @{ @"domain": error.domain, @"code": @(error.code), @"description": error.localizedDescription } : NSNull.null });
        if (completion) completion(data, response, error);
    });
}

void InstallUMPNetworkObserver(void) {
    if (![NSProcessInfo.processInfo.environment[@"UMP_PROBE_TRACE"] isEqualToString:@"1"]) return;
    Class concrete = object_getClass(NSURLSession.sharedSession);
    SEL selector = @selector(dataTaskWithRequest:completionHandler:);
    Method method = class_getInstanceMethod(concrete, selector);
    OriginalDataTask = (DataTaskIMP)method_getImplementation(method);
    class_replaceMethod(concrete, selector, (IMP)ObservedTask, method_getTypeEncoding(method));
    Record(@{ @"event": @"observer-installed", @"sessionClass": NSStringFromClass(concrete) });
}
