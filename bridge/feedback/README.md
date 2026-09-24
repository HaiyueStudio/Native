# 原生震动（iOS / Android）

通过无平台后缀的 `bridge/feedback/haptics` 导入 `NativeHaptics`。页面就绪时 `resume()`，前后台调用 `suspend()/resume()`，退出调用 `dispose()`。用 `impact('light' | 'medium' | 'heavy')` 请求轻、中、重反馈；250 ms 内重复或更弱请求被合并，更强请求可立即覆盖。

iOS 使用 UIImpactFeedbackGenerator。Android Manifest 需要 `<uses-permission android:name="android.permission.VIBRATE" />`（普通权限，不弹授权框）。API 26+ 使用 VibrationEffect；三档持续时间为 12/24/40 ms，支持幅度控制时分别为 55/120/210。无幅度控制时以持续时间区分，无振动器时静默跳过；实际触感取决于硬件。`suspend()` 取消尚在运行的震动。

`snapshot()` 返回 active、impactsRequested、lastKind。计数表示已调用原生接口，不证明硬件实际产生了震动。

Sky Strike 用轻反馈表示玩家受伤或精英被击败、中反馈表示释放炸弹、重反馈表示玩家被击毁或整场 Boss 被击败；双子暂时倒地不触发 Boss 反馈。极速新星根据真实护栏碰撞的车速和入射角选择轻、中、重档。游戏规则不依赖原生反馈。

官方接口：[Apple UIImpactFeedbackGenerator](https://developer.apple.com/documentation/uikit/uiimpactfeedbackgenerator)、[Android VibrationEffect](https://developer.android.com/reference/android/os/VibrationEffect)。
