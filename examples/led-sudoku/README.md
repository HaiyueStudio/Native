# 流光数独 · iPhone / Android Native

应用 ID：`org.haiyue.games.ledsudoku`。独立应用，竖屏展示，不覆盖日历拼图等其他测试应用。

使用已有 NativeScript 9.1.1 / iOS 与 Android 9.0.3 / Canvas 2.1.18 宿主，Haiyue Engine 经 Canvas/wgpu 在 iOS Metal / Android Vulkan 上绘制棋盘；不是 WebView。只使用 Engine 公共包和公开 experimental RenderIntegration。引擎候选固定在 `vendor/haiyue-engine-0.1.0.tgz`。

## 共享与布局

- 启动时使用 [Haiyue 通用启动页](../../bridge/branding/README.md) 的竖屏布局，先展示引擎标志，棋盘首次实际呈现后淡出；前后台切换与打开设置不重播。品牌资源及布局由 Native Bridge 统一提供。
- 直接复用 `Games/games/led-sudoku/rules.ts`、`session.ts` 和 `board-painter.ts`。全部附加规则、部分 LED 线索、唯一解生成、提示文案与网页端一致。
- 顶部为紧凑标题、LED 计时和进度；中上方方形棋盘；下方工具栏和 3×3 候选按钮；底部为新数独、规则、答案。按实际 DIP 和安全区布局，小屏自动压缩棋盘，确保操作区完整显示。
- HUD、候选和时钟由共享 Haiyue GuiSystem 绘制，七段数字经 GuiImage 显示。候选触控区域至少 44 DIP 高；关闭 LED 后切换普通数字。
- 新数独和设置全部使用引擎 GuiButton、GuiSwitch、GuiSelect、GuiModal；规则列表使用 GuiScrollView 滚动，圆形描边问号点击打开 GuiHelpDialog。兼容规则可组合，开启冲突规则时自动关闭旧选项并给出原因，使用持久 CommonJS Worker 出题；请求 ID 拒绝过期回包，超时可重试。
- 挑战档按实际候选推演筛题：用尽唯一候选和完整单元唯一位置后，仍至少保留四分之一的初始空格（且不少于 12 格），同时保证唯一解。LED/附加线索更稀疏，摩天大楼空白方向没有可见数限制。旧存档不变，新规则从新开棋局生效。
- 出题使用共享模型的增量数字掩码和结构缓存优化，保留随机序列、唯一解检查及挑战门槛；相同种子的题目保持一致。桌面 18 题对比及复现方法见 [生成性能记录](../../../Games/games/led-sudoku/evidence/generation-performance.md)。真机诊断另外记录 `generation-timing`，包含新局请求至 UI 更新的耗时。
- 连续数紫线从一端到另一端必须每步差 1，整条线升序或降序；候选与生成器同步约束。旧版无序 Renban 棋局保留原规则并在说明中标明，点击新数独后采用新规则。
- 笔记、撤销、擦除、提示、推理解释、显示答案确认、完成边框闪烁均保留。工具栏使用六个方形图标（含齿轮）；底部说明移除，解释通过独立面板显示。
- 存档使用 Engine SaveService + NativeSettingsStorage，独立的应用私有存储；输入与前后台切换时保存。暂停取消触摸并停止渲染，恢复重新测量。按需渲染：计时只更新引擎 GUI 时钟纹理，不持续上传棋盘纹理。

## 偏好与精简线索

齿轮面板支持中文、English、日本語下拉选择，界面、提示、规则说明同步切换并保存在独立偏好存储。自动过滤候选默认开启；关闭后可填入 1–9。盘面候选默认关闭，仅在自动过滤开启时可用，按 3×3 展示。笔记模式点击候选会加删除线，再点恢复，不再高亮；划去标记支持撤销和存档。关闭盘面候选时，当前笔记格及已有笔记仍显示候选。新数独的圆形问号点击显示说明；点击关闭按钮或外侧蒙层关闭，长说明可以滚动。

附加规则按约束强度降低已知数目标，每次挖空仍证明唯一解。随后先删两端均已知、已知 1/9 端隐含的不等号和已知格奇偶等明显冗余线索，再按分组删除验证，保留至少一个所选规则标记（多对角线至少两条）。精简搜索使用确定性节点预算，不能证明就保留；XV/白点的完整标记与杀手笼覆盖不删。同一版本内同种子保持确定性；新生成题目采用此策略，玩家旧题不改。

