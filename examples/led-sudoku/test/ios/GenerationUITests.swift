import XCTest

final class GenerationTouchUITests: XCTestCase {
    func testHintWalkthroughUsesNativeEvents() throws {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "org.haiyue.games.ledsudoku")
        app.launchEnvironment["LED_UI_TEST"] = "1"
        app.launch()
        XCTAssertTrue(app.buttons["new"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts["generation-status"].waitForNonExistence(timeout: 20))
        app.buttons["解释"].tap()
        let body = app.staticTexts["lesson-body"]
        XCTAssertTrue(body.waitForExistence(timeout: 5))
        let first = body.label
        XCTAssertTrue(first.contains("候选"))
        app.buttons["lesson-next"].tap()
        XCTAssertNotEqual(body.label, first)
        app.buttons["lesson-previous"].tap()
        XCTAssertEqual(body.label, first)
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name="hint-walkthrough";shot.lifetime = .keepAlways;add(shot)
        app.buttons["lesson-close"].tap()
        XCTAssertTrue(body.waitForNonExistence(timeout: 5))
        app.buttons["new"].tap()
        XCTAssertTrue(app.buttons["rules-cancel"].waitForExistence(timeout: 5))
        app.buttons["rules-cancel"].tap()
    }
    func testNewPuzzleUsesNativeEvents() throws {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "org.haiyue.games.ledsudoku")
        app.launchEnvironment["LED_UI_TEST"] = "1" // Debug-only, isolated save namespace.
        app.launch()
        let newPuzzle = app.buttons["new"]
        XCTAssertTrue(newPuzzle.waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts["generation-status"].waitForNonExistence(timeout: 20))
        newPuzzle.tap()
        let cancel = app.buttons["rules-cancel"]
        XCTAssertTrue(cancel.waitForExistence(timeout: 5))
        app.buttons["挑战"].tap()
        cancel.tap()
        XCTAssertTrue(cancel.waitForNonExistence(timeout: 5), "Cancel must receive a real touch-up")
        newPuzzle.tap()
        let start = app.buttons["rules-start"]
        XCTAssertTrue(start.waitForExistence(timeout: 5))
        app.buttons["挑战"].tap()
        for name in ["温度计", "摩天大楼", "XV 数独", "四数和"] {
            let toggle = app.switches[name]
            for _ in 0..<5 { if toggle.isHittable { break }; app.scrollViews.firstMatch.swipeUp() }
            XCTAssertTrue(toggle.isHittable, name)
            if toggle.value as? String != "1" { toggle.tap() }
        }
        start.tap()
        XCTAssertTrue(start.waitForNonExistence(timeout: 5), "Start must dismiss the whole rules form")
        let status = app.staticTexts["generation-status"]
        XCTAssertTrue(status.waitForExistence(timeout: 2), "The game must show generation progress")
        XCTAssertTrue(status.label.contains("唯一解"))
        // The worker may finish between accessibility snapshots.
        let loading = XCTAttachment(screenshot: app.screenshot());loading.name="generating-on-board";loading.lifetime = .keepAlways;add(loading)
        // NativeScript styles disabled buttons, but XCTest can still report enabled.
        // Observe actual loading completion rather than that accessibility trait.
        XCTAssertTrue(status.waitForNonExistence(timeout: 35), "The generated puzzle must replace the loading message")
        // Reopen to prove difficulty/variant taps changed the actual generated options.
        newPuzzle.tap()
        XCTAssertTrue(start.waitForExistence(timeout: 5))
        let skyline=app.switches["摩天大楼"]
        for _ in 0..<5 { if skyline.isHittable { break }; app.scrollViews.firstMatch.swipeUp() }
        XCTAssertEqual(skyline.value as? String, "1")
        cancel.tap()
        XCTAssertTrue(cancel.waitForNonExistence(timeout: 5))
    }
}
