# 箱庭迷境 · Android

Boxbound 的横屏原生移动版。与 `Games/games/boxbound` 共享全部关卡、规则、撤销、通关流程、存档模型和 Haiyue 3D 场景；Haiyue GuiSystem 负责 HUD、菜单、地图标签与触控按钮，NativeScript 只提供宿主与系统对话框，通过现有 Native Canvas / Vulkan 宿主渲染，不使用 WebView。启动页复用 `Native/bridge/branding`。

## 操作

- 左侧浮动贴图摇杆（复用 Haiyue VirtualJoystickControls）：默认隐藏；在左侧游戏区域按下，以触点为中心显示，拖动后四方向移动、推箱，松手隐藏并停止。
- 右侧斜排跳跃、下钻（按下立即触发）：跳跃可与摇杆双指配合；下钻进入盒内。
- 右上撤销、退出当前关卡、旅程菜单与齿轮画质设置，均使用无底板图片图标。
- 五个独立存档，通关小关卡后自动保存；暂停、切后台会释放摇杆并完成待写入存档。菜单支持重玩当前关卡和音效开关。
- 保留 Parabox 平面关卡限制、紧凑章节布局和通关后返回章节动画。

应用名称：**箱庭迷境**；包名：`org.haiyue.games.boxbound`。Android 8+，需设备支持 Vulkan / 原生 WebGPU；当前只接入 Android 宿主。

## 构建与安装

与 Games、Engine 仓库放在同一 HaiyueStudio 工作区。使用 Node 22+、JDK 21、Android SDK 36 / Build Tools 36.0.0。默认复用 `Native/.android-tools`，也可设置 `JAVA_HOME`、`ANDROID_HOME`。

```sh
npm ci
npm run typecheck
npm test
npm run build:android
node scripts/device.mjs install
node scripts/device.mjs launch
```

APK 位于 `platforms/android/app/build/outputs/apk/debug/app-debug.apk`。多台设备连接时，设置 `BOXBOUND_ANDROID_SERIAL`。安装使用 `adb install -r`，保留存档。Canvas 原生绑定兼容补丁由构建脚本应用；数组运行时兼容放在本 App 的 `src/runtime.ts`。

## 验证

```sh
node scripts/device.mjs stop
node scripts/device.mjs launch smoke
# 等待完整流程结束后读取日志和截图
node scripts/device.mjs journal evidence/android/smoke-host.jsonl
node scripts/device.mjs capture evidence/android/smoke.png
# 回到正常启动，移除诊断启动参数
node scripts/device.mjs stop
node scripts/device.mjs launch
```

诊断仅在 debug 构建且显式传入 `BOXBOUND_SMOKE` 时运行，使用独立存档命名空间，不改玩家旅程。测试覆盖Canvas 真实多指事件及 Engine GUI 按下事件、持续移动与释放、撤销、进入 Parabox、下钻、通关返回、退出及保存恢复。`test/mobile.test.mjs` 检查输入与游戏会话逻辑。浏览器回归证据见 `evidence/browser`。

2026-09-21：已在连接的 X4000 安卓机安装运行。7 项逻辑测试、20 项真机流程检查和 71 项浏览器回归通过，类型检查及 Android 构建通过。检查范围为 Boxbound 与本原生 App，未修改引擎。详见 `evidence/validation.json`。

正常模式另通过 ADB 实际点击、摇杆滑动与跳跃，强制关闭后从「继续旅程」恢复，槽位、房间、步数和完成记录一致；最终保持正常游戏模式。截图见 `evidence/android/normal-game.png`。

2026-09-21 触控修复：使用公开 `@haiyue/extensions/controls` 的 `VirtualJoystickControls`，原生 MotionEvent 按 pointer ID 接入共享 pointer target。跳跃和下钻在 down 时执行，tap 不再触发操作。持续顶墙只求值一次，不重复重建场景；方向改变后下一帧立即响应。菜单隐藏时不刷新存档按钮。存档改为小关卡通关并返回外层时保存，普通操作不写入；当前应用内暂停再继续保留内存中的进度，重启从最近通关的存档恢复。原有五个存档兼容，初始化新旅程仍会建立存档。Android 存储使用异步 apply，菜单/暂停时完成持久化。验证见 `evidence/touch-controls/validation.json`。

