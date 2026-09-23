#import <UIKit/UIKit.h>
#import <UserMessagingPlatform/UserMessagingPlatform.h>

extern void InstallUMPNetworkObserver(void);

// Simulator-only diagnostic; never included in the game or a store build.
@interface ProbeController : UIViewController
@property(nonatomic, strong) UITextView *output;
@property(nonatomic) BOOL started;
@property(nonatomic) NSTimeInterval startedAt;
@end

@implementation ProbeController
- (void)write:(NSString *)message {
    NSLog(@"[ump-minimal] %@", message);
    self.output.text = [self.output.text stringByAppendingFormat:@"%@\n\n", message];
}
- (void)state:(NSString *)stage {
    UMPConsentInformation *info = UMPConsentInformation.sharedInstance;
    [self write:[NSString stringWithFormat:@"%@ elapsedMs=%.0f consent=%ld form=%ld privacy=%ld canRequestAds=%@ active=%@ attached=%@",
        stage, (NSProcessInfo.processInfo.systemUptime - self.startedAt) * 1000,
        (long)info.consentStatus, (long)info.formStatus, (long)info.privacyOptionsRequirementStatus,
        info.canRequestAds ? @"true" : @"false",
        UIApplication.sharedApplication.applicationState == UIApplicationStateActive ? @"true" : @"false",
        self.view.window ? @"true" : @"false"]];
}
- (void)failure:(NSString *)stage error:(NSError *)error {
    [self write:[NSString stringWithFormat:@"%@ domain=%@ code=%ld description=%@", stage, error.domain, (long)error.code, error.localizedDescription]];
    NSError *underlying = error.userInfo[NSUnderlyingErrorKey];
    if (underlying) [self write:[NSString stringWithFormat:@"underlying domain=%@ code=%ld description=%@", underlying.domain, (long)underlying.code, underlying.localizedDescription]];
}
- (void)viewDidLoad {
    [super viewDidLoad];
    self.view.backgroundColor = UIColor.systemBackgroundColor;
    self.output = [[UITextView alloc] initWithFrame:CGRectZero];
    self.output.editable = NO;
    self.output.font = [UIFont monospacedSystemFontOfSize:15 weight:UIFontWeightRegular];
    self.output.translatesAutoresizingMaskIntoConstraints = NO;
    [self.view addSubview:self.output];
    UILayoutGuide *safe = self.view.safeAreaLayoutGuide;
    [NSLayoutConstraint activateConstraints:@[
        [self.output.leadingAnchor constraintEqualToAnchor:safe.leadingAnchor constant:16],
        [self.output.trailingAnchor constraintEqualToAnchor:safe.trailingAnchor constant:-16],
        [self.output.topAnchor constraintEqualToAnchor:safe.topAnchor constant:16],
        [self.output.bottomAnchor constraintEqualToAnchor:safe.bottomAnchor constant:-16]]];
    [self write:@"Minimal native UMP probe\nNo game, bridge, purchases or ad requests."];
}
- (void)viewDidAppear:(BOOL)animated {
    [super viewDidAppear:animated];
    if (self.started) return;
    self.started = YES;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, NSEC_PER_SEC), dispatch_get_main_queue(), ^{
        [self run];
    });
}
- (void)run {
    self.startedAt = NSProcessInfo.processInfo.systemUptime;
    [self write:[NSString stringWithFormat:@"bundle=%@\nappID=%@\nUMP=%@", NSBundle.mainBundle.bundleIdentifier,
        [NSBundle.mainBundle objectForInfoDictionaryKey:@"GADApplicationIdentifier"], UMPVersionString]];
    UMPConsentInformation *info = UMPConsentInformation.sharedInstance;
    [info reset];
    [self state:@"reset"];
    UMPRequestParameters *parameters = [[UMPRequestParameters alloc] init];
    parameters.tagForUnderAgeOfConsent = NO;
    UMPDebugSettings *debug = [[UMPDebugSettings alloc] init];
    // UMP recognizes simulators as test devices without testDeviceIdentifiers.
    debug.geography = [NSProcessInfo.processInfo.environment[@"UMP_PROBE_OTHER"] isEqualToString:@"1"]
        ? UMPDebugGeographyOther : UMPDebugGeographyEEA;
    parameters.debugSettings = debug;
    [self write:[NSString stringWithFormat:@"simulator=true geography=%ld underAge=%@", (long)debug.geography,
        parameters.tagForUnderAgeOfConsent ? @"true" : @"false"]];
    [info requestConsentInfoUpdateWithParameters:parameters completionHandler:^(NSError *error) {
        if (error) { [self failure:@"update failed" error:error]; [self state:@"failed"]; return; }
        [self state:@"updated"];
        [self write:@"Calling loadAndPresentIfRequired"];
        [UMPConsentForm loadAndPresentIfRequiredFromViewController:self completionHandler:^(NSError *formError) {
            if (formError) [self failure:@"form failed" error:formError];
            [self state:@"completed"];
        }];
    }];
}
@end

@interface ProbeDelegate : UIResponder <UIApplicationDelegate>
@property(nonatomic, strong) UIWindow *window;
@end
@implementation ProbeDelegate
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)options {
    self.window = [[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
    self.window.rootViewController = [[ProbeController alloc] init];
    [self.window makeKeyAndVisible];
    return YES;
}
@end

int main(int argc, char *argv[]) {
    @autoreleasepool {
        InstallUMPNetworkObserver();
        return UIApplicationMain(argc, argv, nil, NSStringFromClass(ProbeDelegate.class));
    }
}
