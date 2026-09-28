# @haiyue/native 0.1.3 — 待发布

本版本新增通用离线 QR 扫描，并完善激励广告的错误诊断。既有钱包、购买权益和应用版本保持兼容。

## QR 扫描

- 新入口 `@haiyue/native/scanner`：`scanCode(options)` 返回 `{ text, format: 'qr' }`；取消返回 `null`，权限拒绝、配置错误、超长内容拒绝 Promise。
- `cancelScan()` 支持宿主清理；扫描期间拒绝并发请求，取消后可以重新打开。Android 忽略旧 Activity 的延迟结果；iOS 取消覆盖权限申请及等待呈现阶段。
- iOS 使用 AVFoundation；宿主必须提供 `NSCameraUsageDescription`。Android 使用 ZXing Embedded 4.3.0，宿主需配置 CAMERA 权限、Gradle 依赖，默认依赖要求 API 24+。
- 相机权限仅在用户扫描时申请，结束后释放相机。不上传或保存相机图片，不打开识别出的 URL，不解析业务数据。宿主负责校验二维码业务内容。
- `maxTextLength` 默认 8192，按 JavaScript UTF-16 长度计数；可配置为 1–1,000,000 的整数。`cancelLabel` 目前仅用于 iOS；Android 支持系统返回取消。

## 激励广告诊断

- `createRewards` / `AdMobRewardGateway` 支持 `onFailure`，控制器通过 `snapshot().lastFailure` 提供最近错误。
- 结构化诊断包括平台、动作、阶段、稳定原因码、时间和 SDK 数字错误码；不包含广告响应正文、用户标识或 SDK 原始消息。
- 修复 Android 首次广告配置顺序：SDK 初始化完成后、加载广告前关闭第一方标识，避免首次使用被误判为 policy_rejected。仍先完成同意状态检查，再初始化 SDK；保持非个性化广告设置。
- 保留旧 `error.message` 及钱包结算语义；诊断回调失败不影响奖励。完善销毁、超时和过期回调的处理。
- SDK 版本不变：iOS Google Mobile Ads 13.10.0；Android Ads 25.5.0、UMP 4.0.0。

## 原生构建接入修复

`monetizationBuild` 的 iOS `NativeSource` 改为相对宿主工作目录的路径，修复 NativeScript 9.1.1 生成 Xcode 工程时重复拼接绝对路径、无法找到 Swift 文件的问题。应从宿主应用目录调用该构建函数。

## 发布验证

版本和发布配置为 0.1.3，正式标签预定 `native-v0.1.3`。候选包保持 private；提交、标签、推送及 npm 发布单独执行。

新增扫码生命周期回归及真实 npm tarball 的 iOS / Android 入口解析测试。独立验证宿主见 [操作说明](../scripts/validation/README.md)，设备实测及未覆盖项见 [验收记录](evidence/native-0.1.3/README.md)。不将模拟对象测试或编译成功记为真机相机/广告成功。

内购商品及商店环境验收不属于本次新增功能；商业化 API 仍为实验性能力。
