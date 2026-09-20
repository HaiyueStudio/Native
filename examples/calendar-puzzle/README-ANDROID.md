# Android 原生版本

日历拼图共享 Games 的游戏逻辑，通过 NativeScript + Canvas/wgpu 使用 Android Vulkan 渲染，并使用 Android SoundPool 播放短音效。Android 应用 ID 为 `org.haiyue.games.calendarpuzzle`（`native` 是 Java 保留字，因此与 iOS 包名不同），支持横屏与反向横屏。

## 构建环境

- Node.js 22 或以上、JDK 21。
- Android SDK Platform 36、Build Tools 36.0.0、Platform Tools。编译和目标 API 均为 36，最低 API 仍为 26；版本固定在 `App_Resources/Android/gradle.properties`，重新生成平台目录后仍有效。
- Android 运行时固定为 `@nativescript/android@9.0.3`，Canvas 为 2.1.18。
- 构建脚本优先读取 `JAVA_HOME` / `ANDROID_HOME`，否则查找仓库本地的 `Native/.android-tools/jdk/` 和 `Native/.android-tools/sdk/`。本地工具、Gradle 缓存不进入版本控制。
- 真机构建不需要模拟器。NativeScript 9.1 的 doctor 会同时检查模拟器，因此构建脚本在验证 Java、ADB、SDK 和 Build Tools 文件后，通过 `NS_SKIP_ENV_CHECK` 跳过这项额外检查；`doctor:android` 仍会显示完整环境报告。

```sh
cd Native/examples/calendar-puzzle
npm run doctor:android
npm run typecheck
npm test
npm run build:android
npm run run:android
```

这是开发测试 APK，使用 Android 开发签名，可在 USB 调试授权的设备安装；发布商店前需另外配置发布签名。重新安装同签名 APK 会保留存档。

已安装 Android command-line tools 的环境可用以下命令补齐 SDK：

```sh
sdkmanager 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'
sdkmanager --licenses
```

手机需开启 USB 调试并允许这台电脑连接。`adb devices` 显示 `device` 后，`npm run run:android` 会构建、安装并启动应用。

## Android 适配

- 平台后缀选择 Android 触摸、绘制尺寸、方向控制、截图和音频实现。
- MotionEvent 的稳定 pointer ID 转为引擎 PointerEvent；绘制与触摸均使用 DIP，GPU 分辨率独立缩放。
- `sensorLandscape` 与沉浸式全屏；暂停到后台会取消触摸、停止音效并保存进度。
- 中文、英语、日语，日期历史、Worker 求解提示、拼块动画和 8 种音效均复用现有功能。
- iOS 保留原有实现和构建命令。

## API 36 升级（2026-09-20）

编译 SDK、目标 SDK 与 Build Tools 已升级到 36 / 36 / 36.0.0，最终 APK 已核验；测试机已覆盖安装并保留存档。Android 14 真机完整回归 101 项通过，Android 16 模拟器完成原生渲染、部分游戏流程、实际设置交互与返回重进检查。验证中修复了旧页面销毁事件误关新渲染宿主的黑屏问题。

完整覆盖范围、模拟器限制及尚需处理的 16 KB 原生库 RELRO 对齐风险见 [API 36 升级记录](docs/ANDROID-API36.md)。

开发诊断可通过启动 Intent 的 `CALENDAR_SMOKE` / `CALENDAR_CAPTURE_FRAME` 布尔参数启用，正常启动不使用诊断存档。

## 真机兼容处理

- Canvas 2.1.18 在此 Android 运行时上的 `onSubmittedWorkDone` 原生回调会触发 JNI 崩溃。Android bridge 用提交后的 4 字节读回映射等待真实 GPU 完成，同一轮调用合并并复用缓冲区；iOS 路径保持原实现。
- 离屏 Canvas 2D 使用 `willReadFrequently`，避免图标读回中的 GL 杂点；最终游戏仍通过 WebGPU/Vulkan 渲染。
- Android 触摸通过 Core View 注册，禁用 Canvas 合成事件，避免重复输入。
- `Native/tsconfig.json` 为共享 bridge 提供编辑器项目归属，复用本例已固定版本的依赖。检查共享源码：`node examples/calendar-puzzle/node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`（在 Native 目录运行）。

