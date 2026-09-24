# 极速新星 — iOS

独立 iPhone App，Bundle ID `org.haiyue.native.neoncircuit`。共享 `games/neon-circuit/` 的五条赛道、1.8 倍路线、360 / 522 km/h 驾驶规则、PBR 赛车、Engine GUI 轮播与仪表、碰撞火星/烟雾和流动彩虹路面。采用 NativeScript Canvas → wgpu → Metal 原生渲染，资源全部随 App 打包，常规启动无需浏览器或开发服务器。

首页右上角齿轮打开设置面板，可选择“虚拟摇杆”或“陀螺仪”，偏好通过 iOS 设置存储持久化。在左下操作区按下时，浮动摇杆以该触点为中心出现，松开后淡回 36% 不透明度，下次按下重新定位。右下角左侧刹车、右侧油门，分别拥有独立触点；即使手指滑出按钮后松开，也会释放对应油门或刹车，不影响另一个手指。陀螺仪使用真实 Core Motion 姿态，进入比赛、暂停恢复和屏幕旋转时重新校准握持角度；2° 死区和连续滤波抑制手抖，约 24° 相对倾斜达到最大转向。UIKit LandscapeLeft / LandscapeRight 分别映射到运动坐标 270° / 90°，使两种横屏握持方向均朝倾斜的一侧转向。切至后台自动暂停、清空触点并停止传感器，返回后从暂停面板继续。

强制左右横屏。3D 场景铺满屏幕，GUI 根据 `UIView.safeAreaInsets` 避让刘海和手势条。切换赛道会等待当前帧提交完成，移除旧世界、GUI、触控和特效，然后在同一个原生宿主内创建新赛道。

浮动摇杆采用生成的科幻方向盘素材，围绕按下位置随左右转向旋转；刹车和油门按下时分别向后倾斜、下沉，松开时回弹，保持原有固定触控区域。暂停、完赛和撞毁弹窗采用更通透的面板图片，外围输入拦截层完全透明。刷新个人最佳成绩时，金色新纪录图章落在面板右上角并轻微回弹；普通完赛不会沿用上次图章。仪表 HULL 再上移 4 像素。美术来源和完整提示词见 Games 的 `assets/interactive-hud-generation.json`。

默认简体中文；设置面板可即时切换 English / 日本語，涵盖首页、五条赛道介绍、比赛 HUD、过圈、暂停和结算文案。语言通过独立键 `neon.language` 持久化，保留既有 Bundle ID 与成绩存档。验证模式使用内存语言偏好，不覆盖玩家语言选择。生成的齿轮 / 面板及提示词位于 Games 的 `assets/settings-generation.json`。

设置面板标题与确认按钮向内收拢，并使用全屏半透明深色蒙层。撞栏根据规则中结合车速与入射角的冲击强度调用 UIKit 轻 / 中 / 重反馈（阈值 0.36 / 0.66），250 ms 内合并同等或较轻碰撞，较强碰撞可覆盖前一轻反馈；后台停用，没有积压震动。音效由原创 MIDI 离线合成：按钮、赛道切换、撞栏、加速带，以及随速度交叉渐变的引擎循环。采用原生 AVAudioEngine 固定节点池，遵循静音模式；暂停、后台和销毁时停止驾驶声音。说明与生成命令见 Games 的 `neon-circuit/audio/README.md`。

新增盖章、过圈、3 / 2 / 1 / GO 与刹车提示音，以及 30 秒 / 128 BPM 的原创电子循环音乐。音乐只在比赛阶段循环，暂停和结算停止；恢复比赛从曲首开始。盖章声对应动画 0.5 秒落章时刻，普通成绩不触发。音频银行可预解码声明时长不超过 32 秒、44.1 kHz 单声道 PCM，仍使用固定 12 节点池。

## 构建与安装

