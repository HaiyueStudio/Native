# @haiyue/native 0.1.0 npm 核心包验证

发布范围仅为可复用原生能力：宿主/渲染、输入、设备姿态、震动、音频、方向、存储、图片保存与通用开屏组件。游戏和示例仅从 GitHub 获取，npm 不包含示例、游戏素材、引擎 vendor 包、归档初始化器或原生构建产物。

- npm tarball 为 177,192 字节（约 173 KiB），共 62 个文件。
- 57 个原生输入逐个匹配 `native-v0.1.0` 冻结源码，见 [source.json](source.json)。
- 使用 npm 公开版本的 Engine / NativeScript / Canvas，通过独立类型检查。
- 包内容限制、iOS 平台解析和 Android 平台解析三项测试通过；对全新目录中安装的最终 tarball 再次执行并通过。记录见 [package-check.json](package-check.json)。
- iOS 验证 NativeClass 编译处理；平台测试覆盖根入口及 motion、feedback、audio、orientation、media 子入口，防止 Android 意外打入 iOS 实现。
- 发布后 registry 元数据、完整性及匿名安装结果见 [registry-check.json](registry-check.json)。

早先的约 192 MiB 示例源码包上传已取消，检查时 registry 返回 404；该方案已撤回，未作为最终 npm 包发布。当前包没有 CLI 初始化器。

本轮是 npm 打包、安装与平台解析验收，不重复原生二进制构建或真机操作。游戏示例与已有真机记录保留在 GitHub。
