# Native 0.1.1 收尾验收

最终冻结候选已通过本次工程门禁；npm 尚未发布。候选包含 739 个输入，清单 SHA-256：`eadfa7fbc90c635e873562f4bfb01bb85cae1ca8aea329cd0d8a83978a9257de`。日历拼图的 49 个关键源码和资源文件哈希未变。

| 检查 | 结果 |
| --- | --- |
| 全新导出目录 npm ci + 全局源码门禁 | 通过；152 项源码、包和示例测试 |
| npm tarball | 类型检查、iOS/Android 入口解析、解包后原生构建助手路径和内容范围通过 |
| 六个 iOS 示例 | 构建、构建后依赖、CocoaPods / SwiftPM 锁通过 |
| Neon Circuit Android | 构建、构建后依赖、Gradle / Maven 锁通过 |
| Swift / Java 商业化桥接 | 类型检查 / 编译通过，见 native-compile.json |
| 独立 StoreKit | 13 项连续 3 轮，共 39 次执行，零失败 |

报告见 [clean-source/report.json](clean-source/report.json)、[ios/report.json](ios/report.json)、[android/report.json](android/report.json)、[storekit.json](storekit.json)。StoreKit 测试使用合成商品和独立宿主，经过验证的 Swift、测试及资源输入哈希与最终候选逐项相符；它不是 Sandbox 或 TestFlight 验收。

本次修正了干净环境缺少根依赖、npm 制包未进冻结/门禁、验证期间清单替换和 Sky Strike 已审计 vendor 补丁被误判的问题。后者仅允许冻结记录中的补丁前后精确哈希，其他改动仍失败。StoreKit 用例补上权益通知和未完成交易队列的异步等待。调试阶段的失败日志保存在 artifacts/，不计为通过；本目录三个 gate 报告都对应上方最终清单。

干净导出目录从零安装 npm 依赖；允许使用已有下载缓存。本机原生构建复用了 Xcode / Gradle 缓存，模型按冻结哈希单独提供，不随 npm 分发。iOS 开发包哈希见 [ios-artifacts.json](ios-artifacts.json)，Android Debug APK 哈希记录在 Android 报告。没有生成或发布商店 IPA/AAB。

候选包：`artifacts/haiyue-native-0.1.1.tgz`，标记为 `private: true`，用于接入测试。完整摘要及包哈希见 [summary.json](summary.json)。正式制包仍要求对应发布提交和 `native-v0.1.1` 标签。

内购、广告新入口按实验性能力交付。按既定范围，后续新游戏仍需验证实际 NativeScript SDK 构建接线、商店购买/恢复/离线权益，以及真实设备上的 UMP 拒绝/重开和广告完成回调。此次未修改日历拼图，未创建正式标签、推送或发布 npm。