依赖版本与其他 Native 示例保持一致：Core 9.1.1、iOS runtime 9.0.3、Canvas 2.1.18。本地 Engine/Extensions tarball 指纹见 `vendor/candidates.json`。安装依赖后，构建会自动应用已审计的 Canvas TypedArray 补丁。

```sh
npm ci --legacy-peer-deps
bundle install
npm run typecheck
npm test
PYTHON=/path/to/python-with-pillow IOS_DEVICE_UDID=<device-udid> npm run build:device
```

`scripts/prepare-assets.py` 需要 Pillow，在构建阶段把原始 GLB 的贴图和 PNG 素材转换为直通 alpha 的 RGBA，并记录源文件及像素哈希。自有美术位于本仓库 games/neon-circuit/assets，原始模型由 local-assets/neon-circuit 提供；原生 loader 使用 glTF 的公共预解析资源接口和 AssetManager 上传本地像素。`scripts/sync-game-assets.mjs` 在签名构建后逐字节比较 App 内资源。

签名使用本机忽略文件 `App_Resources/iOS/signing.local.xcconfig` 或 `IOS_TEAM_ID`。生成包：`platforms/ios/build/Debug-iphoneos/neoncircuit.app`。

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcrun devicectl device install app --device <device-id> platforms/ios/build/Debug-iphoneos/neoncircuit.app
xcrun devicectl device process launch --device <device-id> --terminate-existing org.haiyue.native.neoncircuit
```

## 真机验证

2026-09-14 小地图左右修正与两行仪表：[验收记录](./evidence/20260914-compass-direction-v2/provenance.json)、[真机右弯](./evidence/20260914-compass-direction-v2/verification/neon-compass-progress.png)。地图横轴修正为与引擎追尾相机一致，CPU 标记 / GPU 逆采样同步修正，倒置路段保留正确左右；增加真实左弯、右弯与相机矩阵对照，避免仅验证车头朝上而遗漏镜像。计时 / 最佳记录使用按参考轮廓生成的两行上伸面板，圈数移至指南针底部，暂停移至右上角。83 项真机检查、348 项浏览器检查、55 项竞速 / 地图 / 音效测试、5 项原生控制测试通过，两端类型检查和构建通过，51 个打包资源逐字节校验通过，保存 25 张真机截图。全量 Games 612 项中 589 通过、2 失败、1 取消、20 跳过；180 秒限时及无关 HYMUGEN / viewer 等失败见日志，未宣称全量通过。

2026-09-14 一体式仪表与指南针小地图：[验收记录](./evidence/20260914-compass-hud/provenance.json)、[真机界面](./evidence/20260914-compass-hud/verification/neon-compass-turn.png)。81 项真机检查、271 项浏览器检查、53 项竞速 / 音效 / 地图测试及 5 项原生控制测试通过，两端类型检查和构建通过，49 个打包资源逐字节校验通过。检查精确的左 25 / 下 5 偏移、左侧计时整合、44 × 44 暂停热区、小地图朝向与位置更新，并回归五条赛道，保存 25 张真机截图。原生路线追加无阴影描边保证清晰；碰撞测试先停稳再等待冷却，避免上一轮加速带造成的碰撞干扰。全量 Games 606 项中 580 通过、2 失败、4 取消、20 跳过，因既有 MUGEN / Petra 问题在 180 秒后停止，未宣称全量通过。

2026-09-14 比赛音效与循环音乐：[验收记录](./evidence/20260914-race-audio/provenance.json)。新增破纪录落章、真实过圈、3 / 2 / 1 / GO 与行驶刹车音效；原创 128 BPM 电子音乐恰好 30 秒，仅比赛中循环。79 项真机检查、四个代表场景 261 项浏览器检查、48 项竞速 / 音效测试、5 项原生控制测试、2 项原生接口测试通过；两端类型检查及构建通过，47 个打包资源逐字节校验通过。浏览器跨过 30 秒仍保持单个音乐循环；真机验证 14 个 PCM 缓存、倒计时逐项一次、实际过圈与刹车、图章落下只响一次、普通成绩不响及暂停 / 结算清理，保存 23 张截图。全量 Games 测试未重跑，沿用上次记录的无关失败限制。

2026-09-13 MIDI 音效、分级碰撞震动与设置间距：[验收记录](./evidence/20260913-sound-haptics/provenance.json)。72 项真机检查、239 项浏览器检查、45 项竞速 / 音效测试、5 项原生控制测试、2 项原生音频 / 震动接口测试通过；两端类型检查、构建和 39 个打包资源校验通过。真机验证包含六个 WAV 缓存、菜单/赛道/碰撞/加速带声音、两个引擎循环的开始与暂停清理，以及真实轻、中、重碰撞分别触发 UIKit 反馈。全量 Games 测试因无关 MUGEN/Petra 连续失败和超时而停止，日志保留，未宣称全量通过。

2026-09-13 极速新星国际化：[验收记录](./evidence/20260913-localization/provenance.json)、[设置面板](./evidence/20260913-localization/verification/neon-settings-ja.png)。62 项真机检查、268 项浏览器检查、41 项竞速测试与 5 项原生控制测试通过；两端类型检查和构建通过，33 个打包资源校验通过。三语字体、语言即时切换、设置面板输入隔离、双控制模式及五条赛道回归均通过，保存 23 张真机截图。设置使用独立 GuiModal 批次，避免首页文字或共享按钮图片穿透面板。

2026-09-13 圈数横幅与待机方向盘：[验收记录](./evidence/20260913-lap-hud/provenance.json)、[实际过圈截图](./evidence/20260913-lap-hud/verification/neon-lap-banner.png)。56 项真机检查、47 项浏览器检查、39 项竞速测试通过，两端类型检查与构建通过；31 个打包资源校验通过。包含过终点产生圈数横幅、待机透明度、按住变清晰、松开淡回待机，以及五条赛道的检查。

2026-09-13 晴空回旋与 F1 方向盘：[验收记录](./evidence/20260913-sky-coaster/provenance.json)、[方向盘](./evidence/20260913-sky-coaster/verification/neon-wheel-left.png)、[倒置回环](./evidence/20260913-sky-coaster/verification/neon-coaster-loop.png)。53 项真机检查、235 项浏览器检查和 39 项竞速测试通过；两端类型检查与构建通过，30 个打包资源逐字节校验通过，保存 17 张本版真机截图。全量 Games 测试 595 项中 572 通过、3 失败、20 跳过：两项为既有 HYMUGEN / viewer 合约失败，新增场景数量断言已由 29 更新为 34 并在竞速测试中复测通过。

2026-09-13 交互 HUD 更新：[验收记录](./evidence/20260913-interactive-hud/provenance.json)、[方向盘与踏板](./evidence/20260913-interactive-hud/verification/neon-wheel-left.png)、[新纪录结算](./evidence/20260913-interactive-hud/verification/neon-record.png)。46 项真机检查、141 项浏览器检查、36 项竞速单测、两端类型检查和构建通过，29 个打包资源校验通过。新增真机检查覆盖左右旋转、独立踏板按压、透明弹窗、实际过终点产生最佳成绩、盖章过程与普通成绩不沿用图章；保存 13 张当前版本截图。已覆盖安装到手机并恢复正常启动。

2026-09-13 顶部 HUD 更新：[验收记录](./evidence/20260913-top-hud/provenance.json)、[真机截图](./evidence/20260913-top-hud/final/neon-rainbow-road.png)。标题改为窄幅吸顶样式、计时面板采用两行三列皮肤、暂停入口改圆形双竖线；仪表盘缩小 20% 并左移，速度 / 单位 / HULL 上移，单位和 HULL 字号缩小 15%。35 项真机检查、95 项浏览器检查、36 项竞速单测及两端类型检查 / 构建通过。减速测试改在首个加速带之前执行，明确要求没有加速或撞墙干扰。原始美术和完整 ImageGen 提示词见 Games 的 `assets/top-hud-generation.json`。

2026-09-13 操作修复：[第二轮记录](./evidence/20260913-controls-v2/provenance.json)。修正横屏陀螺仪左右方向、拖出按钮后的油门释放，改用按下定位 / 松开隐藏的浮动摇杆。32 项真机检查通过，包含两个不同触点中心、油门滑出释放后连续减速及保留另一根转向手指；原生方向单测 5/5、竞速单测 36/36、两端类型检查和构建通过。网页版自动回归两次等待启动结果超时，未获得本轮浏览器通过证据；保留此前已通过记录，不将旧结果视为本轮通过。

2026-09-13 已安装到 iPhone 15 Plus（Apple A16 GPU）。[验收记录](./evidence/20260913-iphone15plus/provenance.json) 绑定源码、签名包和截图指纹；28 项原生交互 / 渲染检查全部通过，连续切换四条赛道，无宿主或 WebGPU 错误。正常冷启动显示首页，操作偏好持久化；截图见 [首页](./evidence/20260913-iphone15plus/cold-home.png) 和 [彩虹之路](./evidence/20260913-iphone15plus/verification/neon-rainbow-road.png)。

原生转向单测 4/4、共享竞速单测 36/36 和两端类型检查通过；网页版四个代表场景共 188 项检查通过。Games 全量测试运行了 590 项：558 通过、2 失败、10 取消、20 跳过；未通过项属于 HYMUGEN 二进制 / viewer 合约及 Petra 超时，与本次赛车适配无关，未修改这些测试。

原生纹理上传使用命名的 `x/y/z` 坐标，规避 Canvas 2.1.18 对数组 origin 的层号读取差异。赛道切换等待 GPU 队列完成时继续呈现暂停场景，完成后再停止引擎和释放旧场景，保证原生完成回调能够推进。

显式传入 `NEON_VERIFY=1` 才执行自动输入。使用与 UITouch 相同的 native pointer target，检查四赛道切换、双指驾驶、刹车、暂停恢复、碰撞损伤、加速带平滑降速和真实 Core Motion 样本。截图在 Metal surface 提交后、present 前读回。结果写入 `Documents/neon-circuit-verification.json`；宿主日志为 `Documents/neon-circuit-host.jsonl`。自动输入验证不代替人工握持手感验收。

`NEON_CAPTURE_FRAME=1` 在第 120 帧生成截图；`NEON_TRACK=rainbow-road` 指定启动赛道，`NEON_RACE=1` 直接进入倒计时。日常冷启动不启用这些诊断选项。

`NEON_PERF=1` 启用每 120 帧的性能采样，写入同一宿主日志：帧间隔、包含 present 等待的 CPU 回调耗时，以及 iOS thermalState（0 正常、1 轻度、2 严重、3 临界）。额外设置 `NEON_RENDER_DIAGNOSTICS=1` 才采集引擎绘制/上传计数与 GPU 资源存量，避免详细诊断影响帧率对比。CPU 回调耗时不等于 GPU 执行时间，也不等于纯 CPU 忙碌时间；资源估算不等于进程总内存。每批样本最多 600 个，进入后台时清空帧间隔，避免把锁屏时间计入卡顿。普通游玩关闭性能诊断和周期性完整日志，保留首帧、生命周期与错误报告。

App 图标由内置 ImageGen 生成，原图和来源记录在 `assets/`；iOS 图标仅做格式转换与缩放。

本次安装因免费签名的三 App 上限，经用户选择替换“前线训练场”。其完整数据容器已备份到 `../ak47-range/artifacts/neon-migration-20260913/`，包含文件校验清单，原项目源码保留。

第五关“晴空回旋”支持垂直回环、整圈翻转与一圈半爬升螺旋；赛车、路面及相机使用连续的空间坐标，支持倒置驾驶。晴天全景按原始比例打包。虚拟摇杆改用 F1 式开顶、平底双握把造型，图片与提示词见 Games 的 `assets/coaster-generation.json`。

每跑完一圈用生成的科幻横幅显示实时 `LAP n / 3`。方向盘待机时半透明可见，按住后变清晰；暂停、结算和陀螺仪模式仍隐藏。美术与提示词见 Games 的 `assets/lap-generation.json`。

手机比赛 HUD 使用左侧仪表 / 两行计时一体图，仪表向左 25、向下 5 个逻辑像素。右侧指南针小地图与右上角暂停按钮共用一张透明外框，圈数位于指南针底部，44 × 44 暂停热区与圆形按钮对齐。路线由五条真实赛道投影，GPU 根据车头方向旋转，三角标记同步当前位置，白点为起终点；回环竖直时保留最近的水平朝向。当前两张原始 PNG 和 image_gen 提示词位于 Games 的 `assets/hud-v2-generation.json`。

## 2026-09-14 末日赛道与第一人称

新增第六关“熔火末途”，共享网页端的火山全景、熔岩岩石材质、动态喷发与固定步长火球规则。落点提前提示，可通过转向躲避，命中扣血、减速，并触发碰撞声音和手机震动。落点随机序列随重开复位，暂停冻结火球。

方向盘固定在左下安全区，隐形摇杆仍以按下位置作为中心，最大行程 57.5 点（原 46 点的 125%）。设置增加中英日三语的第三人称/第一人称选项，保存为 `neon.camera` 并在开始比赛时应用；第一人称不创建赛车 glTF，原生模型几何按需读取。第一人称受损有四档玻璃裂纹，重开清除；普通视角不分配玻璃纹理。

内置 ImageGen 生成的两张素材及提示词位于 `games/neon-circuit/assets/apocalypse-generation.json`；打包保留全景比例并逐文件校验。原生验收新增固定方向盘、25% 行程扩展、真实落火躲避/命中、暂停冻结、裂纹分级和切回第三人称检查；验收期间临时禁用 iOS 自动锁屏，结束恢复原值。

连续切换压力检查发现 iOS `highwater` 内存终止（原生离屏画布和体积很大的 GPU/图片对象对应的 JS 包装很小，回收不及时）。现在临时光栅画布在帧末上传完成后缩小并释放，字体画布在场景销毁后释放；只在光栅重建/切换完成的边界调用 NativeScript `Utils.GC()`，不在持续驾驶的每一帧触发。保留字体动态更新生命周期，不会提前释放仍用于布局的字体画布。参考 [NativeScript Utils.GC](https://beta.docs.nativescript.org/core/utils)。

### 莫比乌斯星环

共享第七条赛道 `mobius-ring`、双面连续驾驶坐标系、WGSL 动态噪声路面与所有赛道的 15 块三车道短加速带。原生验证矩阵新增莫比乌斯正反面相机检查及截图；火山第一人称验证明确选择 `ashfall`，不再依赖其位于赛道列表末尾。复用已打包的太空资源，无额外图片下载。

三维小地图与网页共享同一 GPU 曲线缓冲与完整姿态投影，已删除按正反面符号翻转的逻辑。原生方向检查改为检查地图三维基向量的变化，保留车辆标记、圈数与暂停布局。

左右撞击裂纹与第二关缓弯使用共享游戏实现。裂纹画布仅在累计伤害产生新变化时创建，上传到一张持久 GPU 纹理后交由现有帧末回收流程释放。霓虹都市新路线成绩使用独立 v5 保存键。

## Android 支持（2026-09-24）

已补 Android 原生 Vulkan 接入、全屏横屏与安全区、虚拟摇杆 / 陀螺仪、三档碰撞震动和音频。构建与验收命令见 [Android 说明](README-ANDROID.md)。

Android 默认启用 `batched` 渲染配置，保留 4× MSAA、原分辨率及游戏内容。X4000 云端港湾固定场景的帧间隔估算由约 42 FPS 提升至 58 FPS；方法、原始采样与最终安装包的回归结果见 [性能记录](evidence/android-performance-20260924/README.md)。