仅修改游戏时，运行本目录类型检查/测试与 Games 的 led-sudoku 专项测试、单游戏构建；没有引擎变更时不运行全仓检查。

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

调试真机检查：`node scripts/device-ios.mjs DEVICE_IDENTIFIER launch gui`。只在 Debug 构建接受环境变量 `LED_GUI_SMOKE=1`（兼容旧 LED_SMOKE / LED_STAIRCASE_SMOKE），使用独立诊断存档。`launch capture` 使用 `LED_CAPTURE=1` 检查正常棋局在界面稳定后的布局与截图，不执行自动填数。结果和可选截图在应用 Documents 中，通过 `journal` / `capture` 命令导出；`splash 输出路径.png` 可导出开屏截图。正常启动不会截图或运行诊断。

## 验证

`npm test` 覆盖手机布局、共享输入转换、普通模式与变体存档、Worker 取消/错误、全暗灯管绘制。共享规则与候选设置的 148 项测试在 Games 仓库运行。

调试 APK 支持启动 Intent 布尔参数 `LED_SMOKE=true`，自动验证原生出题、笔记、输入、撤销、提示、全部规则、唯一解、普通模式与存档。该模式使用独立诊断存档，不覆盖玩家存档；发行构建忽略此参数。诊断结果写入应用私有目录 `led-sudoku-host.jsonl`。普通启动不执行自动诊断。

真机截图、检查结果和构建记录见 `evidence/`；iPhone 15 Plus / iOS 18.7.3 已完成安装、Metal 显示、21 项自动检查和正常存档恢复，详见 [iPhone 验证记录](./evidence/ios/README.md)。可安装 APK 位于被忽略的 `artifacts/android/`，签名 iPhone 应用压缩包位于 `artifacts/ios/`。

候选删减提示与网页共用纯规则逻辑。无直接填数时，高亮可排除候选的格子；解释末页提供“应用到笔记”，随后自动进入笔记模式。关闭解释不改动笔记，确认后可继续提示或撤销，存档保留已确认的候选推理。中文、英语、日语均覆盖。

高级提示已覆盖实际“缺门 + XV”卡住棋局：候选配对、XY/XYZ-Wing、隐性数组和逐步候选推理链均复用共享逻辑；截图棋局通过可解释提示可推出全部剩余 46 格。专项纯逻辑测试覆盖 XV 配对与推理链的讲解、应用笔记与撤销；GUI 真机检查覆盖解释翻页、应用笔记和持久撤销。

解释会识别已划去的“格子 + 数字”，重新验证后跳过已完成排除，部分完成时只提示剩余结果；同格新排除显示“进一步排除”。手动划去不会被当作证明前提。回归包含手动 XV 排除、再次解释、应用笔记与撤销。

开启自动候选过滤时，盘面笔记和数字键也同步过滤已被当前基础规则排除的旧删除线；撤销、擦除、载入和切换过滤设置后立即更新。高级技巧的有效删除线继续显示并可恢复。

完成盘面后，“答案”按钮禁用；撤销到未完成状态后恢复。完成瞬间播放一次约 2.2 秒的格子背景扫光，从左上角沿对角方向到右下角，不给数字添加辉光。载入已完成存档、普通重绘和回到前台不会重复播放；新局、撤销及离开前台会停止动画。

皮肤支持“深色流光”和“晴空浅蓝”，独立于棋局保存，切换不重置进度。Native 在齿轮设置的皮肤下拉框切换，支持中文、英文、日文；网页版在同一个齿轮设置页选择。浅蓝配色覆盖盘面、LED 暗段、候选笔记、规则标记、计时器与面板；浅色 UI 使用无色调压缩的场景输出，保留配色本身的明亮度。

额外区域：每块轮廓色块含 9 个格子，作为额外的宫约束 1–9 各出现一次。默认从偏移方宫、参考图不规则形状中选择四块四方旋转对称布局，字母 A/B/C/D 区分区域。不可与缺一门、奇偶底色叠加；候选、基础提示和高级推理共用额外宫约束。

