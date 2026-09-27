import XCTest
import StoreKit
import StoreKitTest

/// Executes the unchanged production Swift bridge against Apple's local StoreKit environment.
/// These tests do not contact App Store Connect and are not Sandbox/TestFlight evidence.
final class NativeStoreTests: XCTestCase {
    private let productID = "native_test_full_unlock"

    @MainActor private func session() throws -> SKTestSession {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "Native", withExtension: "storekit"))
        let session = try SKTestSession(contentsOf: url)
        session.resetToDefaultState()
        session.clearTransactions()
        session.disableDialogs = true
        return session
    }
    @MainActor private func call(_ store: HYNonConsumableStore, _ action: String) async throws -> [String: Any] {
        let json: String = await withCheckedContinuation { continuation in
            store.call(action) { continuation.resume(returning: $0) }
        }
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any])
    }
    @MainActor private func access(_ store: HYNonConsumableStore) async throws -> Bool {
        try await call(store, "access")["owned"] as? Bool == true
    }
    @MainActor private func waitForOwnership(_ owned: Bool, _ store: HYNonConsumableStore) async throws {
        for _ in 0..<100 {
            if try await access(store) == owned { return }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTFail("Expected verified ownership = \(owned)")
    }
    @MainActor func testPurchaseRestoreAndBridgeRecreation() async throws {
        let session = try session()
        let store = HYNonConsumableStore(productID: productID, onChange: {})
        defer { store.dispose(); session.clearTransactions() }
        let before = try await access(store)
        XCTAssertFalse(before)
        let product = try await call(store, "product")
        XCTAssertEqual(product["purchasable"] as? Bool, true)
        XCTAssertFalse((product["price"] as? String ?? "").isEmpty)
        let purchase = try await call(store, "purchase")
        XCTAssertEqual(purchase["result"] as? String, "changed")
        try await waitForOwnership(true, store)
        store.dispose()
        let reopened = HYNonConsumableStore(productID: productID, onChange: {})
        defer { reopened.dispose() }
        let restored = try await call(reopened, "restore")
        XCTAssertEqual(restored["owned"] as? Bool, true)
        XCTAssertEqual(session.allTransactions().count, 1)
    }
    @MainActor func testEmptyRestoreDoesNotGrantAccess() async throws {
        let session = try session()
        let store = HYNonConsumableStore(productID: productID, onChange: {})
        defer { store.dispose(); session.clearTransactions() }
        let restored = try await call(store, "restore")
        XCTAssertEqual(restored["owned"] as? Bool, false)
    }
    @MainActor func testPendingApprovalAndRefundNotifyAndRevoke() async throws {
        let session = try session()
        session.askToBuyEnabled = true
        var changes = 0
        let store = HYNonConsumableStore(productID: productID, onChange: { changes += 1 })
        defer { store.dispose(); session.clearTransactions() }
        let pending = try await call(store, "purchase")
        XCTAssertEqual(pending["result"] as? String, "pending")
        let before = try await access(store)
        XCTAssertFalse(before)
        let transaction = try XCTUnwrap(session.allTransactions().first)
        XCTAssertTrue(transaction.pendingAskToBuyConfirmation)
        try session.approveAskToBuyTransaction(identifier: transaction.identifier)
        // Ownership queries and Transaction.updates complete independently.
        // Wait for the notification before querying/finishing pending transactions.
        for _ in 0..<100 where changes == 0 { try await Task.sleep(nanoseconds: 100_000_000) }
        try await waitForOwnership(true, store)
        let afterApproval = changes
        XCTAssertGreaterThan(afterApproval, 0)
        try session.refundTransaction(identifier: transaction.identifier)
        try await waitForOwnership(false, store)
        for _ in 0..<50 where changes <= afterApproval { try await Task.sleep(nanoseconds: 100_000_000) }
        XCTAssertGreaterThan(changes, afterApproval)
        let restored = try await call(store, "restore")
        XCTAssertEqual(restored["owned"] as? Bool, false)
    }
    @MainActor func testPendingDeclineDoesNotGrantAccess() async throws {
        let session = try session()
        session.askToBuyEnabled = true
        let store = HYNonConsumableStore(productID: productID, onChange: {})
        defer { store.dispose(); session.clearTransactions() }
        _ = try await call(store, "purchase")
        let transaction = try XCTUnwrap(session.allTransactions().first)
        try session.declineAskToBuyTransaction(identifier: transaction.identifier)
        let owned = try await access(store)
        XCTAssertFalse(owned)
    }
    @MainActor func testUnfinishedPurchaseRecoveredByNewBridge() async throws {
        let session = try session()
        // No bridge/listener exists while the transaction is delivered.
        let transaction = try await session.buyProduct(identifier: productID)
        // StoreKitTest delivery to the app is asynchronous, including the unfinished queue.
        var unfinishedBefore: [UInt64] = []
        for _ in 0..<100 {
            unfinishedBefore = []
            for await result in Transaction.unfinished {
                if case .verified(let t) = result { unfinishedBefore.append(t.id) }
            }
            if unfinishedBefore.contains(transaction.id) { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertTrue(unfinishedBefore.contains(transaction.id))
        let store = HYNonConsumableStore(productID: productID, onChange: {})
        defer { store.dispose(); session.clearTransactions() }
        let owned = try await access(store)
        XCTAssertTrue(owned)
        var unfinishedAfter: [UInt64] = []
        for await result in Transaction.unfinished {
            if case .verified(let t) = result { unfinishedAfter.append(t.id) }
        }
        XCTAssertFalse(unfinishedAfter.contains(transaction.id))
        XCTAssertEqual(session.allTransactions().count, 1)
    }
    @MainActor func testCancelAndNetworkErrorsDoNotGrantAccess() async throws {
        let session = try session()
        let store = HYNonConsumableStore(productID: productID, onChange: {})
        defer { store.dispose(); session.clearTransactions() }
        try await session.setSimulatedError(.generic(.userCancelled), forAPI: .purchase)
        let cancelled = try await call(store, "purchase")
        XCTAssertEqual(cancelled["result"] as? String, "cancelled")
        let owned = try await access(store)
        XCTAssertFalse(owned)
        try await session.setSimulatedError(.generic(.networkError(URLError(.notConnectedToInternet))), forAPI: .loadProducts)
        let unavailable = try await call(store, "product")
        XCTAssertNotNil(unavailable["error"])
        XCTAssertNil(unavailable["price"])
        // StoreKitTest retains failed/cancelled transaction records as well.
        XCTAssertTrue(session.allTransactions().allSatisfy { $0.state == .failed })
    }
    @MainActor func testDifferentProductAndConsumableCannotUnlock() async throws {
        let session = try session()
        let store = HYNonConsumableStore(productID: productID, onChange: {})
        let wrong = HYNonConsumableStore(productID: "native_test_consumable", onChange: {})
        defer { store.dispose(); wrong.dispose(); session.clearTransactions() }
        _ = try await session.buyProduct(identifier: "native_test_consumable")
        let owned = try await access(store)
        XCTAssertFalse(owned)
        let wrongProduct = try await call(wrong, "product")
        XCTAssertEqual(wrongProduct["error"] as? String, "unavailable")
        let wrongAccess = try await access(wrong)
        XCTAssertFalse(wrongAccess)
    }
    @MainActor func testLocalizedPriceComesFromStoreKit() async throws {
        let session = try session()
        let store = HYNonConsumableStore(productID: productID, onChange: {})
        defer { store.dispose(); session.clearTransactions() }
        var prices: [String] = []
        for (region, locale) in [("USA", "en_US"), ("JPN", "ja_JP"), ("DEU", "de_DE")] {
            session.storefront = region
            session.locale = Locale(identifier: locale)
            let products = try await Product.products(for: [productID])
            let expected = try XCTUnwrap(products.first)
            let actual = try await call(store, "product")
            XCTAssertEqual(actual["price"] as? String, expected.displayPrice)
            prices.append(expected.displayPrice)
        }
        XCTAssertGreaterThan(Set(prices).count, 1)
        print("STOREKIT_LOCALIZED_PRICES \(prices)")
    }
    @MainActor func testUnverifiedPurchaseCannotGrantAccess() async throws {
        let session = try session()
        let store = HYNonConsumableStore(productID: productID, onChange: {})
        defer { store.dispose(); session.clearTransactions() }
        try await session.setSimulatedError(.verification(.invalidSignature), forAPI: .verification)
        let purchase = try await call(store, "purchase")
        XCTAssertEqual(purchase["error"] as? String, "error")
        let current = try await call(store, "access")
        XCTAssertEqual(current["owned"] as? Bool, false)
        XCTAssertEqual(current["revoked"] as? Bool, true)
    }
    @MainActor func testEmptyStoreInventoryDoesNotInheritOldOwnership() async throws {
        let session = try session()
        let store = HYNonConsumableStore(productID: productID, onChange: {})
        defer { store.dispose(); session.clearTransactions() }
        _ = try await call(store, "purchase")
        let before = try await access(store)
        XCTAssertTrue(before)
        // Simulates an empty current inventory, not an actual Apple Account switch.
        session.clearTransactions()
        let restored = try await call(store, "restore")
        XCTAssertEqual(restored["owned"] as? Bool, false)
    }
    @MainActor func testFailedSyncRecoversOnlyVerifiedCurrentOwnership() async throws {
        let session = try session()
        let store = HYNonConsumableStore(productID: productID, onChange: {})
        defer { store.dispose(); session.clearTransactions() }
        _ = try await session.buyProduct(identifier: productID)
        try await session.setSimulatedError(.generic(.unknown), forAPI: .appStoreSync)
        let restored = try await call(store, "restore")
        XCTAssertEqual(restored["owned"] as? Bool, true)
        XCTAssertNil(restored["error"])
        session.clearTransactions()
        let empty = try await call(store, "restore")
        XCTAssertNil(empty["owned"])
        XCTAssertEqual(empty["error"] as? String, "error")
    }
    @MainActor func testFailedSyncCannotBypassVerification() async throws {
        let session = try session()
        let store = HYNonConsumableStore(productID: productID, onChange: {})
        defer { store.dispose(); session.clearTransactions() }
        _ = try await session.buyProduct(identifier: productID)
        try await session.setSimulatedError(.generic(.unknown), forAPI: .appStoreSync)
        try await session.setSimulatedError(.verification(.invalidSignature), forAPI: .verification)
        let restored = try await call(store, "restore")
        XCTAssertEqual(restored["owned"] as? Bool, false)
        XCTAssertEqual(restored["revoked"] as? Bool, true)
    }
    @MainActor func testRestoreNetworkFailureAndCancellationAreDistinct() async throws {
        let session = try session()
        let store = HYNonConsumableStore(productID: productID, onChange: {})
        defer { store.dispose(); session.clearTransactions() }
        try await session.setSimulatedError(.generic(.networkError(URLError(.notConnectedToInternet))), forAPI: .appStoreSync)
        let offline = try await call(store, "restore")
        XCTAssertEqual(offline["error"] as? String, "offline")
        _ = try await session.buyProduct(identifier: productID)
        try await session.setSimulatedError(.generic(.userCancelled), forAPI: .appStoreSync)
        let cancelled = try await call(store, "restore")
        XCTAssertEqual(cancelled["error"] as? String, "cancelled")
        XCTAssertNil(cancelled["owned"])
    }
}
