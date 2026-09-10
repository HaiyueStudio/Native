# iOS 触觉反馈

`NativeHaptics` 封装 UIKit `UIImpactFeedbackGenerator`，提供 `impact('light' | 'medium' | 'heavy')`，可由各游戏的平台回调复用。无需额外插件。

宿主主线程在准备场景或恢复时调用 `resume()`，切后台调用 `suspend()`，释放场景调用 `dispose()`。只在前台触发；250 ms 内同类反馈合并，更强的反馈可以覆盖紧邻的较轻反馈。没有延迟定时器，也不会恢复播放后台积压的震动。

Sky Strike 用轻反馈表示玩家实际受伤或精英被击败、中反馈表示成功释放炸弹、重反馈表示玩家被击毁或整场 Boss 被击败；双子暂时倒地不触发 Boss 反馈。浏览器不注入该回调，游戏规则不依赖 UIKit。

官方 API：[UIImpactFeedbackGenerator](https://developer.apple.com/documentation/uikit/uiimpactfeedbackgenerator)。`impactsRequested` 仅记录原生 API 调用，实际触感受硬件及系统设置影响，需要真机手感验收。
