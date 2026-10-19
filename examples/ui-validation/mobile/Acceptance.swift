import XCTest

final class Acceptance: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.haiyue.uivalidation")
    func capture(_ name: String) {
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = name; shot.lifetime = .keepAlways; add(shot)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = name + "-accessibility-tree"; tree.lifetime = .keepAlways; add(tree)
    }
    func testControls() {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        app.launch()
        let count = app.buttons["/screen/toolbar/increment"]
        XCTAssertTrue(count.waitForExistence(timeout: 30), app.debugDescription)
        count.tap(); capture("01-portrait")
        let status = app.staticTexts["/screen/status"]
        XCTAssertTrue(status.label.contains("点击 1 次"))
        app.buttons["/screen/toolbar/dialog"].tap()
        let close = app.buttons["/screen/modal/close"]
        XCTAssertTrue(close.waitForExistence(timeout: 10), app.debugDescription)
        capture("02-native-modal"); close.tap()
        app.buttons["/screen/toolbar/dialog"].tap()
        XCTAssertTrue(close.waitForExistence(timeout: 10)); close.tap()
        let field = app.textFields["/screen/scroll/body/name/title"]
        field.tap(); field.typeText(" Test")
        capture("03-keyboard-english-only")
        let done = app.buttons["haiyue.keyboard.done"]
        XCTAssertTrue(done.waitForExistence(timeout: 10), app.debugDescription)
        done.tap()
        let hidden = NSPredicate(format: "exists == false")
        expectation(for: hidden, evaluatedWith: done)
        expectation(for: hidden, evaluatedWith: app.keyboards.firstMatch)
        waitForExpectations(timeout: 10)
        XCTAssertTrue((field.value as? String)?.contains("Test") == true)
        // Reopening both single-line and multiline input must retain a dismiss control.
        field.tap(); XCTAssertTrue(done.waitForExistence(timeout: 10)); done.tap()
        let area = app.textViews["/screen/scroll/body/source"]
        area.tap(); XCTAssertTrue(done.waitForExistence(timeout: 10)); done.tap()
        expectation(for: hidden, evaluatedWith: done)
        expectation(for: hidden, evaluatedWith: app.keyboards.firstMatch)
        waitForExpectations(timeout: 10)
        capture("03b-keyboard-dismissed")
        // Synthetic English typing verifies focus/editing only, not real Chinese IME acceptance.
        app.buttons["/screen/toolbar/increment"].tap()
        XCUIDevice.shared.orientation = .landscapeLeft
        sleep(2); capture("04-landscape")
        XCUIDevice.shared.press(.home); sleep(2); app.activate(); sleep(2)
        capture("05-resume")
        XCTAssertTrue(status.label.contains("点击 2 次"))
        XCTAssertTrue((field.value as? String)?.contains("Test") == true)
        XCUIDevice.shared.orientation = .portrait; sleep(1)
        app.buttons["/screen/toolbar/cycles"].tap()
        let finished = NSPredicate(format: "label CONTAINS %@", "50 次清理通过")
        expectation(for: finished, evaluatedWith: status)
        waitForExpectations(timeout: 30)
        // The Done/blur path must commit, not merely leave a native draft that
        // disappears when all input views are recreated.
        XCTAssertTrue((field.value as? String)?.contains("Test") == true)
        capture("06-fifty-cycles")
    }
}
