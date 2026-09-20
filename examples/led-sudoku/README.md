# 流光数独 · iPhone / Android Native

应用 ID：`org.haiyue.games.ledsudoku`。独立应用，竖屏展示，不覆盖日历拼图等其他测试应用。

使用已有 NativeScript 9.1.1 / iOS 与 Android 9.0.3 / Canvas 2.1.18 宿主，Haiyue Engine 经 Canvas/wgpu 在 iOS Metal / Android Vulkan 上绘制棋盘；不是 WebView。只使用 Engine 公共包和公开 experimental RenderIntegration。引擎候选固定在 `vendor/haiyue-engine-0.1.0.tgz`。

## 共享与布局

- 启动时使用 [Haiyue 通用启动页](../../bridge/branding/README.md) 的竖屏布局，先展示引擎标志，棋盘首次实际呈现后淡出；前后台切换与打开设置不重播。品牌资源及布局由 Native Bridge 统一提供。
- 直接复用 `Games/games/led-sudoku/rules.ts`、`session.ts` 和 `board-painter.ts`。十四种规则、部分 LED 线索、唯一解生成、提示文案与网页端一致。
- 顶部为紧凑标题、LED 计时和进度；中上方方形棋盘；下方工具栏和 3×3 候选按钮；底部为新数独、规则、答案。按实际 DIP 和安全区布局，小屏自动允许滚动。
- 候选和时钟由轻量原生七段灯视图组成。候选触控区域至少 44 DIP 高；关闭 LED 后切换普通数字。
- 新数独面板使用原生控件，规则列表独立滚动。兼容规则可组合，开启冲突规则时自动关闭旧选项并给出原因，使用持久 CommonJS Worker 出题；请求 ID 拒绝过期回包，超时可重试。
- 挑战档按实际候选推演筛题：用尽唯一候选和完整单元唯一位置后，仍至少保留四分之一的初始空格（且不少于 12 格），同时保证唯一解。LED/附加线索更稀疏，摩天大楼空白方向没有可见数限制。旧存档不变，新规则从新开棋局生效。
- 出题使用共享模型的增量数字掩码和结构缓存优化，保留随机序列、唯一解检查及挑战门槛；相同种子的题目保持一致。桌面 18 题对比及复现方法见 [生成性能记录](../../../Games/games/led-sudoku/evidence/generation-performance.md)。真机诊断另外记录 `generation-timing`，包含新局请求至 UI 更新的耗时。
- 连续数紫线从一端到另一端必须每步差 1，整条线升序或降序；候选与生成器同步约束。旧版无序 Renban 棋局保留原规则并在说明中标明，点击新数独后采用新规则。
- 笔记、撤销、擦除、提示、推理解释、显示答案确认、完成边框闪烁均保留。点击棋盘下方说明可查看本格的完整规则，包括排除点的数字集合。
- 存档使用 Engine SaveService + NativeSettingsStorage，独立的应用私有存储；输入与前后台切换时保存。暂停取消触摸并停止渲染，恢复重新测量。按需渲染：计时只更新原生 HUD，不持续上传棋盘纹理。

## 新规则与显示

灯管无辉光与阴影，暗管统一为 `#162b33`，全暗灯管仍完整显示。摩天大楼启用时，棋盘四周留出线索区域，网页与原生触摸共用同一坐标映射。

- 温度计：青绿色粗管，从圆形灯泡到平头严格递增。
- 摩天大楼：外圈四侧数字代表从该侧向内看的可见楼数。
- XV：紫色矩形字母牌，V 和为 5、X 和为 10，所有符合的边均标记；无标记也形成约束。
- 四数和：蓝色菱形 `Σ数字`，表示交点周围四格之和，不额外要求四格互异。

互斥组合：温度计 / Renban；摩天大楼 / 缺一门；XV / 数比、相邻连续；四数和 / 排除点。约束同时在设置、生成、存档校验中执行。

