# 0.1.1-rc.4 全新目录构建验证

2026-09-24 完成。两份独立目录从同一个冻结输入清单导出，旁边没有 Games 仓库；初始不含 node_modules、platforms、生成纹理或旧 App 构建产物。模型通过独立的 local-assets/ 原始 GLB 提供，未纳入公开源码。

## 结果

| 项目 | 结果 |
| --- | --- |
| 六个示例 npm ci、依赖核验与 TypeScript | 全部通过 |
| 单元测试 | 87/87（发布工具 10 项，示例 77 项） |
| 六个 iOS 示例 Debug 编译与签名 | 全部通过 |
| 六个 iOS App codesign --verify --deep --strict | 全部通过 |
| iOS Podfile 正文、Podfile.lock、SwiftPM 锁 | 全部通过 |
| Neon Circuit Android Debug APK | 通过，Gradle / Maven 锁验证通过 |
| 构建前后源码及模型哈希 | 全部一致 |
| AK47 / Sky / Neon 重建资源 | 22 / 35 / 53 个文件与原运行资源逐字节一致 |

## 构建输入与边界

- 候选清单包含 680 个 Native 内部输入，外部 Games 输入为零。迁入的 297 个文件与原冻结的实际文件逐字节一致，包含当时尚未提交到 Games 基线的修复。
- npm 依赖清单及工具版本与 0.1.0 完全相同。Ruby 锁文件补齐了官方 Bundler 生成的校验和，没有升级依赖。Sky Strike 补齐自身包的类型解析路径；NativeScript 生成 hook 被纳入冻结；Podfile 校验只规范化两类生成注释里的绝对路径，正文与依赖仍严格比较。
- 全新目录分别为 `/private/tmp/haiyue-native-clean-final-ios/checkout` 和 `/private/tmp/haiyue-native-clean-final-android/checkout`。它们是本地冻结工作树的公开输入快照，不是远端已发布标签的克隆。
- 使用已有的固定 Xcode、Ruby、Python/Pillow、Android SDK/JDK，以及 npm / SwiftPM / SDK 模块 / Maven / Gradle 等下载或工具缓存。没有复制旧项目的 node_modules、platforms、App 或生成纹理。因此此记录是全新项目目录构建，不宣称全新操作系统或完全空下载缓存验证。
- iOS 使用开发者自己的已登录 Team，通过 generic/platform=iOS 编译；无需连接手机。三个来源许可未确认的模型仅作为本地输入，其哈希记录在 build 报告中，不随仓库分发。
- 本轮未安装手机、未重跑真机交互验收、未上传商店、未推送新发布标签。0.1.0 真机证据仍是历史记录。

## 文件

- `clean-build.json`：范围、路径、测试计数与缓存说明。
- `candidate.json` / `source-migration.json`：冻结清单和迁移内容检查。
- `ios-build.json` / `android-build.json`：统一入口逐阶段结果、模型输入和工具版本。
- `ios-bundles/*.json`：六个签名 App 的逐文件 SHA-256 及清单摘要。
- `ios-build-log-index.json`：完整 iOS 编译日志的 SHA-256 和成功标记；原始编译日志保留在新目录 artifacts/release/，不把签名身份输出另行复制到公开日志。
- `ios-logs/` / `android-logs/`：安装、类型、测试和 Android 构建记录。
- `regenerated-*.json`：重建资源与已有运行资源的逐字节比较。

构建命令与导出方法见 [发布说明](../../README.md)，私有模型准备见 [素材说明](../../../games/ASSETS.md)。
