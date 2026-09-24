import XCTest

final class Acceptance: XCTestCase {
    func launch(_ id: String, env: [String:String] = [:]) -> XCUIApplication {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: id)
        app.launchEnvironment = env
        app.launch()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 30))
        sleep(8)
        return app
    }
    func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
    func lifecycle(_ app: XCUIApplication, _ name: String) {
        capture(name + "-before-background")
        XCUIDevice.shared.press(.home)
        sleep(2)
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 15))
        sleep(4)
        XCTAssertEqual(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "初始化或渲染失败")).count, 0)
        capture(name + "-resumed")
    }
    func testPbrOrbit() {
        let app = launch("org.haiyue.native.iospbrorbit", env: ["G04_CAPTURE_FRAME":"1", "G04_DIAGNOSTICS":"1"])
        capture("pbr-initial")
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.72, dy: 0.6))
        start.press(forDuration: 0.1, thenDragTo: end)
        sleep(3)
        capture("pbr-rotated")
        lifecycle(app, "pbr")
    }
    func testNeonLifecycle() {
        let app = launch("org.haiyue.native.neoncircuit")
        lifecycle(app, "neon")
    }
    func testRangeLifecycle() {
        let app = launch("org.haiyue.native.ak47range")
        lifecycle(app, "range")
    }
    func testSpiderLifecycle() {
        let app = launch("org.haiyue.native.spidersolitaire", env: ["SPIDER_CAPTURE_FRAME":"1"])
        capture("spider-initial")
        func button(_ index: CGFloat) {
            let width = app.frame.width
            let total = min(740.0, width - 146.0)
            let buttonWidth = (total - 40.0) / 6.0
            let x = (width-total)/2 + index*(buttonWidth+8) + buttonWidth/2
            app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx:x,dy:30)).tap()
            sleep(3)
        }
        button(3)
        capture("spider-dealt")
        button(4)
        capture("spider-undone")
        button(1)
        capture("spider-normal")
        button(2)
        capture("spider-hard")
        button(0)
        capture("spider-easy")
        lifecycle(app, "spider")
    }
    func testSkyLifecycle() {
        let app = launch("org.haiyue.native.skystrike", env: ["SKY_CAPTURE_FRAME":"1"])
        capture("sky-menu")
        let width = app.frame.width, height = app.frame.height
        func tap(_ x: CGFloat,_ y: CGFloat) { app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx:x,dy:y)).tap() }
        let panelHeight = min(720.0,height-36.0)
        tap(width/2,(height-panelHeight)/2+panelHeight*0.91)
        sleep(4)
        capture("sky-playing")
        app.coordinate(withNormalizedOffset: CGVector(dx:0.5,dy:0.7)).press(forDuration:1,thenDragTo:app.coordinate(withNormalizedOffset: CGVector(dx:0.7,dy:0.6)))
        sleep(3)
        capture("sky-firing")
        tap(width-55,height-75)
        sleep(2)
        capture("sky-paused")
        lifecycle(app, "sky")
    }
    func testCubeOrientations() {
        XCUIDevice.shared.orientation = .portrait
        let app = launch("org.haiyue.native.rubikscube", env: ["CUBE_CAPTURE_FRAME":"1"])
        capture("cube-portrait")
        func tap(_ x: CGFloat, _ y: CGFloat) {
            app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx:x,dy:y)).tap()
        }
        let width = app.frame.width, height = app.frame.height
        let canvasHeight = height - 93
        let panelY = canvasHeight - 228
        for index in 0..<4 {
            let x = 12 + CGFloat(index % 2) * (width - 14)/2 + (width - 34)/4
            tap(x, 59 + panelY + 48 + CGFloat(index / 2)*85)
            sleep(3)
            capture("cube-\(index)-selected")
            tap(width-44,90)
            sleep(10)
            capture("cube-\(index)-shuffled")
            tap(width/2,59+panelY+180)
            sleep(10)
            capture("cube-\(index)-restored")
            tap(43,90)
            sleep(2)
        }
        XCUIDevice.shared.orientation = .landscapeLeft
        sleep(5)
        capture("cube-landscape")
        lifecycle(app, "cube")
        XCUIDevice.shared.orientation = .portrait
    }
    func testSpiderDragSave() {
        let app = launch("org.haiyue.native.spidersolitaire")
        capture("spider-save-before")
        func point(_ x: CGFloat,_ y: CGFloat) -> XCUICoordinate { app.coordinate(withNormalizedOffset: CGVector(dx:x,dy:y)) }
        point(0.195,0.50).press(forDuration:0.15,thenDragTo:point(0.730,0.47))
        sleep(3)
        capture("spider-invalid-drop")
        point(0.265,0.50).press(forDuration:0.15,thenDragTo:point(0.730,0.47))
        sleep(3)
        capture("spider-legal-drop")
        app.terminate()
        app.launch()
        sleep(8)
        capture("spider-save-reloaded")
    }
    func testCubeDragUndo() {
        XCUIDevice.shared.orientation = .portrait
        let app = launch("org.haiyue.native.rubikscube")
        func point(_ x: CGFloat,_ y: CGFloat) -> XCUICoordinate { app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx:x,dy:y)) }
        point(310,718).tap()
        sleep(2)
        point(230,417).press(forDuration:0.1,thenDragTo:point(290,417))
        sleep(3)
        capture("cube-face-drag")
        point(47,850).tap()
        sleep(3)
        capture("cube-face-undone")
        point(139,752).tap()
        point(316,800).tap()
        sleep(3)
        capture("cube-inner-turn")
        point(47,850).tap()
        sleep(3)
        capture("cube-inner-undone")
    }
    func testSkyBossProbe() {
        let app = launch("org.haiyue.native.skystrike",env:["SKY_PARTS_PROBE":"1","SKY_AUDIO_PROBE":"1"])
        sleep(35)
        capture("sky-boss-probe")
        lifecycle(app,"sky-boss")
    }

}
