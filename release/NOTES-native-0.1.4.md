# @haiyue/native 0.1.4

本次更新提供 Native / Web 系统分享，分离系统能力与 Engine 渲染适配，并完善 iOS ATT 授权流程。npm 包只包含可复用适配代码、文档和必要资源；游戏示例从 GitHub 源码获取。

## 安装与兼容

```sh
npm install @haiyue/native@0.1.4
```

- 纯系统能力按子路径导入，例如 `@haiyue/native/share`、`/motion`、`/feedback`、`/scanner`、`/purchases/native`，无需 Engine。
- 根入口保留渲染兼容性；新增 `@haiyue/native/engine` 明确提供渲染适配。使用它们时需自行安装 `@haiyue/engine`，peer 范围为 `^0.2.0`（不包含 0.3.0 与预发布版本）。实际包安装、类型与双平台入口验证使用已发布的 Engine 0.2.0。
- NativeScript core 9.1.1、Canvas 2.1.18；npm 仍分发需要宿主构建器编译的 TypeScript 源码。Web 使用 `/share` 或 `/share/web`，避免导入 Native 根入口。

## 变更

- 系统分享支持文字、链接及单张 PNG/JPEG，接入 iOS 分享面板、Android chooser 和 Web Share API。统一能力检查、并发保护及结果处理；Android 图片分享需按文档配置包内 provider。
- 完善分享取消后立即重开、旋转和后台恢复；Native 运行时补充 AbortController 兼容。战绩卡生成与国际化仍由游戏或 Engine extensions 提供。
- 可选 `iosTrackingAuthorization: "system"` 使用 Apple ATT：先处理地区隐私同意，付费启动不请求 ATT，年龄策略和地区拒绝会抑制 Native 请求。授权未结束时不初始化或加载广告，已拒绝或受限不会阻塞正常启动。
- 增加 ATT Debug 阶段日志、独立真机验收宿主及 `restricted` 自动化覆盖。保留实时状态读取，避免将 ATT、地区同意和奖励资格混为一谈。

## 验证与适用边界

- iPhone 15 Plus 与 Android X4000 的分享面板验收已覆盖图片/文字、取消重开、横屏和后台恢复；未向外部接收者实际发布内容。详见 [分享真机记录](../bridge/share/evidence/device-content-2026-10-08.json)。其中战绩卡生成使用的是当时 Engine 0.2.1 本地候选；这不代表公开 Engine 0.2.0 包具有该扩展。
- iPhone ATT 已覆盖 Native 首次弹窗拒绝、设置授权/撤销、再次启动、付费/旧策略/年龄策略、地区拒绝及测试广告关闭回调。详见 [ATT 验收记录](evidence/att-2026-10-09/summary.json)。
- **`restricted`：自动化通过，真机待验收。** 屏幕使用时间尝试未产生该状态；测试替身的结果不代替系统实测。此项作为已披露的后续验收事项保留。
- 新版本源码门禁、全新目录安装和 npm 制包结果见 [0.1.4 验收记录](evidence/native-0.1.4/README.md)。历史设备结果仅对应其记录的构建，不宣称本次重跑全部游戏真机测试。
- 内购与广告继续按实验性能力提供；未新增商店购买、真实广告收益或应用商店发布验收。第三方模型不包含在 npm 或公开源码中，许可与使用路径见仓库声明。
