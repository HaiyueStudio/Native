# 前线训练场初始版本验证记录 — 2026-09-10

双摇杆最新证据见 [twin-stick/verification.md](twin-stick/verification.md)。生存玩法更新证据见 [survival/verification.md](survival/verification.md)。以下记录保留初次移植时的验证范围，不代表当前版本支持竖屏游玩。

## 已完成

- Games 新增 manifest 游戏 `ak47-range`，原始两个 GLB 字节保留，生成资源带 SHA-256。
- 第三人称斜俯视透视相机跟随、骨骼挂枪、上下身动画、虚拟摇杆、双指连射、装填、子弹回收及训练记录存档。
- Games 类型检查通过；新游戏、Pages 目录和单槽存档共 15 项专项检查通过。
- `GAME_BUILD_TIMEOUT_MS=180000 npm run build` 完整构建全部 25 款游戏通过。
- macOS Chrome 原生 WebGPU 430×860 与 932×430：每个方向 10 项交互检查通过，无未分类浏览器/GPU 错误，截图已目视检查。修正了原模型动画骨盆原点导致脚部位于地板下的问题。
- Native 类型检查和 6 项测试通过。独立 App 构建、自动签名成功。最终 .app 内 21 个模型/贴图文件与 Games 派生资源逐字节校验通过。
- 用户明确要求的 `org.haiyue.native.rubikscube` 已从 iPhone 卸载，`org.haiyue.native.ak47range` 已安装。Sky Strike 和蜘蛛纸牌仍在设备上。魔方源码保留。

## 真机结果与范围

最终版本已在 iPhone 15 Plus / Apple A16 / 原生 WebGPU Metal 启动。8 项原生交互检查全部通过：glTF 与手部挂枪、移动、跟随、双指边跑边射击、松手停止、Engine GUI 装填、装填完成、触摸取消。`iphone-verification.json` 为结构化结果，`iphone.png` 为原生 Canvas GPU 读回截图，已经目视检查。最终宿主日志无 error/capture-error/failure-cleanup，并持续呈现超过 4000 帧。随后关闭验证/截图开关进行常规冷启动，满弹匣 30 发、射击数 0、无自动输入、模型挂枪与呈现正常；手机保留在普通游戏中。

初次运行暴露 GUI 在同帧按下/松手后请求捕获已结束触点的问题，已在本 App 的 Native 输入边界修复，只忽略已确认的 inactive-touch 捕获错误，其他异常仍抛出；新增回归测试通过。`iphone-first-run-capture-regression.jsonl` 保留该修复前记录。截图监听在宿主 present 之前注册，验证结果与截图均来自修复后的包。

此次真机自动检查采用与 UITouch 相同的 native pointer target，未声称完成多机型、真机横屏或人工操作手感验收。横竖屏布局由浏览器两种尺寸验证，原生方向策略及安全区布局沿用既有桥接并通过单元检查。

## 全仓检查限制

全仓 `npm test` 首次运行记录为 498 项：468 通过、4 失败、6 超时取消、20 跳过。新游戏初次接入的缩略图和存档入口失败已修复，专项重跑全部通过。剩余范围外问题：MUGEN HYMUGEN 固定哈希不符、MUGEN Viewer 对现有 UI 虚拟列表的断言不符，以及 Petra 本地资源测试超时。未修改这些模块、快照或测试时限；不宣称全仓测试通过。

## 证据

- `build-proof.json`：当前源码、网页 bundle、Native bundle/vendor/executable SHA-256；本地工作区候选，未发布。
- `browser-portrait.*`、`browser-landscape.*`：最终浏览器结果和截图，包含真实资源/设备来源记录。
- `native-build.log`、`native-typecheck.log`、`native-tests.log`：原生构建与检查。
- `games-build-all.log`、`games-typecheck.log`、`game-focused-tests.log`、`games-test-all.log`：完整构建、专项通过与未通过全仓检查的原始记录。
- `uninstall-cube.json`、`install-final.json`、`launch-locked.json`：设备操作结果与启动限制。
