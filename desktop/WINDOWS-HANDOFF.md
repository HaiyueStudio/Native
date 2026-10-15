# Windows P0 / P1 接续验收

状态：**待真机验收**。用户已有 Windows 设备，计划在那里继续当前任务。本机是 Intel Mac，已生成 Win32 HWND/HINSTANCE 和 GLFW DLL 构建路径，但没有把交叉编译/静态检查登记为 Windows 运行通过。Apple Silicon Mac 是另一项独立待验收。

## 在 Windows 上继续前

复制/提交本次 Native 的全部源码改动，尤其 `desktop/vendor`、package-lock.json、toolchains.json、host/sample/scripts/licenses、成就核心与测试。不要只复制 npm 包：桌面样板和游戏不发布到 npm。不要复制 macOS 的 node_modules 或 dylib。

安装本仓库要求的 Node 24.19.0 / npm 11.17.0、Visual Studio 的 C++ 桌面工作负载及 Windows SDK。使用 **x64 Native Tools / Developer PowerShell**，确认 `cl` 可执行。安装支持 DX12 的显卡驱动；在本地图形会话中运行，不以无 GPU CI/RDP 回退当验收。

```powershell
cd <Native仓库路径>
npm ci
cd desktop
npm ci
npm run setup
npm run build:audio
npm run verify
npm run package
cd ..
npm test
npm run release:verify -- --profile development --desktop
```

`setup` 按 SHA-256 验证工具下载；无需安装全局 Deno/Rust。音频使用 `/MT` 编译；仍需检查所有打包 DLL 的实际依赖，不假定安装了 Visual Studio 的机器可代表干净玩家环境。

## 独立安装目录验证

```powershell
cd desktop
$install = Join-Path $env:TEMP ('Haiyue-P0-' + [guid]::NewGuid())
Copy-Item -Recurse 'build/package/win32-x64/Haiyue Rubik' $install
$exe = Join-Path $install 'haiyue-rubik.exe'
$before = $env:PATH
try {
  $env:PATH = "$env:SystemRoot\System32;$env:SystemRoot"
  & $exe --focus-window=1 --probes=1 --exercise=1 --frames=420 --seconds=120 "--data=$install-profile" *> 'build/windows-standalone.jsonl'
  if ($LASTEXITCODE -ne 0) { throw 'Independent executable failed' }
} finally { $env:PATH = $before }
```

必须检查日志中的 `ready.os.standalone: true`、`document: false`、`probes` 全部通过及 `complete.frames: 420`。记录 adapter 名称、实际图形后端、Windows/驱动/CPU/GPU/屏幕/DPI、构建源码哈希。`adapter.info` 不一定提供 backend；可以通过 wgpu 诊断或 GPU 调试工具确认 DX12，不将目标配置文字当真实后端证据。

再运行 `npm run verify:fresh`：它创建独立源码目录、空 npm 缓存并重新构建。不得放置相邻 Engine/Games 源码来掩盖缺失依赖。可用另一台未安装开发工具的用户机器验证 DLL/运行时缺失；若仅清空 PATH 测试，应如实写出该限制。

## 交互和窗口清单

1. 用真实鼠标操作四种魔方：旋转、拖拽观察、打乱、按历史还原、返回首页、重启恢复。中文/英文 GUI 不缺字、不被裁剪。
2. `2/3/4/M`、空格、方向键、Esc；按住鼠标/按键时切出应用后松开，再回来无卡键。拖出窗口释放后操作恢复。
3. 至少 20 次 resize，以及反复最小化/恢复；F11 进出全屏，跨显示器/125%–200% DPI，窗口尺寸和命中区域对应。关闭后进程退出，重开无 surface 错误。
4. 标准手柄 A/X；按住按钮时拔出，插回无残留状态。没有手柄就记录待验收，不用单元测试顶替。
5. 人工确认探针声音；检查静音/默认设备改变、暂停恢复、退出；不以 audio API 返回成功当听音或热插拔已通过。
6. `npm run start -- --window-exercise=1 --seconds=30` 应有 0–3 四个 step；这是程序驱动的最小化/全屏专项，不能代替物理输入。
7. `npm run start -- --seconds=1800 --exercise=1` 完整 30 分钟，记录 health、surfaceSkips、RSS 和结束 elapsedMs；前台持续不可获取应退出并诊断，后台临时不可用应恢复。不能只因进程还在就判通过。
8. `npm run start -- --lose-device-at=100 --seconds=30` 预期报 `Device lost` 并非零退出；它是注入测试，不能写成真实驱动故障恢复通过。

## 证据与完成条件

把 `build/validation.jsonl`、GPU 截图、独立程序日志、窗口/30 分钟日志、`build/package/win32-x64/package.json`、物理操作结果和驱动信息整理到 `desktop/evidence/windows-x64/`。敏感用户名/路径可脱敏，失败也保留原因和修复后对应版本，不覆盖成“从未失败”。

更新 milestones M23 的 G01/G02 Windows 栏；Apple Silicon、GameKit/Steam、P1 平台账号和正式签名仍独立保留。满足目标平台全部门禁前 G01/G02 保持 validating；不要直接 bump 版本、重写 0.1.4 candidate、publish、push 或创建标签。

可给 Windows 上的助手这条接续指令：

> 继续 Native 的 M23 P0 验收。先读 desktop/README.md、HOST-DECISION.md、WINDOWS-HANDOFF.md、evidence/README.md 和 milestones 的 m23 状态；执行 Windows x64 构建、独立目录运行、真实输入/窗口、30 分钟稳定性及成就核心检查。发现问题直接修复并补对应回归，不更改已有发布冻结记录，不把 macOS 或模拟测试当 Windows 真机通过。记录结果和剩余 Apple Silicon/P1 门禁。

## P1 成就追加验收

先使用 local 模式检查成就列表、中英文、隐藏项、手动完整还原后的首次/累计/限时解锁，以及重启后的存档。自动还原和撤销不能发放成就。按 [平台接线](../examples/achievements-validation/README.md) 配置 Steam；目前用户尚无 SDK / App ID，不能把 local/mock 当成 Steam 通过。取得合法 SDK 后按 [Steam 构建指南](platform-libs/steam/README.md) 编译并记录版本、运行库哈希，再补真实客户端回调和读回。Game Center 在 iOS/macOS 单独验收。

按 M23 integration 的固定工作量补 Web / 本原生 TS 宿主 / Rust 同画质三轮性能对照；旧 Electron 结果不可替代。将最终日志和制品哈希写入证据，更新 G07 待验收矩阵；不要发布、打标签或覆盖 0.1.4 冻结记录。
