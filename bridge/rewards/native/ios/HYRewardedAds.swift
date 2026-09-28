import UIKit
import GoogleMobileAds
import UserMessagingPlatform

@MainActor @objc(HYRewardedAds) public final class HYRewardedAds: NSObject, FullScreenContentDelegate {
    private static var processPolicy: String?
    private var underAgeOfConsent = false
    private var configured = false
    /// SDK-wide settings are fixed by the first gateway; conflicting instances fail closed.
    @objc public func configurePolicy(_ json: String) -> Bool {
        guard !disposed, events == nil, let data = json.data(using: .utf8),
              let value = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let rating = value["maxAdContentRating"] as? String,
              let underAge = value["underAgeOfConsent"] as? Bool else { return false }
        let ratings: [String: GADMaxAdContentRating] = ["G": .general, "PG": .parentalGuidance, "T": .teen, "MA": .matureAudience]
        guard let maximum = ratings[rating] else { return false }
        let treatments: [String: AgeRestrictedTreatment] = ["unspecified": .unspecified, "child": .child, "teen": .teen]
        guard let treatment = value["ageTreatment"] as? String, let age = treatments[treatment] else { return false }
        let key = "\(rating):\(underAge):\(treatment)"
        if let existing = Self.processPolicy, existing != key { return false }
        let config = MobileAds.shared.requestConfiguration
        config.setPublisherFirstPartyIDEnabled(false)
        config.publisherPrivacyPersonalizationState = .disabled
        config.maxAdContentRating = maximum
        config.ageRestrictedTreatment = age
        underAgeOfConsent = underAge
        Self.processPolicy = key; configured = true
        return true
    }
    private var events: ((String) -> Void)?
    private var ad: RewardedAd?
    private var disposed = false
    private var generation = 0
    private var timeout: Task<Void, Never>?
    private var presentation: CheckedContinuation<Bool, Never>?
    private var startedAt = ProcessInfo.processInfo.systemUptime
    @objc public var privacyRequired: Bool { ConsentInformation.shared.privacyOptionsRequirementStatus == .required }
    @objc public var consentRequired: Bool { ConsentInformation.shared.consentStatus == .required }
    private var development: Bool { Bundle.main.object(forInfoDictionaryKey: "HYBuildConfiguration") as? String == "Debug" }
    private func log(_ text: String) { if development { NSLog("[haiyue-consent] %@", text) } }
    private var simulator: Bool {
        #if targetEnvironment(simulator)
        return true
        #else
        return false
        #endif
    }
    private func logState(_ stage: String) {
        guard development else { return }
        let info = ConsentInformation.shared
        let elapsed = Int((ProcessInfo.processInfo.systemUptime - startedAt) * 1000)
        log("\(stage) elapsedMs=\(elapsed) consent=\(info.consentStatus) status=\(info.consentStatus.rawValue) form=\(info.formStatus) formStatus=\(info.formStatus.rawValue) privacyStatus=\(info.privacyOptionsRequirementStatus.rawValue) canRequestAds=\(info.canRequestAds) appState=\(UIApplication.shared.applicationState.rawValue)")
    }
    private func logError(_ stage: String, _ error: Error) {
        guard development else { return }
        let failure = error as NSError
        // Do not dump userInfo, consent strings, identifiers or network payloads.
        log("\(stage) domain=\(failure.domain) code=\(failure.code) description=\(failure.localizedDescription)")
        if let underlying = failure.userInfo[NSUnderlyingErrorKey] as? NSError {
            log("\(stage) underlyingDomain=\(underlying.domain) underlyingCode=\(underlying.code) description=\(underlying.localizedDescription)")
        }
        logState("\(stage) state")
    }
    private var stage = "configuration"
    /// Suffix preserves the legacy error:phase protocol. Never serialize userInfo/messages.
    private func failureEvent(_ stage: String, _ code: String, _ error: Error? = nil) -> String {
        var reason = code
        var phase = "unavailable"
        var details: [String: Any] = ["stage": stage]
        if let error {
            let native = error as NSError
            details["sdk"] = ["domain": native.domain, "code": native.code]
            if let cause = native.userInfo[NSUnderlyingErrorKey] as? NSError {
                details["underlying"] = ["domain": cause.domain, "code": cause.code]
            }
            // Numeric codes are meaningful only in their SDK domain and operation.
            if stage == "ad_load" && native.domain == GADErrorDomain {
                switch native.code {
                case 1: reason = "no_fill"
                case 2: reason = "network"; phase = "offline"
                case 5: reason = "timeout"
                default: break
                }
            }
        }
        details["code"] = reason
        let data = try? JSONSerialization.data(withJSONObject: details)
        let json = data.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        return "error:\(phase):\(json)"
    }
    private func fail(_ code: String, _ error: Error? = nil) { end(failureEvent(stage, code, error)) }
    private func root() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        var controller = scenes.flatMap { $0.windows }.first { $0.isKeyWindow }?.rootViewController
        while let presented = controller?.presentedViewController { controller = presented }
        return controller
    }
    private func active(_ token: Int) -> Bool { !disposed && events != nil && token == generation }
    private func end(_ event: String) {
        logState("end event=\(event)")
        timeout?.cancel(); timeout = nil; generation += 1
        let pending = presentation; presentation = nil; pending?.resume(returning: false)
        let callback = events; events = nil; ad = nil; callback?(event)
    }
    @objc public func continuePresentation(_ ready: Bool) {
        let pending = presentation; presentation = nil
        pending?.resume(returning: ready && !disposed && UIApplication.shared.applicationState == .active)
    }
    private func preparePresentation(_ token: Int) async -> Bool {
        guard active(token) else { return false }
        return await withCheckedContinuation { continuation in
            presentation = continuation
            events?("presenting")
        }
    }
    private func deadline(_ seconds: UInt64, token: Int) {
        timeout?.cancel()
        timeout = Task { @MainActor [weak self] in
            do { try await Task.sleep(nanoseconds: seconds * 1_000_000_000) } catch { return }
            guard let self, self.active(token) else { return }
            self.log("network timeout"); self.fail("timeout")
        }
    }
    private func parameters() -> RequestParameters {
        let parameters = RequestParameters()
        parameters.isTaggedForUnderAgeOfConsent = underAgeOfConsent
        // Explicit device-scoped diagnostics only; never applied in a Release binary.
        let device = ProcessInfo.processInfo.environment["HY_UMP_TEST_DEVICE_ID"] ?? ""
        if development && (simulator || !device.isEmpty) {
            let debug = DebugSettings()
            debug.testDeviceIdentifiers = device.isEmpty ? [] : [device]
            if ProcessInfo.processInfo.environment["HY_UMP_EEA"] == "1" { debug.geography = .EEA }
            parameters.debugSettings = debug
        }
        log("parameters simulator=\(simulator) registeredTestDeviceCount=\(parameters.debugSettings?.testDeviceIdentifiers?.count ?? 0) geography=\(parameters.debugSettings?.geography.rawValue ?? 0) underAge=\(parameters.isTaggedForUnderAgeOfConsent)")
        return parameters
    }
    @objc(perform:unit:events:) public func perform(_ action: String, unit: String, events callback: @escaping (String) -> Void) {
        guard configured else { callback(failureEvent("configuration", "policy_rejected")); return }
        guard !disposed else { callback(failureEvent("lifecycle", "disposed")); return }
        guard events == nil else { callback(failureEvent("lifecycle", "busy")); return }
        guard let controller = root() else { callback(failureEvent("lifecycle", "no_presenter")); return }
        guard ["consent", "refreshPrivacy", "presentConsent", "privacy", "show"].contains(action) else { callback(failureEvent("configuration", "invalid_action")); return }
        events = callback; generation += 1
        startedAt = ProcessInfo.processInfo.systemUptime
        let token = generation
        if development && ["consent", "refreshPrivacy"].contains(action) && ProcessInfo.processInfo.environment["HY_UMP_RESET"] == "1" {
            ConsentInformation.shared.reset()
            log("reset test consent")
        }
        Task { @MainActor in
            guard active(token) else { return }
            let appID = Bundle.main.object(forInfoDictionaryKey: "GADApplicationIdentifier") as? String ?? "missing"
            let adsVersion = MobileAds.shared.versionNumber
            log("begin \(action) bundle=\(Bundle.main.bundleIdentifier ?? "missing") appID=\(appID) ump=\(UserMessagingPlatform.Version) gma=\(adsVersion.majorVersion).\(adsVersion.minorVersion).\(adsVersion.patchVersion) simulator=\(simulator)")
            logState("before update")
            // Startup already refreshed consent with input active. Do not repeat
            // that network request after acquiring the form-presentation pause.
            if action != "presentConsent" {
                stage = "consent_update"
                deadline(20, token: token)
                do {
                    try await ConsentInformation.shared.requestConsentInfoUpdate(with: parameters())
                } catch {
                    logError("update failed", error)
                    guard active(token) else { return }
                    // Only the ad path may fall back to a still-valid previous consent state.
                    if action != "show" || !ConsentInformation.shared.canRequestAds { fail("sdk_error", error); return }
                }
            }
            guard active(token) else { return }
            timeout?.cancel(); timeout = nil
            logState("updated")
            if action == "refreshPrivacy" { end("closed"); return }
            guard UIApplication.shared.applicationState == .active else { fail("inactive"); return }
            do {
                // No timeout while a user is reading or interacting with the consent form.
                if action == "privacy" {
                    stage = "privacy_present"
                    guard privacyRequired else { end("closed"); return }
                    guard await preparePresentation(token), active(token) else { if active(token) { fail("presentation_rejected") }; return }
                    try await ConsentForm.presentPrivacyOptionsForm(from: controller)
                    events?("presentation-closed")
                } else if consentRequired {
                    // Load while the game's loading indicator is still animating.
                    stage = "consent_load"
                    deadline(20, token: token)
                    let form = try await ConsentForm.load()
                    guard active(token) else { return }
                    timeout?.cancel(); timeout = nil
                    stage = "consent_present"
                    guard await preparePresentation(token), active(token) else { if active(token) { fail("presentation_rejected") }; return }
                    try await form.present(from: controller)
                    events?("presentation-closed")
                }
            } catch {
                logError("form failed", error)
                guard active(token) else { return }
                fail("sdk_error", error); return
            }
            guard active(token) else { return }
            logState("completed \(action)")
            if action != "show" { end("closed"); return }
            guard ConsentInformation.shared.canRequestAds else { fail("consent_unavailable"); return }
            stage = "sdk_initialize"
            deadline(45, token: token)
            await MobileAds.shared.start()
            guard active(token) else { return }
            do {
                stage = "ad_load"
                let request = Request()
                let extras = Extras(); extras.additionalParameters = ["npa": "1"]; request.register(extras)
                let loaded = try await RewardedAd.load(with: unit, request: request)
                guard active(token) else { return }
                timeout?.cancel(); timeout = nil
                stage = "ad_present"
                ad = loaded; loaded.fullScreenContentDelegate = self
                guard UIApplication.shared.applicationState == .active else { fail("inactive"); return }
                guard await preparePresentation(token), active(token) else { if active(token) { fail("presentation_rejected") }; return }
                loaded.present(from: controller) { [weak self] in
                    guard let self, self.active(token) else { return }
                    self.events?("earned")
                }
            } catch {
                logError("ad failed", error)
                if active(token) { fail("sdk_error", error) }
            }
        }
    }
    public func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) { if self.ad === ad { end("closed") } }
    public func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) { if self.ad === ad { fail("sdk_error", error) } }
    @objc public func dispose() { disposed = true; stage = "lifecycle"; fail("disposed") }
}