2026-09-21 GUI 与性能：HUD、按钮、存档菜单和地图标签统一为引擎 `GuiRoot/GuiSystem/GuiLabel/GuiButton/GuiImage`。贴图原图及内置 image_gen 提示词位于 `src/assets/ui/`，启动时各缩放上传一次为 256×256 纹理。浮动摇杆使用独立 pointer ID，右手按键不改变摇杆中心；无接触时不绘制摇杆。启动/错误提示和系统确认框仍由宿主提供。

普通移动保留地图模型，按原对象更新玩家及递归副本；无父级的压力板/栅栏也只更新活动部分。跨房间、推箱、撤销、完成关卡等需要改变结构的动作保留完整重建路径。动态存档状态使用明确的字段复制，仍隔离箱子位置、玩家与路线数组。原生宿主使用已有的按需帧调度：静止时不轮询 RAF，触控/动画/音效队列唤醒；GUI 单独变化仅请求重绘。安卓当时采用单采样、2×逻辑分辨率（现已支持下述画质设置），保留完整父级场景和引擎裁剪。当前 Canvas 后端的 GPU 驱动渲染包测试出现兼容错误，正式版本保留稳定 batched 路径。性能基线、最终真机日志、截图及浏览器回归见 `evidence/gui-performance/`。

最终验证：13 项移动端单测、26 项真机检查、195 项浏览器检查及 226 项 Boxbound 规则/性能测试通过。九宫格墙顶凸点合为一个复用模型，保留原造型和材质。X4000 同样 24 次行走/踩板工作负载下，操作平均 25.31 → 5.13 ms，场景更新平均 11.88 → 0.64 ms，GPU 资源估算 118.88 → 53.50 MB；静止后 RAF 调度为零。平均帧间隔 37.31 → 35.86 ms，尚未达到稳定 60 FPS；剩余耗时以原生绘制命令录制为主。仅 debug 隔离测试开启分阶段诊断，正常游戏不开启。结果与限制详见 `evidence/gui-performance/validation.json`。

2026-09-22 draw call：测量实际 GPU draw 计数（含阴影、HUD），而非 `batches` 对象表条目数。阴影对象先按兼容几何体分配连续槽位，不透明颜色差异不拆阴影批次；已有实体换几何体时重新排列已分配槽位，保留逐帧变换脏区上传。游戏静态零件优先复用同几何体/颜色的对象，角色仍保留原实体。未替换 PBR shader 或透明排序。X4000 横屏同负载结果：大世界 1267 → 433，Intro 1 771 → 580，Reference 1 683 → 496；大世界平均帧间隔 36.75 → 34.62 ms，仍有渲染成本待优化。安卓最终包已安装并恢复正常启动。测试、源文件与包指纹以及未通过的环境/全仓检查详见 `evidence/drawcalls/validation.json`。

2026-09-22 阴影对照：默认关闭两盏方向光阴影，光照和材质不变。X4000 1600×720，同一启动内按开/关/关/开测量：大世界帧间隔 31.59 → 18.97 ms，Intro 1 为 48.95 → 19.95 ms，Reference 1 为 51.33 → 21.70 ms；实际 draw call 分别 433 → 243、580 → 159、498 → 292。完整已加载场景三角形（含父级/子级实例）分别为 799,320、1,077,356、506,772。统计只在诊断时运行。测试范围仅 Boxbound，报告见 [阴影对照](evidence/shadows/README.md)。

2026-09-22 HUD 与画质：默认开启 4× MSAA；自动 pixelRatio 跟随设备密度，最高 2，可手动选择 1/1.5/2/3。齿轮面板由引擎 GUI 实现，设置持久化到设备，改变渲染目标在下一帧开始时应用。面板打开时停止游戏输入，关闭后恢复。左上角仅保留区域名称与通关进度，摇杆贴图采用 50% 不透明度。跳跃、下钻和右上角图标由内置 image_gen 生成，完整提示词见 [icons-generation.json](src/assets/ui/icons-generation.json)。贴图一次性缩放上传为 256×256，离开应用场景时统一释放。

关卡盒子去掉四根角柱，侧面不透明度为 24%；章节及出口标签仅在当前区域内、距离角色不超过 2.5 格时显示。角色和普通箱子的六个平面中心各为两片三角形；含圆角的主体共 588 片，装饰另计。定向验证见 `evidence/hud-quality/`。普通 `launch smoke` 只运行功能检查；需要先运行阴影 ABBA 性能对照时使用 `launch profile`。

