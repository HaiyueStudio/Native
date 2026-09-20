# 日历拼图 · iPhone

直接复用 `Games/games/calendar-puzzle` 的拼图规则、棋盘和 Engine GUI；通过 NativeScript Canvas / wgpu / Metal 原生渲染，不使用 WebView。

- 横屏全屏绘制，无两侧或底部留白；左侧随机拼块、右侧大日历，GUI 与触摸使用同一坐标映射。
- 拖拽时拼块放大到日历格尺寸，吸附后对齐；选择后可「旋转」「翻转」，「打乱」重新排列所有拼块。
- 同一拼块可双击旋转。轻触保持原尺寸，超过 12 个逻辑屏幕点才开始放大拖拽；双击容差按屏幕点计算，不随棋盘缩放变窄，iOS 与 Android 共用该逻辑。
- 右侧日期按钮打开万年历：双箭头切换年份、单箭头切换月份，选择日期后自动计算星期并进入拼图；浅绿色日期表示已通关。
- 通关后弹出大拇指和彩色粒子，点「查看记录」直接查看日历。完整年月日的通关记录自动保存，打乱/换日期不删除。
- 右上角齿轮提供中文（默认）、English、日本語与通关记录入口。
- 纯色拼图关闭色调映射；Canvas 文字纹理使用 sRGB 采样，避免画面灰蒙。
- ApplicationSettings 自动存档；后台中断拖动时恢复原位置，恢复游戏不会重复绑定事件。
- Canvas 2D 只用于文字栅格化，纹理按稳定键更新；渲染由 WebGPU 完成。
- 文字和提示的离屏 Canvas 使用 CPU 栅格化，防止连续操作时累积 Metal 绘图上下文；主画面仍由 Metal 渲染。双击手势与连续提示的 iPhone 真机回归记录见 `evidence/20260920-double-tap/`（89 项通过）。

## 构建

Node 22+、Xcode、Ruby Bundler；签名配置保存在忽略的 `App_Resources/iOS/signing.local.xcconfig`（`DEVELOPMENT_TEAM = …`）。

```sh
npm ci --legacy-peer-deps
bundle install
npm run typecheck
npm test
IOS_DEVICE_UDID=<iPhone UDID> npm run build:device
```

安装产物 `platforms/ios/build/Debug-iphoneos/calendarpuzzle.app`，Bundle ID `org.haiyue.native.calendarpuzzle`。`orientation.json` 是方向策略来源，构建前自动同步 Info.plist。

设置启动环境变量 `CALENDAR_CAPTURE_FRAME=1` 可在第 120 帧将原生画面保存到 Documents/calendar-puzzle-frame.png；正常启动不截图。桥接诊断保存在 Documents/calendar-puzzle-host.jsonl。

设置 `CALENDAR_SMOKE=1` 会在独立测试存档中预置独立的近完成棋盘，以真实原生拖拽验证通关、点赞/粒子、万年历标记、跨年/闰日、三语和历史持久化；结果写入宿主日志。正常启动不运行这些检查。

## 2026-09-20 发行准备与载入页

- 共享 `bridge/branding/NativeEngineSplash`：浅蓝琉璃月牙 + 深蓝背景，首帧呈现后淡出，无强制等待；iOS/Android 共用同一素材和组件。
- 原生文字复用 CPU Canvas；重复同色提示复用贴图；选中呼吸不再重设拼块变换。
- 正常运行关闭每 120 帧完整快照与同步写盘。`CALENDAR_PERFORMANCE=1` 开启性能采样，`CALENDAR_SMOKE=1` 保持完整回归诊断，`CALENDAR_SPLASH_CAPTURE=1` 在首帧截图原生载入页（Documents/calendar-engine-splash.png）。
- [商业模式和商店准备清单](docs/STORE-RELEASE.zh-CN.md)、[性能改动与验证边界](docs/PERFORMANCE-20260920.md)。本轮未接入内购或锁定原有功能。
