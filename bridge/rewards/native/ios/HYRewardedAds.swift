import UIKit
import GoogleMobileAds
import UserMessagingPlatform

@MainActor @objc(HYRewardedAds) public final class HYRewardedAds: NSObject, FullScreenContentDelegate {
    private var events: ((String) -> Void)?
    private var ad: RewardedAd?
    private var disposed = false
    private var generation = 0
    private var loading = false
    @objc public var privacyRequired: Bool { ConsentInformation.shared.privacyOptionsRequirementStatus == .required }
    private func root() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        var controller = scenes.flatMap { $0.windows }.first { $0.isKeyWindow }?.rootViewController
        while let presented = controller?.presentedViewController { controller = presented }
        return controller
    }
    private func end(_ event: String) {
        loading = false; generation += 1
        let callback = events; events = nil; ad = nil; callback?(event)
    }
    @objc(perform:unit:events:) public func perform(_ action: String, unit: String, events callback: @escaping (String) -> Void) {
        guard !disposed, events == nil, let controller = root() else { callback("error:unavailable"); return }
        events = callback
        Task { @MainActor in
            if action == "privacy" {
                do {
                    try await ConsentInformation.shared.requestConsentInfoUpdate(with: RequestParameters())
                    guard !disposed else { end("error:unavailable"); return }
                    try await ConsentForm.presentPrivacyOptionsForm(from: controller); end("closed")
                }
                catch { end("error:unavailable") }
                return
            }
            do {
                try await ConsentInformation.shared.requestConsentInfoUpdate(with: RequestParameters())
                try await ConsentForm.loadAndPresentIfRequired(from: controller)
            } catch {
                if !ConsentInformation.shared.canRequestAds { end("error:unavailable"); return }
            }
            guard !disposed, ConsentInformation.shared.canRequestAds else { end("error:unavailable"); return }
            loading = true; generation += 1
            let token = generation
            DispatchQueue.main.asyncAfter(deadline: .now() + 45) { [weak self] in
                guard let self, self.loading, self.generation == token else { return }
                self.end("error:unavailable")
            }
            await MobileAds.shared.start()
            guard loading, token == generation, !disposed else { return }
            do {
                let request = Request()
                let extras = Extras(); extras.additionalParameters = ["npa": "1"]; request.register(extras)
                let loaded = try await RewardedAd.load(with: unit, request: request)
                guard loading, token == generation, !disposed else { return }
                loading = false; ad = loaded; loaded.fullScreenContentDelegate = self
                guard UIApplication.shared.applicationState == .active else { end("error:unavailable"); return }
                self.events?("presenting")
                loaded.present(from: controller) { [weak self] in self?.events?("earned") }
            } catch {
                if token == generation { end((error as NSError).code == 2 ? "error:offline" : "error:unavailable") }
            }
        }
    }
    public func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) { end("closed") }
    public func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) { end("error:unavailable") }
    @objc public func dispose() { disposed = true; if loading { end("error:unavailable") } }
}
