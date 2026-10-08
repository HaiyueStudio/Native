package org.haiyue.validation;

import android.app.Instrumentation;
import android.app.UiAutomation;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;

/** Device-only acceptance. Opens/cancels Android's chooser; never selects a recipient. */
public final class ShareAcceptance extends Instrumentation {
    private UiAutomation ui;
    private File output;
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    private String journal() throws Exception {
        File file = new File(getTargetContext().getFilesDir(), "share-content-validation.jsonl");
        return file.exists() ? new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8) : "";
    }
    private void waitLog(String expected, long timeout) throws Exception {
        long end = SystemClock.uptimeMillis() + timeout;
        while (SystemClock.uptimeMillis() < end) {
            String text = journal();
            if (text.contains("generation-error") || text.contains("startup-error") || text.contains("share-error")) throw new AssertionError(text);
            if (text.contains(expected)) return;
            SystemClock.sleep(300);
        }
        throw new AssertionError("Missing " + expected + ": " + journal());
    }
    private int count(String event) throws Exception {return journal().split("\"event\":\"" + event + "\"", -1).length - 1;}
    private void waitCount(String event, int minimum) throws Exception {
        long end = SystemClock.uptimeMillis() + 30000;
        while (SystemClock.uptimeMillis() < end) {if(count(event) >= minimum)return;SystemClock.sleep(300);}
        throw new AssertionError("Missing fresh " + event + ": " + journal());
    }
    private void click(String text) {
        AccessibilityNodeInfo root = ui.getRootInActiveWindow();
        if (root == null) throw new AssertionError("No foreground window");
        List<AccessibilityNodeInfo> matches = root.findAccessibilityNodeInfosByText(text);
        for (AccessibilityNodeInfo node : matches) {
            if (text.contentEquals(node.getText() == null ? "" : node.getText()) && node.isEnabled()) {
                while (node != null && !node.isClickable()) node = node.getParent();
                if (node != null && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return;
            }
        }
        throw new AssertionError("Button not found: " + text);
    }
    private void capture(String name) throws Exception {
        Bitmap image = ui.takeScreenshot();
        if (image == null) throw new AssertionError("Screenshot unavailable");
        try (FileOutputStream stream = new FileOutputStream(new File(output, name + ".png"))) {
            image.compress(Bitmap.CompressFormat.PNG, 100, stream);
        } finally { image.recycle(); }
    }
    private void assertChooser() throws Exception {
        SystemClock.sleep(1800);
        AccessibilityNodeInfo root = ui.getRootInActiveWindow();
        if (root == null || "org.haiyue.nativevalidation".contentEquals(root.getPackageName())) throw new AssertionError("System chooser not visible");
        Files.write(new File(output, "share-chooser.txt").toPath(), root.toString().getBytes(StandardCharsets.UTF_8));
    }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            ui = getUiAutomation(); output = getTargetContext().getFilesDir();
            // Do not mistake the previous process's journal for this run's result.
            Files.deleteIfExists(new File(output,"share-content-validation.jsonl").toPath());
            Intent launch = getTargetContext().getPackageManager().getLaunchIntentForPackage("org.haiyue.nativevalidation");
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getTargetContext().startActivity(launch);
            waitLog("verification-passed", 60000); SystemClock.sleep(1500); capture("share-ready");
            click("Share card"); assertChooser(); capture("share-image-sheet");
            sendKeyDownUpSync(KeyEvent.KEYCODE_BACK); waitCount("share-result", 1); SystemClock.sleep(1000);
            click("Share text"); assertChooser(); capture("share-text-sheet"); sendKeyDownUpSync(KeyEvent.KEYCODE_BACK); waitCount("share-result",2); SystemClock.sleep(1000);
            click("Switch language / layout"); SystemClock.sleep(4000); capture("share-english-portrait");
            click("Share card"); assertChooser();
            ui.setRotation(UiAutomation.ROTATION_FREEZE_90); SystemClock.sleep(2000); capture("share-landscape-sheet");
            sendKeyDownUpSync(KeyEvent.KEYCODE_BACK); waitCount("share-result",3); SystemClock.sleep(1000);
            ui.setRotation(UiAutomation.ROTATION_FREEZE_0);
            sendKeyDownUpSync(KeyEvent.KEYCODE_HOME); SystemClock.sleep(1000); getTargetContext().startActivity(launch); SystemClock.sleep(3000);
            int previous = count("verification-passed");click("Verify four variants");waitCount("verification-passed",previous+1);capture("share-after-resume");
            result.putString("stream", "Share content device acceptance passed\n");
            Files.write(new File(output,"share-ui-result.txt").toPath(), result.getString("stream").getBytes(StandardCharsets.UTF_8));
            finish(-1, result);
        } catch (Throwable error) {
            try {capture("share-ui-failure");} catch (Throwable ignored) {}
            result.putString("stream", "FAIL: " + error); finish(0, result);
        } finally { if (ui != null) ui.setRotation(UiAutomation.ROTATION_UNFREEZE); }
    }
}
