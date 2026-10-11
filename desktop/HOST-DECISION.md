# P0 宿主决策 · 2026-10-11

状态：Intel Mac 本机通过；目标 Windows x64 / macOS arm64 门禁待验收。暂定正式实现为 **Deno 2.9.6 CLI/compile 主线程 + GLFW 3.4 + 原生 wgpu**，不采用 `deno desktop raw`，不使用 WebView 回退。目标设备通过后才能关闭 G01/G02。

## 已验证的失败与替代

1. Deno 2.9.0 + Laufey 0.4.0 raw 报 ABI `expected 26, got 25`；raw 的可执行输出还被 `.app` 打包逻辑误判为目录。单写 JSON raw 配置曾落到默认 WebView，不能当 raw 成功。
2. Deno 2.9.6 + Laufey 0.7.0 raw 可执行 JS，但 `getNativeWindow()` 在 worker 线程读取 Cocoa view，触发 `raw-window-metal` 的 `can only access NSView on the main thread`。
3. Deno CLI 的 FFI 调用留在主线程：GLFW 以 `GLFW_NO_API` 创建窗口，Cocoa window/view 或 Win32 HWND/HINSTANCE 交给 `Deno.UnsafeWindowSurface`。该方案已运行原有 Engine 魔方，不需要重写 Rust/winit + deno_core 宿主。
4. 同一主线程入口经 `deno compile` 生成独立应用，临时安装目录运行成功。程序内 `document` 不存在。字体使用原生 Skia 的 N-API 模块；未引入浏览器 UI 层。

`experiments/m23` 保留失败 raw 和初始 GLFW 探针；它们不是用户构建入口。若目标设备否决当前路径，再评估自建 Rust/winit 方案，不同时维护两个正式宿主。

## 锁定身份

- Deno **2.9.6**，源码 v2.9.6 Cargo.toml 固定 **wgpu-core/types 29.0.1**；三种目标发行 ZIP 的 SHA-256 见 `toolchains.json`。
- GLFW **3.4** 官方发行包；macOS universal 与 Windows vc2022 x64 DLL 位置已记录，Windows 仅确认归档包含该文件，未运行。
- `@napi-rs/canvas` **1.0.7**，miniaudio **0.11.22** ABI v1，Noto Sans CJK **Sans2.004**。
- Engine **0.2.1**，本地生产者包 SHA-256 `6fe846d82791301efae42e0da21bd15a9c98da1ef2f0fd210a303e7207c0f518`，生产者仓库 HEAD `7d5580f16e1404f7bd090014d81c3d9989c06a5e`。这是封存的本地 npm pack 制品，不冒充对 npm registry 相同版本的内容证明。
- Native 的当前发布版本仍为 **0.1.4**；desktop 私有开发包为 **0.2.0-dev.0**。没有执行 npm 发布、生产签名或标签操作。

## 已处理的适配问题

- Deno 对 setBindGroup 的 Uint32Array 三参数调用选错重载：桌面兼容层补 `start=0,length`，覆盖 render/compute/bundle encoder，销毁时恢复。普通数组与显式范围保持原语义，有自动测试。
- Native 根 tsconfig 的移动别名可能让构建误取 iOS Engine：esbuild 使用独立配置，检查 metafile，Engine 必须来自 desktop/node_modules 封存包。
- 系统字体回退缺中文字形：显式注册可再分发字体。
- 长时间测试遇到 Invalid Surface Status：帧回调执行前 acquire，已知临时错误跳帧/重配，未知错误与持续前台失败退出；复测已观察到真实临时失败后恢复。完成时长以 evidence 记录为准。

## 仍然开放的门禁

Windows DX12、Apple Silicon Metal 真机；物理键鼠/手柄拔插与跨屏 DPI；生产级帧节奏和空闲功耗；driver device loss（已有显式销毁注入）、音频设备热插拔；发行签名及完整原生依赖许可证汇总。当前开发包仅供本机/团队验收。

Steamworks SDK/App ID/测试账号访问尚未提供；Game Center 需要具体 bundle ID、macOS/iOS capability、后台成就 ID 和测试账号。既有 Apple 开发者账号登录不等于这些服务配置已经完成。以上属于 P1 前置条件，不加载伪平台 SDK。

## 依据

- [Deno compile](https://docs.deno.com/runtime/reference/cli/compile/)
- [Deno FFI](https://docs.deno.com/runtime/fundamentals/ffi/)
- [固定 Deno 依赖](https://github.com/denoland/deno/blob/v2.9.6/Cargo.toml)
- [GLFW 原生窗口接口](https://www.glfw.org/docs/latest/group__native.html)

官方文档只说明 API；上述兼容判断来自本机运行记录，不能代替其他目标设备验证。