2026-09-22 入口规则：普通箱子使用纯色与顶部白色平面方框（主体 588 + 标记 8 个三角形）。关卡侧面入口由内部边界墙体决定，非中央开口也有效；无开口的侧面可推箱，不能通过走动或下钻直接入关。四周封闭时跳上盒顶再下钻。入口资格在内部重置之前检查，封闭侧推箱保留内部状态。关卡盒子的入口标识使用同一开口数据，真机与浏览器共用规则。验证证据见 `evidence/box-entry/`。

2026-09-22 ANR 修复：长期游玩时 Canvas Android 一次性 GPU 回调泄漏 pipe 文件句柄，最终触发 `Too many open files` 并卡住图形/UI 线程。修复回调所有权与管道两端释放，四种 ABI 产物通过版本/哈希校验自动补入 Android 构建；不改引擎和存档。真机 20,000 次 GPU 读回与 24 次镜像关卡访问后 FD 为 228 → 230；30 项设备功能检查和 14 项定向单测通过。重建方式见 `vendor/canvas-android/README.md`，完整证据见 `evidence/crash-investigation/README.md`。`launch stress` 仅在 debug 隔离存档模式开启压力循环。
## iPhone 安装与验证

复用同一份游戏规则、场景和引擎 GUI，iOS 使用现有 Metal、UIKit 触控与 AVAudioEngine 适配。画布铺满横屏，固定 HUD 按钮单独遵守刘海和底部手势区的安全边距；存档保存在本机。

```sh
IOS_DEVICE_UDID=<iPhone硬件UDID> IOS_TEAM_ID=<开发团队ID> npm run build:ios
node scripts/device-ios.mjs <设备标识> install
node scripts/device-ios.mjs <设备标识> launch
```

签名也可配置到被忽略的 `App_Resources/iOS/signing.local.xcconfig`。脚本通过 `DEVELOPER_DIR` 使用 Xcode，不更改系统的 xcode-select。图标沿用 Android 的既有矢量形状；构建时将游戏音效转换为 iOS 音频接口需要的 44.1 kHz PCM，不改动共享资源。

`launch smoke` 使用隔离测试存档，检查渲染、引擎指针输入、关卡、镜像、音效和自动存档；结束后用普通 `launch` 回到正常模式。iOS 指针测试通过共用事件入口注入，不冒充 UIKit 真手势测试。日志及截图位于 `evidence/ios/`。


2026-09-22 iPhone 关卡进出优化：棋盘地面按两种颜色合成共享网格，每个房间/预览只需两个地面对象，保留每格两片三角形、原配色、镜像和完整父场景。重进独立关卡只复制该关可重置的箱子，不再深拷贝整份世界。采用引擎既有的逐物体视锥裁剪，避免转场时更新共享空间索引的高开销。类型检查、原生会话与关卡/网格测试及浏览器递归/镜像回归均限定在 Boxbound，未改引擎。

`node scripts/device-ios.mjs <设备标识> launch transitions` 运行有限的隔离存档进出性能对照，逐次记录同步耗时、场景重建、渲染帧和资源数；测试涉及 Intro / Reference / Flip / Clone / Transfer。测试结束读取 `journal` 并用普通 `launch` 恢复游戏。诊断结果见 [iPhone 转场性能](evidence/ios-transitions/README.md)。

2026-09-22 重玩与相邻盒子转场：右上角新增可撤销的小关卡重玩按钮，五个图标缩小 20%、不透明度 75%，触控范围不缩小。跳跃/下钻换成生成的圆形按钮。Reference 5 一次跨越多个盒子边界时组合完整空间变换，保持原角色连续运动与正确的盒子相对位置，撤销沿反向路径播放。墙顶切分按高度选择对角线，消除右上/左下凸角，不增加面数。验证与素材记录见 [专项证据](evidence/replay-adjacent/README.md)。

2026-09-22 地图配色辨识度：根据引用关系选择色相分离的地图主题，并兼顾同屏地图的颜色区分。地图盒子的外壳及末级 LOD 使用内部地图主题，自身引用/克隆/镜像保持相同颜色；普通箱子目标色不变。全量扫描 406 个地图、456 条非自身嵌套引用，接近色系组合已消除。Reference 6 现在为红色地图/递归盒子与青绿色普通地图盒子。验证见 [配色专项](evidence/theme-contrast/README.md)。
