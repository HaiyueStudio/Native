import XCTest

final class Acceptance: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.haiyue.nativevalidation")
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    func capture(_ name: String) {
        let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        a.name = name; a.lifetime = .keepAlways; add(a)
    }
    func label(_ part: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", part)).firstMatch
    }
    func launch(_ mode: String = "system", reset: Bool = true) {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        if reset { app.resetAuthorizationStatus(for: .userTracking) }
        app.launchEnvironment = ["HY_ATT_MODE": mode]
        app.launch()
        XCTAssertTrue(app.buttons["Read ATT status"].waitForExistence(timeout: 30))
        app.buttons["Read ATT status"].tap()
        XCTAssertTrue(label(reset ? "notDetermined" : "denied").waitForExistence(timeout: 5), app.debugDescription)
    }
    func completed(_ expected: String) {
        XCTAssertTrue(label("completed").waitForExistence(timeout: 35), app.debugDescription)
        XCTAssertTrue(label(expected).exists, app.debugDescription)
    }
    func testPaidStartup() {
        launch(); app.buttons["Paid startup"].tap(); completed("notDetermined"); capture("paid-no-att")
    }
    func testLegacyStartup() {
        launch("legacy"); app.buttons["Unpaid startup"].tap(); completed("notDetermined"); capture("legacy-no-att")
    }
    func testUnderageStartup() {
        launch("underage"); app.buttons["Unpaid startup"].tap(); completed("notDetermined"); capture("underage-no-att")
    }
    func testDeniedAndRelaunch() {
        launch(); app.buttons["Unpaid startup"].tap()
        let alert = springboard.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 35), app.debugDescription)
        capture("att-system-alert")
        let deny = alert.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'not to track' OR label CONTAINS '不跟踪' OR label CONTAINS '不要跟踪'")).firstMatch
        XCTAssertTrue(deny.exists, alert.debugDescription); deny.tap()
        completed("denied"); capture("att-denied")
        app.terminate(); launch(reset: false)
        app.buttons["Unpaid startup"].tap(); completed("denied")
        XCTAssertFalse(springboard.alerts.firstMatch.exists); capture("denied-after-relaunch")
    }
}
