import XCTest

final class Acceptance: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.haiyue.nativevalidation")
    func capture(_ name: String) {
        let item = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        item.name = name; item.lifetime = .keepAlways; add(item)
    }
    func closeSheet() {
        let close = app.buttons.matching(NSPredicate(format: "label IN %@", ["Close", "关闭", "Cancel", "取消"])).firstMatch
        let dismiss = app.otherElements["PopoverDismissRegion"]
        if close.exists && close.isHittable {
            close.tap()
        } else if dismiss.waitForExistence(timeout: 3) {
            // iOS presents this controller as a popover: use its real outside-tap dismissal.
            let region = dismiss.frame, popover = app.popovers.firstMatch.frame
            let offset = popover.minY > region.height * 0.15
                ? CGVector(dx: 0.5, dy: 0.1) : CGVector(dx: 0.03, dy: 0.5)
            dismiss.coordinate(withNormalizedOffset: offset).tap()
        } else {
            XCTAssertTrue(close.waitForExistence(timeout: 10), "System share close button missing")
            close.tap()
        }
        let result = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "share-result")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 10), "Share promise did not settle")
        XCTAssertTrue(result.label.contains("cancelled"), "Expected cancellation: " + result.label)
    }
    func testShareContent() {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        app.launch()
        let verified = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "verification-passed")).firstMatch
        XCTAssertTrue(verified.waitForExistence(timeout: 60), app.debugDescription)
        capture("card-ready-zh-landscape")
        app.buttons["Share card"].tap(); sleep(2); capture("image-share-sheet"); closeSheet()
        // Reopen immediately; no external recipient is selected.
        app.buttons["Share card"].tap(); sleep(2); capture("image-share-reopened"); closeSheet()
        app.buttons["Share text"].tap(); sleep(2); capture("text-share-sheet"); closeSheet()
        app.buttons["Share text"].tap(); sleep(2); capture("text-share-reopened"); closeSheet()
        app.buttons["Switch language / layout"].tap()
        let ready = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "card-ready")).firstMatch
        XCTAssertTrue(ready.waitForExistence(timeout: 20)); capture("card-ready-en-portrait")
        app.buttons["Share card"].tap(); sleep(2)
        XCUIDevice.shared.orientation = .landscapeLeft; sleep(2); capture("share-landscape")
        XCUIDevice.shared.press(.home); sleep(2); app.activate(); sleep(2); capture("share-resumed")
        closeSheet()
        XCUIDevice.shared.orientation = .portrait
        app.buttons["Verify four variants"].tap()
        XCTAssertTrue(NSPredicate(format: "exists == false").evaluate(with: verified), "Must await a fresh verification result")
        XCTAssertTrue(verified.waitForExistence(timeout: 60)); capture("verified-after-resume")
    }
}