不连续：上下左右相邻的可填格不能相差 1，斜角不受此规则限制；不添加棋盘符号，与白点连续、紫色连续线互斥。完整解构造使用位集合候选传播、邻格弧一致性、唯一位置传播和候选较少格优先搜索；题面仍走有预算的唯一解验证。与额外区域组合时，先构造有效完整解，再长出两块各 9 格的紧凑中心对称区域，避免强行匹配固定四宫模板带来的长时间搜索。笔记提示支持不连续候选配对和推理链。

### 小杀手数独

新数独面板可以启用小杀手：外围橙色数字与斜箭头表示从箭头入口至另一侧边缘的沿线总和。沿线数字不额外要求互异，仍服从行、列、宫及已启用规则。为保证手机边缘清晰，与摩天大楼、缺一门互斥。

生成使用可达和动态规划与候选区间剪枝，唯一解仍由有预算的搜索验证；删去全已填线索、已由完整九格区域确定的总和，并在预算内减少冗余箭头。求和提示支持候选排除、逐步说明、笔记应用和中英日文。网页、Native 共享规则与外围布局，箭头留白不响应格子输入。

### 求和条件联立提示

已有技巧找不到下一步时，增加 45 法则、求和区域相减（消去共有格）和受行列宫互异约束的局部组合筛选。覆盖小杀手、杀手笼、四数和及 XV；仅完整九格互异区域允许使用总和 45，缺一门的八格区域不适用。小杀手斜线不额外要求数字互异。

最多枚举七个未知格；全局与单个方程都有确定的节点预算，未完整检查的组合不会用于候选排除。不读取保存的答案，也不进行整盘试填。中英日解释依次展示原始求和条件、已填数字、共有格相消、局部组合和候选排除，再由玩家应用到笔记。保留撤销及后续提示进度。

`evidence/hints/little-killer-45-stalled.json`（Games）保留安卓截图对应棋局：由第一宫总和 45 与顶部斜线 26 推出 R2C1=8，应用求和技巧后可沿 59 次逻辑提示完成整盘。参考：[Innies and Outies / 45 rule](https://www.sudokuwiki.org/Innies_and_Outies)。

### 无缘数独

新增可选 `antiKing` 规则（默认关闭）：左上、右上、左下、右下紧邻的可填格不能同数，包括跨宫相邻格；不限制整条对角线。无额外盘面符号，支持中文、英语、日语说明。生成、唯一解验证、候选与分步提示共享相同约束，缺门格不参与。旧存档不自动启用。与不连续组合时优先尝试经完整约束检查的构造终盘，再由原有求解器验证删数后的唯一解。

### 阶梯数独

新数独面板增加阶梯规则及中英日点击说明。采用 12×12 外接布局、12 个 3×3 宫、108 个可填格；行列跨空白缺口仍各包含 1–9。与网页共享动态盘面拓扑、候选、唯一解生成、高级提示及笔记逻辑。可叠加 LED 与奇偶，其他附加规则暂时互斥。深浅皮肤、竖屏键盘及完成扫光适配新盘面，旧九宫存档兼容。

历史阶梯版本的验证记录见 `evidence/staircase/README.md`。当前入口已替换为共享引擎 GUI，旧原生 HUD/设置/解释控件已移除。

## 引擎 GUI 验证

`node scripts/device.mjs launch gui` / `node scripts/device-ios.mjs DEVICE launch gui` 使用独立测试存档，验证引擎触点命中、设置切换、点击帮助和规则滚动、Worker 新局、解释翻页、应用候选排除、重载后撤销以及答案确认。旧 smoke/staircase 启动参数兼容映射到新 GUI 检查。安卓结束后 `stop` 再 `launch`，iPhone `launch`（不带参数）恢复正常玩家存档。`journal` 导出日志，iPhone `gui evidence/gui/ios` 导出界面截图。

核心 UI 位于 `Games/games/led-sudoku/engine-gui.ts`；`engine-page.ts` 只负责原生图形表面、触摸、Worker、持久化和生命周期。设置、生成页和提示不再依赖 NativeScript 的按钮/开关/下拉框/系统 alert。撤销历史最多 200 步随存档持久化，提示剔除的候选在重启后也能撤销。iPhone 按安全区测量值排布控件，而渲染表面覆盖完整原生画布。
