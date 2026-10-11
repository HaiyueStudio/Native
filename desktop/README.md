# Desktop Native · 0.2.0 开发预览

复用仓库内 `games/rubiks-cube` 和固定的 Engine 0.2.1 包，在 **Deno/V8 主线程 → GLFW 原生窗口 → Deno WebGPU/wgpu** 上运行。没有 DOM、WebView 或 Chromium renderer。当前只完成 Intel Mac 本机自动化验证；Windows x64 和 Apple Silicon Mac 尚待真机验收，不能视为已正式支持或可发布版本。

## 构建与启动

开发需要 Node/npm；macOS 需要 Xcode Command Line Tools，Windows 音频编译需要 Visual Studio C++ x64 Developer PowerShell。玩家运行打包产物无需安装 Node、Deno 或 Rust。

```sh
cd Native
npm ci
cd desktop
npm ci
npm run setup
npm run build:audio
npm run verify
npm run start
npm run package
npm run verify:package
```

`setup` 根据 `toolchains.json` 下载固定 Deno 2.9.6、GLFW 3.4、Noto Sans CJK 2.004、miniaudio 0.11.22，先验 SHA-256 再解压。工具仅放在本仓库 artifacts，不更改全局运行时。Engine 使用 `vendor/haiyue-engine-0.2.1.tgz`，不读取相邻 Engine/Games 源码。npm 依赖由 package-lock.json 固定；首次构建需要访问其中的镜像地址和 GitHub。

`npm run verify:fresh` 会创建隔离源码目录、空 npm 缓存，重新安装依赖、下载工具链、构建音频、检查类型、运行 GPU 验证并打包。它需要图形桌面与网络，会弹出测试窗口。结果路径打印在命令末尾。

产物：macOS 为 `build/package/darwin-{x64,arm64}/Haiyue Rubik.app`；Windows 为 `build/package/win32-x64/Haiyue Rubik/`。完整目录包含字体、GLFW、音频库和许可，移动时必须一起复制。macOS 仅临时 ad-hoc 签名，Windows 保留控制台用于验收。正式签名、公证、安装器和商店发行属于后续发布门禁。

## 运行与验证

鼠标操作原有 GPU GUI；数字 `2/3/4`、`M` 切换魔方，空格打乱，左右方向键旋转当前层，Esc 返回首页，F11 切换全屏。标准映射的首个手柄 A 旋转、X 打乱。物理手柄拔插和跨屏 DPI 必须在目标设备补测。

```sh
# Native 根目录：核心测试、无 Engine consumer
npm run validate:p0
# 加入桌面类型检查、自动化魔方/图片/Worker/音频/存储和截图
npm run validate:p0 -- --desktop
# desktop 目录：额外窗口与长时间验证
npm run start -- --window-exercise=1 --seconds=30
npm run start -- --seconds=1800 --exercise=1
# 注入 device.destroy，预期非零退出并报告 device lost
npm run start -- --lose-device-at=100 --seconds=30
```

`verify` 必须产生 420 帧、通过音频与资源探针；不会用“进程 exit 0 但无画面”当成功。截图和日志在 `desktop/build/validation.*`。所有自动化探针与模拟输入、物理设备操作严格分开，见 [Windows 接续验收](WINDOWS-HANDOFF.md) 和 [证据](evidence/README.md)。

## 适配边界

| 能力 | 当前实现与限制 |
| --- | --- |
| 窗口/GPU | 单窗口、单 device，原生 surface；缓存逻辑尺寸/像素尺寸；每帧一次 acquire/present。暂时无 surface 时保留帧回调并重配；连续 120 次前台失败报错；后台临时失败允许等待恢复。device lost/OOM 退出诊断，不假装恢复成功。 |
| 调度 | 主线程 poll → 尺寸同步 → acquire → Engine 帧 → present；有目标 60Hz 的 timer 节流。不是已完成的 display-link 实现，帧节奏/空闲功耗仍需 G07 对比。 |
| GPU GUI | 原有 Engine GUI；Skia 仅栅格化字体图集，不绘制整帧游戏。显式中文字体避免系统回退缺字。 |
| 键鼠/手柄 | GLFW 回调转换为 Engine 事件；失焦补 pointercancel/keyup；原生回调错误延后到主循环。鼠标单指针；没有触屏、IME 合成或浏览器事件系统。 |
| 图片 | `@napi-rs/canvas` 解码 PNG 后显式 writeTexture，探针验证 GPU 读回；不是完整 DOM Image/ImageBitmap 兼容层。 |
| 存储 | `DesktopStorage` 支持 Storage 与成就存储端口；SHA-256 文件名、版本化 key/value 内容、临时文件 fsync + rename。单进程写者，不承诺断电目录元数据持久性或多进程事务。 |
| 音频 | 可选 miniaudio 文件播放、暂停/恢复、销毁；ABI v1。自动探针验证设备 API，不等于人工听音或设备热插拔验收；未模拟 WebAudio 全量接口。 |
| Worker | 原生 Deno module Worker、消息/transferable/terminate 实测；打包动态外部模块需显式 include。没有 DOM Worker 私有扩展兼容承诺。 |
| 系统与成就 | `host/` 不依赖 Engine 运行时；只有 sample 装配 Engine。`@haiyue/native/achievements` 零 Engine/NativeScript 导入；平台 SDK 与 GUI 不在核心内。 |

存档默认位于 macOS `~/Library/Application Support/Haiyue/rubiks-cube-desktop`，Windows `%LOCALAPPDATA%/Haiyue/rubiks-cube-desktop`，可用 `--data=...` 指定测试目录；不会写入安装目录。此次 P0 的开发存储格式为 `*.entry.json`，不自动导入早期临时探针的裸 JSON。

DOM、HTML 视频、浏览器广告 SDK、全量 Canvas2D/WebAudio 和自动迁移所有游戏均未实现。未新增 npm 桌面二进制入口；桌面构建样板留 GitHub，npm 继续仅包含桥接 API。现有移动端入口保留，已发布版本和候选冻结记录不改动。

## 决策与依赖

- [宿主决策及失败实验](HOST-DECISION.md)
- [原生 ABI 与生命周期约定](ABI.md)
- [成就 API 使用说明](../bridge/achievements/README.md)
- [第三方声明](licenses/README.md)

P1 继续实现 Steam、Game Center、Engine extension、完整跨端样例及发布验证。当前代码不是完整 0.2.0 发布候选。
