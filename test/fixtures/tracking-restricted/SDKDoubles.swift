import Foundation

// Test-only SDK boundaries. These do not create real OS restrictions, consent,
// ad requests or rewards. HYRewardedAds itself is compiled without logic edits.
@MainActor enum ATTrackingManager {
    enum AuthorizationStatus { case notDetermined, restricted, denied, authorized }
    static var trackingAuthorizationStatus = AuthorizationStatus.restricted
    static var requests = 0
    static func requestTrackingAuthorization() async {
        requests += 1
        trackingAuthorizationStatus = .restricted
    }
}
@MainActor class UIViewController { var presentedViewController: UIViewController? }
@MainActor class UIWindow {
    var isKeyWindow = true
    var rootViewController: UIViewController? = UIViewController()
}
@MainActor class UIScene {}
@MainActor class UIWindowScene: UIScene { var windows = [UIWindow()] }
@MainActor class UIApplication {
    enum State: Int { case active, inactive, background }
    static let shared = UIApplication()
    var applicationState = State.active
    var connectedScenes: [UIScene] = [UIWindowScene()]
}

enum GADMaxAdContentRating { case general, parentalGuidance, teen, matureAudience }
enum AgeRestrictedTreatment { case unspecified, child, teen }
enum Personalization { case disabled }
@MainActor class RequestConfiguration {
    var maxAdContentRating = GADMaxAdContentRating.general
    var ageRestrictedTreatment = AgeRestrictedTreatment.unspecified
    var publisherPrivacyPersonalizationState = Personalization.disabled
    func setPublisherFirstPartyIDEnabled(_ enabled: Bool) {}
}
@MainActor class MobileAds {
    static let shared = MobileAds()
    let requestConfiguration = RequestConfiguration()
    let versionNumber = (majorVersion: 0, minorVersion: 0, patchVersion: 0)
    var starts = 0
    func start() async { starts += 1 }
}
let GADErrorDomain = "test-only-gma"
@MainActor public protocol FullScreenPresentingAd: AnyObject {}
@MainActor protocol FullScreenContentDelegate: AnyObject {
    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd)
    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error)
}
@MainActor class Extras { var additionalParameters: [String: String] = [:] }
@MainActor class Request {
    var extras: Extras?
    func register(_ value: Extras) { extras = value }
}
@MainActor class RewardedAd: FullScreenPresentingAd {
    static var loads = 0
    static var lastNPA: String?
    weak var fullScreenContentDelegate: FullScreenContentDelegate?
    static func load(with unit: String, request: Request) async throws -> RewardedAd {
        loads += 1
        lastNPA = request.extras?.additionalParameters["npa"]
        return RewardedAd()
    }
    func present(from controller: UIViewController, userDidEarnRewardHandler: () -> Void) {
        userDidEarnRewardHandler()
        fullScreenContentDelegate?.adDidDismissFullScreenContent(self)
    }
}

enum UserMessagingPlatform { static let Version = "test-double" }
@MainActor class DebugSettings {
    enum Geography: Int { case disabled, EEA }
    var testDeviceIdentifiers: [String]? = []
    var geography = Geography.disabled
}
@MainActor class RequestParameters {
    var isTaggedForUnderAgeOfConsent = false
    var debugSettings: DebugSettings?
}
enum ConsentStatus: Int { case unknown, required, notRequired, obtained }
enum FormStatus: Int { case unknown, available, unavailable }
enum PrivacyStatus: Int { case unknown, required, notRequired }
@MainActor class ConsentInformation {
    static let shared = ConsentInformation()
    var consentStatus = ConsentStatus.notRequired
    var formStatus = FormStatus.unavailable
    var privacyOptionsRequirementStatus = PrivacyStatus.notRequired
    var canRequestAds = true
    func reset() {}
    func requestConsentInfoUpdate(with parameters: RequestParameters) async throws {}
}
@MainActor class ConsentForm {
    static var presentations = 0
    static func load() async throws -> ConsentForm { ConsentForm() }
    func present(from controller: UIViewController) async throws {
        Self.presentations += 1
        ConsentInformation.shared.consentStatus = .obtained
    }
    static func presentPrivacyOptionsForm(from controller: UIViewController) async throws {
        presentations += 1
    }
}
