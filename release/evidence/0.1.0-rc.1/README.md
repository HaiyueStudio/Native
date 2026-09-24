# 0.1.0-rc.1 验证记录

验证日期：2026-09-24。所有报告绑定同一候选清单 SHA-256：

`cfa3c9f1af3e5cb02fb2f596fa1573b91a145e913fbde542d5a0839ab0d5582e`

| 范围 | 结果 | 报告 |
| --- | --- | --- |
| 六个公开应用的输入、依赖、类型和测试 | 通过；72 项应用测试 + 7 项发布工具测试 | [source.json](source.json) |
| Neon Circuit Android Debug 构建 | 通过；固定工具链、四个 Maven 图严格锁、APK 哈希、构建后候选无漂移 | [android-build.json](android-build.json) |
| Neon Circuit iOS prepare | 通过；工具链、Webpack 打包与 CocoaPods 锁一致 | [ios-bundle.json](ios-bundle.json) |

相应子目录保留命令日志。已另行确认再次冻结同名候选会返回非零，且不会改写清单。AK47 示例补齐本地 animation-spec peer 和 loaders.gl 的缺失传递依赖，完成一次官方 registry 的 `npm ci` 干净安装；另五个示例的 `npm ci --dry-run --ignore-scripts --offline` 安装计划通过。

Android Debug APK SHA-256：

`9f9a639656f1be15a2b59071a84d8f4eaece4eb61f482f9335b484fc4e3877f9`

本机副本保存于 ignored 的 `artifacts/release/0.1.0-rc.1/neon-circuit-debug.apk`，没有提交大型二进制。此包与上一轮 Android 渲染优化验证包哈希相同；本次执行了构建与依赖锁验证，未重新安装或重复真机验收。

iOS prepare 不等于 iOS 二进制编译或真机验收；本次没有签名导出 IPA/AAB、提交商店或创建正式版本 tag。素材授权、正式签名与跨设备验收待办见 [发布说明](../../README.md) 和 [第三方声明](../../../THIRD_PARTY_NOTICES.md)。
