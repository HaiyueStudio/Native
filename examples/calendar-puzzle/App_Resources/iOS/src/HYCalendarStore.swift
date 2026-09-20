import Foundation
import StoreKit

/// ObjC-visible boundary for NativeScript; validation stays inside StoreKit 2.
@objc(HYCalendarStore)
public final class HYCalendarStore: NSObject {
    private let productID: String
    private var changes: (() -> Void)?
    private var updates: Task<Void, Never>?
    private var closed = false
    private var purchasing = false

    @objc public init(productID: String, onChange: @escaping () -> Void) {
        self.productID = productID
        self.changes = onChange
        super.init()
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self, !self.closed else { return }
                guard case .verified(let transaction) = result, transaction.productID == self.productID else { continue }
                // Non-consumables remain in currentEntitlements after finish.
                await transaction.finish()
                await MainActor.run { self.changes?() }
            }
        }
    }
    private func product() async throws -> Product {
        guard let product = try await Product.products(for: [productID]).first,
              product.id == productID, product.type == .nonConsumable else { throw StoreError.unavailable }
        return product
    }
    private enum StoreError: Error { case unavailable, verification }
    @objc public func call(_ action: String, completion: @escaping (String) -> Void) {
        Task { @MainActor in
            guard !closed else { return }
            var response: [String: Any]
            do {
                switch action {
                case "product":
                    let p = try await product()
                    response = ["price": p.displayPrice, "purchasable": AppStore.canMakePayments]
                case "purchase":
                    guard !purchasing else { throw StoreError.unavailable }
                    purchasing = true
                    defer { purchasing = false }
                    switch try await product().purchase() {
                    case .success(let result):
                        guard case .verified(let transaction) = result,
                              transaction.productID == productID,
                              transaction.productType == .nonConsumable else { throw StoreError.verification }
                        await transaction.finish()
                        response = ["result": "changed"]
                    case .userCancelled: response = ["result": "cancelled"]
                    case .pending: response = ["result": "pending"]
                    @unknown default: throw StoreError.unavailable
                    }
                case "access", "restore":
                    // sync can display authentication UI, so only use it after
                    // the player's explicit Restore tap, never during startup.
                    if action == "restore" { try await AppStore.sync() }
                    var owned = false
                    for await result in Transaction.currentEntitlements {
                        switch result {
                        case .verified(let t):
                            if t.productID == productID && t.productType == .nonConsumable && t.revocationDate == nil && !t.isUpgraded { owned = true }
                        case .unverified(let t, _):
                            if t.productID == productID { throw StoreError.verification }
                        }
                    }
                    // Recover a purchase delivered before process termination.
                    for await result in Transaction.unfinished {
                        if case .verified(let t) = result, t.productID == productID { await t.finish() }
                    }
                    response = ["owned": owned]
                default: throw StoreError.unavailable
                }
            } catch StoreError.verification { response = action == "access" || action == "restore" ? ["owned": false, "revoked": true] : ["error": "error"]
            } catch StoreError.unavailable { response = ["error": "unavailable"]
            } catch {
                let ns = error as NSError
                if ns.domain == NSURLErrorDomain { response = ["error": "offline"] }
                else if let sk = error as? StoreKitError, case .userCancelled = sk { response = ["result": "cancelled", "error": "cancelled"] }
                else { response = ["error": "unavailable"] }
            }
            guard !closed else { return }
            let data = (try? JSONSerialization.data(withJSONObject: response)) ?? Data("{\"error\":\"error\"}".utf8)
            completion(String(decoding: data, as: UTF8.self))
        }
    }
    @objc public func dispose() { closed = true; changes = nil; updates?.cancel(); updates = nil }
}