## 构建与安装

需要 Node.js 22+、JDK 21、Android SDK 36 / Build Tools 36.0.0。构建脚本复用 Native 目录中的本地工具和 Gradle 缓存，与 calendar-puzzle Android 方案一致。

```sh
cd Native/examples/led-sudoku
npm ci
npm run typecheck
npm test
npm run build:android
../../.android-tools/sdk/platform-tools/adb install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk
../../.android-tools/sdk/platform-tools/adb shell am start -n org.haiyue.games.ledsudoku/com.tns.NativeScriptActivity
```

本工作区离线 npm 缓存缺少一个已有依赖，首次搭建从已安装并固定版本的 calendar-puzzle node_modules 做了 APFS 独立克隆；没有使用符号链接或修改原应用依赖。源码保留完整 package-lock，联网环境可正常 `npm ci`。生成物与本地依赖不进入版本控制。

## iPhone 构建与安装

沿用 Native 中已有 iOS 方案，最低 iOS 15，限定 iPhone 竖屏。UIKit 负责刘海和底部手势区，内容只添加 8 pt 留白，较小屏幕可滚动。原生 Metal 棋盘、Worker 出题、14 个规则开关与 Android 共用实现。

需要 Xcode、项目 Gemfile 中固定版本的 Bundler / CocoaPods，及有效 Apple 开发签名。`App_Resources/iOS/signing.local.xcconfig` 为忽略的本机配置，也可以设置 `IOS_TEAM_ID`。新应用必须有匹配 `org.haiyue.games.ledsudoku` 的开发描述文件；其他示例应用的描述文件不能用于本应用。

```sh
npm run build:ios
node scripts/device-ios.mjs DEVICE_IDENTIFIER install
node scripts/device-ios.mjs DEVICE_IDENTIFIER launch
```

签名和账号可用后，上述命令生成并安装 `platforms/ios/build/Debug-iphoneos/ledsudoku.app`。不修改系统 xcode-select 配置，脚本使用 `DEVELOPER_DIR`，默认 `/Applications/Xcode.app/Contents/Developer`。应用图标采用九宫格、六个不同数字、全暗空格和琥珀色局部灯段，保留无辉光 LED 风格。运行 `python3 scripts/generate-ios-icons.py` 从同一套几何生成 iOS 各尺寸图标、Android 矢量图标和 `App_Resources/branding/icon.svg`，无外部素材依赖。

调试真机检查：`node scripts/device-ios.mjs DEVICE_IDENTIFIER launch smoke`。只在 Debug 构建接受环境变量 `LED_SMOKE=1`，使用独立诊断存档。`launch capture` 使用 `LED_CAPTURE=1` 检查正常棋局在界面稳定后的布局与截图，不执行自动填数。结果和可选截图在应用 Documents 中，通过 `journal` / `capture` 命令导出；`splash 输出路径.png` 可导出开屏截图。正常启动不会截图或运行诊断。

## 验证

`npm test` 覆盖手机布局、共享输入转换、普通模式与变体存档、Worker 取消/错误、全暗灯管绘制。共享规则的 124 项测试在 Games 仓库运行。

调试 APK 支持启动 Intent 布尔参数 `LED_SMOKE=true`，自动验证原生出题、笔记、输入、撤销、提示、全部规则、唯一解、普通模式与存档。该模式使用独立诊断存档，不覆盖玩家存档；发行构建忽略此参数。诊断结果写入应用私有目录 `led-sudoku-host.jsonl`。普通启动不执行自动诊断。

真机截图、检查结果和构建记录见 `evidence/`；iPhone 15 Plus / iOS 18.7.3 已完成安装、Metal 显示、21 项自动检查和正常存档恢复，详见 [iPhone 验证记录](./evidence/ios/README.md)。可安装 APK 位于被忽略的 `artifacts/android/`，签名 iPhone 应用压缩包位于 `artifacts/ios/`。
