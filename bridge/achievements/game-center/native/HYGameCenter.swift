import Foundation
import GameKit
#if os(macOS)
import AppKit
#else
import UIKit
#endif

// One owner per process. All state, GameKit calls and presentation run on the UI thread.
@objc(HYGameCenterBridge) public final class HYGameCenterBridge: NSObject, GKGameCenterControllerDelegate {
    private static weak var owner: HYGameCenterBridge?
    private var active = false
    private var generation = 0
    private var lifetime = 0
    private var identity = ""
    private var authenticating = false
    private var events: [[String: Any]] = []
    private var pending: [Int: Int] = [:]
    private var observer: NSObjectProtocol?
    private var controller: GKGameCenterViewController?
    private func json(_ value: Any) -> String { String(data: try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]), encoding: .utf8)! }
    private func refresh() {
        precondition(Thread.isMainThread)
        let next = active && GKLocalPlayer.local.isAuthenticated ? GKLocalPlayer.local.gamePlayerID : ""
        if next != identity { identity = next; generation += 1 }
    }
    @objc public func start(_ bundleId: String) {
        precondition(Thread.isMainThread)
        guard !active, Self.owner == nil, Bundle.main.bundleIdentifier == bundleId else { return }
        Self.owner = self; active = true; authenticating = true; generation += 1; lifetime += 1
        let ownerGeneration = lifetime
        observer = NotificationCenter.default.addObserver(forName: .GKPlayerAuthenticationDidChangeNotificationName, object: nil, queue: .main) { [weak self] _ in self?.refresh() }
        GKLocalPlayer.local.authenticateHandler = { [weak self] view, error in
            DispatchQueue.main.async {
                guard let self = self, self.active, self.lifetime == ownerGeneration else { return }
                self.authenticating = view != nil; self.refresh()
                if let view = view { if !self.present(view) { self.authenticating = false } }
                // Cancelled authentication leaves guest gameplay usable. The handler remains for later account changes.
                if error != nil { self.authenticating = false }
            }
        }
    }
    @objc public func session() -> String {
        refresh()
        if !active { return json(["state": "unavailable"]) }
        if !identity.isEmpty { return json(["state": "ready", "playerId": identity]) }
        return json(["state": authenticating ? "authenticating" : "guest"])
    }
    @objc public func poll() -> String { precondition(Thread.isMainThread); let result = json(events); events.removeAll(); return result }
    private func valid(_ player: String, _ epoch: Int) -> Bool { refresh(); return active && generation == epoch && !player.isEmpty && identity == player }
    private func finish(_ id: Int, _ player: String, _ epoch: Int, value: Any = NSNull(), error: Error? = nil) {
        precondition(Thread.isMainThread)
        guard active, pending[id] == epoch else { return }
        pending.removeValue(forKey: id)
        var result: [String: Any] = ["id": id]
        if !valid(player, epoch) { result["error"] = "session-changed" }
        else if let error = error as NSError? {
            result["error"] = "gamekit-\(error.domain)-\(error.code)"
            result["retryable"] = error.domain == NSURLErrorDomain || (error.domain == GKErrorDomain && [GKError.Code.communicationsFailure.rawValue, GKError.Code.unknown.rawValue].contains(error.code))
        } else { result["value"] = value }
        events.append(result)
    }
    @objc public func request(_ text: String) -> Bool {
        precondition(Thread.isMainThread); refresh()
        guard active, pending.count + events.count < 32, text.utf8.count <= 262144,
              let data = text.data(using: .utf8), let q = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let id = q["id"] as? Int, pending[id] == nil, let player = q["playerId"] as? String,
              let operation = q["operation"] as? String else { return false }
        let epoch = generation; pending[id] = epoch
        guard valid(player, epoch) else { finish(id, player, epoch); return true }
        if operation == "load" {
            GKAchievement.loadAchievements { [weak self] rows, error in
                DispatchQueue.main.async { self?.finish(id, player, epoch, value: (rows ?? []).map { ["achievementId": $0.identifier, "percent": $0.percentComplete] }, error: error) }
            }
        } else if operation == "report", let progress = q["progress"] as? [[String: Any]], progress.count <= 1000 {
            var achievements: [GKAchievement] = []
            for p in progress {
                guard let key = p["achievementId"] as? String, !key.isEmpty, key.utf8.count <= 100,
                      let percent = p["percent"] as? Double, percent.isFinite, percent >= 0, percent <= 100 else {
                    finish(id, player, epoch, error: NSError(domain: "Haiyue", code: 1)); return true
                }
                let a = GKAchievement(identifier: key, player: GKLocalPlayer.local)
                a.percentComplete = percent; a.showsCompletionBanner = false; achievements.append(a)
            }
            guard valid(player, epoch) else { finish(id, player, epoch); return true }
            GKAchievement.report(achievements) { [weak self] error in DispatchQueue.main.async { self?.finish(id, player, epoch, error: error) } }
        } else if operation == "show", controller == nil {
            let view = GKGameCenterViewController(state: .achievements); view.gameCenterDelegate = self
            if present(view) { controller = view; finish(id, player, epoch) }
            else { finish(id, player, epoch, error: NSError(domain: "Haiyue", code: 2)) }
        } else { finish(id, player, epoch, error: NSError(domain: "Haiyue", code: 3)) }
        return true
    }
    #if os(macOS)
    private func present(_ view: NSViewController) -> Bool {
        guard let window = NSApplication.shared.keyWindow else { return false }
        if window.contentViewController == nil { let root = NSViewController(); root.view = window.contentView!; window.contentViewController = root }
        guard let parent = window.contentViewController else { return false }; parent.presentAsSheet(view); return true
    }
    #else
    private func present(_ view: UIViewController) -> Bool {
        guard var parent = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).flatMap({ $0.windows }).first(where: { $0.isKeyWindow })?.rootViewController else { return false }
        while let next = parent.presentedViewController { parent = next }
        parent.present(view, animated: true); return true
    }
    #endif
    public func gameCenterViewControllerDidFinish(_ view: GKGameCenterViewController) {
        #if os(macOS)
        view.dismiss(nil)
        #else
        view.dismiss(animated: true)
        #endif
        controller = nil
    }
    @objc public func stop() {
        precondition(Thread.isMainThread); guard active else { return }
        if let view = controller { gameCenterViewControllerDidFinish(view) }
        if let observer = observer { NotificationCenter.default.removeObserver(observer) }; observer = nil
        GKLocalPlayer.local.authenticateHandler = nil; active = false; generation += 1; lifetime += 1; identity = ""; pending.removeAll(); events.removeAll(); Self.owner = nil
    }
}
