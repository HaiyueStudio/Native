import XCTest
final class Acceptance: XCTestCase {
 let app = XCUIApplication(bundleIdentifier: "org.haiyue.nativevalidation")
 func capture(_ name:String) {let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)}
 func choosePermission(_ allow:Bool) {
  let alert=XCUIApplication(bundleIdentifier:"com.apple.springboard").alerts.firstMatch
  if alert.waitForExistence(timeout:5) {
   let labels=allow ? ["Allow", "OK", "允许", "好"] : ["Don’t Allow", "Don't Allow", "不允许"]
   for title in labels {if alert.buttons[title].exists {alert.buttons[title].tap();return}}
   XCTFail("Unrecognized permission sheet: \(alert.debugDescription)")
  }
 }
 func testCameraLifecycle() {
  continueAfterFailure=false
  app.resetAuthorizationStatus(for:.camera)
  app.launch();XCTAssertTrue(app.buttons["Scan QR"].waitForExistence(timeout:20));capture("ready")
  app.buttons["Scan QR"].tap();choosePermission(false);sleep(2);capture("permission-denied")
  XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","Camera permission denied")).firstMatch.exists)
  app.resetAuthorizationStatus(for:.camera)
  app.buttons["Cancel + concurrency (4s)"].tap();choosePermission(true);sleep(6);capture("cancel-concurrency")
  XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","scan-cancelled")).firstMatch.exists)
  app.buttons["Scan QR"].tap();XCTAssertTrue(app.buttons["Cancel test"].waitForExistence(timeout:10));capture("camera-open")
  XCUIDevice.shared.orientation = .landscapeLeft;sleep(2);capture("camera-landscape")
  XCUIDevice.shared.press(.home);sleep(2);app.activate();sleep(3);capture("camera-resumed")
  app.buttons["Cancel test"].tap();sleep(2);XCUIDevice.shared.orientation = .portrait
  XCTAssertTrue(app.buttons["Scan QR"].waitForExistence(timeout:10));capture("closed")
 }
 func testRewardedAd() {
  app.launch();XCTAssertTrue(app.buttons["Test rewarded ad (+3)"].waitForExistence(timeout:20))
  app.buttons["Test rewarded ad (+3)"].tap();sleep(35);capture("reward-result-or-ad")
  // Keep the result visible for manual test-ad completion. Do not click destinations.
 }
}
