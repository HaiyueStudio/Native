# 切换赛道加载提示回归修复

原因：原生加载标签此前依赖宿主的周期性 `present` 诊断回调隐藏。性能优化关闭周期日志后，首帧之后的赛道切换没有再触发该回调，导致比赛已经开始，标签仍然显示。

修复：`src/main-page.ts` 在新赛道 `loadCircuit` 成功返回后主动清空并折叠标签，再恢复渲染；加载失败仍由原有错误处理显示失败原因。不恢复周期日志写入。

验证：类型检查和 15 项单元测试通过，安卓 APK 构建成功并覆盖安装到 X4000。未开启 `NEON_PERF`，使用正常 `batched` 配置及关闭周期日志的设置，23 项真机检查全部通过，结果见 [verification.json](verification.json)。新增验证通过实际 GUI 从云端港湾进入霓虹都市，再回到云端港湾；每次确认比赛与模型就绪、原生标签文本为空且 `visibility=collapse`，随后继续运行 130 帧并确认标签仍隐藏。

安装包：`/tmp/neon-circuit-track-loading-fix.apk`（Debug）。SHA-256：`a2cadc54d16c7a50a7f2c860a446f4b44bf65e9acbc9ea17588a36dcb4ec89c2`。共用场景切换代码同时修复 iOS 路径，本轮仅在安卓真机执行验证。
