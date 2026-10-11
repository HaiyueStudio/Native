# P0 验收证据 · 2026-10-11

本目录只记录实际运行。**Windows x64、Apple Silicon Mac 均待真机验收**；不能因为存在目标下载配置或编译脚本就改为通过。G01/G02 保持 validating，G03 成就核心已完成。

## Intel Mac 自动化

机器身份见 [machine.json](p0-intel-mac/machine.json)，实际 GPU 为 AMD Radeon Pro 5300M。截图来自原生 GPU frame readback：[魔方与中文 GUI](p0-intel-mac/rubik.png)。它不是浏览器截图；ready 日志记录 `document: false`，独立程序记录 `standalone: true`。

| 项目 | 证据与范围 |
| --- | --- |
| 全部 Native 测试 | [tests.log](p0-intel-mac/tests.log)：136/136 通过，包含现有移动功能回归；不替代移动真机复验。 |
| P0 核心与宿主测试 | [p0-tests.log](p0-intel-mac/p0-tests.log)：25 项通过；成就状态/账号/重试/迁移、surface 获取、输入失焦/关闭、FFI 错误、原子存储。无平台 SDK。 |
| 无 Engine 消费者 | 同一 P0 日志后半部分：通过真实 npm staging 筛选后复制完整包，未安装 Engine、NativeScript/GPU types/平台 SDK，严格类型检查与运行通过。它证明 import 隔离；旧 NativeScript npm peer 声明未改。 |
| 独立应用 | [standalone.jsonl](p0-intel-mac/standalone.jsonl)：420 帧、四种魔方、20 次 resize、图片 GPU 往返、Worker transferable、存储、音频设备 API。复制到临时目录、空 DENO_DIR、PATH 无 Node/Deno。不是“干净系统所有 DLL 已验收”的声明。 |
| 窗口生命周期 | [window.jsonl](p0-intel-mac/window.jsonl)：最小化、恢复、全屏进入/退出四个步骤，30 秒运行。真实窗口 API，程序触发；不冒充人手键鼠验收。 |
| 设备丢失 | [device-loss.jsonl](p0-intel-mac/device-loss.jsonl)：device.destroy 注入，预期 exit 1、明确 Device lost 后销毁；不是真实驱动故障，也不宣称恢复 device。 |
| 全新目录构建 | [first-clean-build.log](p0-intel-mac/first-clean-build.log)：首轮空 npm 缓存/新下载通过。最终修订再次新建源码目录时 GitHub 下载超时，保留 [失败日志](p0-intel-mac/fresh-download-timeout.log)；随后仅补入已 SHA-256 锁定的下载归档，再重新编译/运行/打包，见 [最终恢复日志](p0-intel-mac/fresh-final.log)。没有复制 node_modules 或预编译项目输出，最终 JS bundle 与主工作目录一致。随后在同一隔离目录同步音频构建的 macOS 12.0 deployment target 修复并重编译/验证/打包，见 [音频目标对齐](p0-intel-mac/fresh-audio-alignment.log)。 |
| npm 体积与边界 | [npm-payload.json](p0-intel-mac/npm-payload.json)：包含成就 API，不包含 desktop/games/examples；没有发布。 |

## 长时间运行与修复版本

初轮在运行中遇到 `Invalid Surface Status` 后退出，见 [失败日志](p0-intel-mac/first-soak-failed.jsonl)。修复后先 acquire 再消费 RAF，已知临时失败重配并跳帧；未知错误或持续前台失败仍报错，不靠吞掉所有异常掩盖问题。

复测结果见 [soak.jsonl](p0-intel-mac/soak.jsonl) 与 [summary.json](p0-intel-mac/summary.json)。修复版完成 1,800,022.98 ms，呈现 53,495 帧，累计 2,532 次暂时不可获取后继续渲染，exit 0。前 400 帧自动切换魔方和窗口尺寸，之后持续渲染当前场景；结束快照为镜面魔方 3 步，未记录完整交互轨迹。测试期间另有原生验收窗口前后台切换。因此该测试验证进程存活、surface 恢复与观察到的内存情况，不是 30 分钟持续交互或同画质性能测试。

长测使用 surface 修复版 bundle `43182bb4b66cf2471622ea46569db1d56ca88c0f34e41c5e71a83ef81fae8fed`。之后补了 Storage 枚举、键盘 code、窗口/丢失注入入口和 adapter 信息日志；最终 bundle `dfaaaee0a7b5de2bc1678ec567ffd2da6ac14154a37816c2ee8b7bcfd4a0c75f` 另经短程窗口、独立打包和干净构建回归。**不是最终 bundle 原封不动跑过 30 分钟的证明**，目标平台验收仍需用最终代码完整重跑。

最终主工作目录独立制品身份见 [package.json](p0-intel-mac/package.json) 和 [standalone-summary.json](p0-intel-mac/standalone-summary.json)，源码文件校验见 [source-files.json](p0-intel-mac/source-files.json)。二进制没有纳入 Git/npm；build/artifacts 是本地生成物。路径已做占位替换。

## 未覆盖项

- Windows DX12 / Apple Silicon Metal 的实际运行、键鼠、独立安装和 30 分钟；按 [接续指南](../WINDOWS-HANDOFF.md) 完成。
- 物理手柄拔插、跨屏 DPI、完整拖出窗口捕获、IME、人工听音/设备热插拔；自动回调测试只证明对应分支。
- 原生 display-link/帧节奏与功耗、同画质浏览器/Rust 对比、生产签名/公证/安装器、原生传递依赖完整通知。
- Steam/Game Center 与 Engine extension 是 P1；没有修改平台生产配置或创建真实平台成就。既有 ATT restricted 真机待验收记录不变。

应用与音频 dylib 的 Mach-O 最低编译版本均为 macOS 12.0，实际运行系统是 machine.json 中的 macOS 26.6.2；最低编译版本不是 macOS 12 真机兼容性验收结论。