## 通关星标

成功展示提示后，本局记录 `hintUsed`，退出重进仍保留。使用提示通关仅点亮日期；未使用提示通关额外获得金色星星。更换日期或打乱重开会开始新的一局，已获得的星星不会被后续使用提示的通关覆盖。旧记录不推测是否用过提示，因此不自动补星。

设置 `CALENDAR_SMOKE=true` 验证提示通关；同时设置 `CALENDAR_SMOKE_CLEAN=true` 验证独立通关。两种诊断都使用独立存档。

## 本次真机验证

2026-09-20 已在 X4000（Android 14、arm64、Adreno 710）安装验证。提示通关与独立通关分别通过 27 项检查，覆盖星标、存档、日期导航、三语切换、拼块动画与音效；另验证了实际触摸以及切后台后的恢复。

测试安装包位于 `artifacts/android/calendar-puzzle-debug.apk`，构建产物不进入版本控制。验证日志和星标对比截图位于 `evidence/20260919-android/`。

Native 共享源码及 7 个示例的 TypeScript 检查通过，日历拼图 Native 测试 7/7 通过。Games 类型检查、全量游戏构建通过；Games 全量测试 641 项通过、20 项跳过，另有两项已有的 MUGEN 二进制格式/Viewer 断言失败，与本次日历修改无关。

## 连续提示修复（2026-09-20）

设备日志捕获到求解 Worker 的 `ModuleInternal::LoadESModule` / `GlobalHandles::Destroy` 原生 SIGBUS。Android 改用 NativeScript 支持的 CommonJS 构建路径；帧调度桥接同时兼容 Core 的只读 lazy getter。iOS 构建格式不变。

求解客户端复用一个 Worker，只保留一条运行中请求和最新的待处理请求。移动、旋转或切换日期取消结果，不再频繁销毁线程；旧响应通过请求 ID 丢弃，异常和超时可重建线程，退出游戏时释放。当前摆法搜索超时后，完整日期求解有独立预算，可继续提供调整拼块的提示。

X4000 真机回归通过 81 项检查，包括 24 轮连续提示/移动后提示、旋转翻转、6 次线程重建以及原有通关流程。另验证真实触摸和前后台恢复。日志与截图位于 `evidence/20260920-hint-fix/`；求解相关测试 8/8、Native 测试 8/8、Games/Native/bridge 类型检查通过。

## 双击手势修复（2026-09-20）

iOS/Android 共用手势状态机，按屏幕逻辑像素判断：触摸拖动阈值 12，双击间隔最多 420 ms、落点间距最多 32，并要求同一拼块。轻触不改变拼块尺寸和占位；拖动越过阈值才放大，移回原点也不会误判成双击。长按、取消、点击不同拼块或 GUI 都会打断双击序列，鼠标保留更小容差。

Android X4000 回归通过 89 项检查，新增轻触不放大、带手指抖动的双击只旋转一次、旋转动画、长按与拖动误触检查；独立手势测试 5/5 通过。证据位于 `evidence/20260920-double-tap/`。

同组 89 项检查也在 iPhone 15 Plus 完整通过并完成安装。iOS 压力测试另捕获一次离屏 Canvas 绘图触发的 `per-process-limit` 内存终止；共享离屏桥接现统一启用 `willReadFrequently` 的 CPU 栅格化，避免每次文字/提示更新建立 Metal 绘图上下文，最终游戏仍通过 Metal 渲染。修复后完整回归和持续呈现通过，截图已检查；Native 测试更新为 9/9。

## 2026-09-20 载入页与发行准备

加入共享的浅蓝琉璃月牙引擎载入页，首帧后淡出；文字和提示减少 CPU Canvas 分配，正常运行关闭周期性完整诊断写盘。最终调试 APK 已构建并复制到 `artifacts/android/calendar-puzzle-debug.apk`。本轮安卓设备未连接，未进行新版安卓真机安装；iPhone 的共用逻辑已通过回归。[发行准备清单](docs/STORE-RELEASE.zh-CN.md) 中列出正式 AAB、目标 API 升级和内购等后续工作。
