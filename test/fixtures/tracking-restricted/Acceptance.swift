import Foundation

@main struct RestrictedAcceptance {
    @MainActor static func run(_ ads: HYRewardedAds, _ action: String) async -> [String] {
        var events: [String] = []
        await withCheckedContinuation { (finished: CheckedContinuation<Void, Never>) in
            ads.perform(action, unit: "test-only", events: { event in
                events.append(event)
                if event == "presenting" { ads.continuePresentation(true) }
                if event == "closed" || event.hasPrefix("error:") { finished.resume() }
            })
        }
        return events
    }

    @MainActor static func main() async {
        let ads = HYRewardedAds()
        precondition(ads.configurePolicy("""
        {"maxAdContentRating":"G","underAgeOfConsent":false,"ageTreatment":"unspecified","iosTrackingAuthorization":"system"}
        """))
        precondition(ads.trackingAuthorizationStatus == "restricted")

        // Unpaid startup, no regional form: completion without a presentation,
        // ATT call, SDK initialization, ad load, or earned callback.
        let refresh = await run(ads, "refreshPrivacy")
        let startup = await run(ads, "presentConsent")
        precondition(refresh == ["closed"] && startup == ["closed"])
        precondition(ATTrackingManager.requests == 0)
        precondition(MobileAds.shared.starts == 0 && RewardedAd.loads == 0)

        // Repeated startup remains usable and does not retry the system alert.
        let repeated = await run(ads, "presentConsent")
        precondition(repeated == ["closed"] && ATTrackingManager.requests == 0)

        // Restricted ATT does not suppress a required regional consent form.
        ConsentInformation.shared.consentStatus = .required
        let regional = await run(ads, "presentConsent")
        precondition(regional == ["presenting", "presentation-closed", "closed"])
        precondition(ConsentForm.presentations == 1 && ATTrackingManager.requests == 0)
        precondition(MobileAds.shared.starts == 0 && RewardedAd.loads == 0)

        // Restricted is not regional consent or reward entitlement.
        ConsentInformation.shared.canRequestAds = false
        let blocked = await run(ads, "show")
        precondition(blocked.count == 1 && blocked[0].hasPrefix("error:"))
        precondition(blocked[0].contains("consent_unavailable"))
        precondition(MobileAds.shared.starts == 0 && RewardedAd.loads == 0)

        // Explicit ad opt-in can proceed when UMP permits it. Only the SDK's
        // earned callback emits a reward; ATT remains restricted throughout.
        ConsentInformation.shared.consentStatus = .notRequired
        ConsentInformation.shared.canRequestAds = true
        let show = await run(ads, "show")
        precondition(show == ["presenting", "earned", "closed"])
        precondition(MobileAds.shared.starts == 1 && RewardedAd.loads == 1)
        precondition(RewardedAd.lastNPA == "1" && ATTrackingManager.requests == 0)
        precondition(ads.trackingAuthorizationStatus == "restricted")

        // Positive control: prove the request boundary is live for an eligible
        // notDetermined state, including a restriction applied during request.
        ATTrackingManager.trackingAuthorizationStatus = .notDetermined
        let transitioned = await run(ads, "presentConsent")
        precondition(transitioned == ["presenting", "presentation-closed", "closed"])
        precondition(ATTrackingManager.requests == 1)
        precondition(ads.trackingAuthorizationStatus == "restricted")
        ads.dispose()
        print("restricted ATT: 6 scenarios passed")
    }
}
