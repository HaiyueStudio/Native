# 0.1.0 源码发布记录

2026-09-24。正式冻结清单为 `candidate.json`，SHA-256 为 `a97db8a6bc697138007bf30a1e14e837c3be3e86b146c941fb00abe9d54a55de`。

`runtime-equivalence.json` 比较正式清单与 rc.3：桥接、六个示例、Games 输入、依赖和工具链完全相同。正式版本只调整发布文档、根版本配置及冻结工具的版本状态说明，使用已经安装到 iPhone 的 rc.3 构建验收证据。Android 与 rc.2 的运行输入等价证明保存在 rc.3 目录。

`device-acceptance.json` 汇总六个示例的实际断言、交互和生命周期证据；源码、日志、截图及安装包文件哈希见相邻 rc.3 目录。`source.json` 保存正式清单冻结后的最终统一源码检查，`source-content-audit.json` 检查源码分发范围不含模型、安装包、签名文件或私钥标记，并检查现有 vendor 压缩包条目。

发布方式为 Native 仓库 `v0.1.0` 源码 tag，不发布手机二进制或未知原始许可的模型。签名配置仅保留在本机 ignored 文件中。参见 [版本说明](../../NOTES-0.1.0.md) 与 [验收范围](../../ACCEPTANCE.md)。

归档的文本日志仅统一行尾并移除行末空白，以通过 Git whitespace 检查；测试内容、时间戳和结果未改动。原始构建日志及 xcresult 保留在本机 ignored artifacts。
