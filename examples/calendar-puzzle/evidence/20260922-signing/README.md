# 正式团队签名迁移（2026-09-22）

- 使用用户确认的团队 `22T5YFVY2B` 构建，实际 CodeSign TeamIdentifier 与 provisioning profile 均一致；描述文件包含当前 iPhone。
- 旧标识 `org.haiyue.native.calendarpuzzle` 被 Apple 拒绝注册到新团队，因此 iOS 改为 `org.haiyue.games.calendarpuzzle`，与 Android 保持一致。
- 新版已安装并正常启动，日志确认 `scene-ready`、`engine-ready`、`present`，未记录运行时错误。
- 迁移前已备份旧 App 的 Documents、Library、旧安装包与签名配置，保存在忽略目录 `artifacts/device-backups/calendar-before-paid-team-20260922/`。验证完成后，经用户明确要求，旧 App 已卸载；电脑上的备份保留。
- 首次启动前读回新 App 偏好，确认生产自动存档和提示钱包两项与原值完全一致；排除自动测试存档。启动后核对通关日期、星星记录、语言、拼图日期与提示使用状态，均一致。
- 当前内购商品仍不可用。后续需要在新 Bundle ID 下完成显式 App ID、App Store Connect 应用与商品配置，另行验证沙盒购买；本次未发起付款或发布。
- 验证范围：Native TypeScript 检查、Xcode Debug 真机签名构建、安装、数据迁移和正常启动日志。没有声称完成 App Store 分发或支付验证。

文件：`signature.json` 为签名摘要；`migration.json` 为迁移前原值哈希与读回验证；`verification.json` 为结果；`iphone-normal.jsonl` 为正常启动日志。
