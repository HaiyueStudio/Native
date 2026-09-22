# Boxbound Android 无响应排查与修复

2026-09-22 14:29 的退出是输入超时 ANR。原始进程日志在 14:29:35
出现 `Too many open files (24)`，随后 Vulkan 复制同步 fence 失败，主线程停在
`DrawFrameTask::drawFrame` 等待。没有低内存杀进程或规则死循环的证据。

Canvas 2.1.18 Android `PromiseCallback.prepare()` 新建了共享 Inner 的第二个
堆对象，而回调完成仅删除第二个对象，原对象继续持有 V8 Promise、looper 引用和
两个 pipe 句柄；析构路径也漏关写端。每帧 GPU 完成 fence 使用 mapAsync，因此
持续游玩会耗尽文件描述符。`AsyncCallback` 存在相同的一次性回调所有权问题。

修复将原回调对象的所有权交给一次性 looper 回调，并关闭管道两端。
只重建 Boxbound 的 Canvas Android C++ 绑定，保留 Rust 后端与 Haiyue Engine。
四种 ABI 的产物、校验信息、重建脚本见 `../../vendor/canvas-android/`。
正常模式不运行资源探针、压力循环或额外计时器。存档未清空。

验证结果：

- 旧版 619 帧、623 次 mapAsync 后有 1,476 个 FD；测试停止后不释放。
- 修复版 30 项真机功能检查通过。
- 20,000 次真实 GPU 读回（校验清零结果），以及 8 个镜像关卡各访问 3 次，
  包含移动、撤销、重置与返回外层；最终累计 22,656 次映射。
- 长测 FD 基线 228，结束 230；不再按每次回调增长两个。
- 4,000 次 C++ 回调生命周期测试：原实现复现泄漏，补丁释放全部 pipe、owner、looper 引用。
- 14 项移动端定向测试、类型检查、Android 构建通过。未改 Engine，未跑全库测试。
- 真机验证为 arm64；其余三种 ABI 已交叉编译并核对包内哈希，尚未真机验证。

原始证据：`original-process.log`、`original-anr.txt`、`host-before.jsonl`。
对照与最终证据：`probe-smoke.jsonl`、`fixed-stress.jsonl`、`validation.json`。
