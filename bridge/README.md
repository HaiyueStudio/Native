# Native Bridge：M16 最小宿主契约

状态：G01 职责契约已落实到 G02 的 render/lifecycle 源码，原生编译、真机呈现、像素校验和暂停恢复已通过。G02 实际候选与验证见 [G02 证据](../../milestones/native/m16-ios-pbr-orbit/evidence/g02-native-host.md)；历史候选与源码审计见 [G01](../../milestones/native/m16-ios-pbr-orbit/evidence/g01-feasibility.md)。仓库逻辑名称为 `native`，本工作区实际目录为 `Native/`，不可另建一个小写目录。

## 模块边界

| 模块 | 负责 | 接入位置 |
| --- | --- | --- |
| [`branding/`](./branding/README.md) | Haiyue 通用启动页、横竖屏品牌布局、首帧淡出与初始化错误显示 | `NativeEngineLaunchPage` 或已有页面中的 `NativeEngineSplash` |
| `render/` | Canvas GPU provider、surface、尺寸、格式检查、每帧呈现与错误诊断 | 通过 `HaiyueEngineOptions.gpu` 和对象 canvas 注入 |
| `input/` | 原生触点身份、单指过滤、逻辑坐标、捕获和取消 | 驱动现有 `OrbitControl`，不重写球面旋转算法 |
| [`motion/`](./motion/README.md) | iOS 陀螺仪融合姿态、各方向倾斜角、角速度与前后台采集管理 | 通过现有 Engine update 读取，提供新样本事件 |
| `lifecycle/` | 唯一帧调度器、前后台、重入保护、取消回调、释放 | 驱动 Engine `run/stop/destroy`；通过宿主 RAF/performance globals 接入现有 FrameLoop，无 Engine API 新增 |
| `files/`、`storage/`、`settings/` | 后续能力，本 Demo 不加载 | 已有 `GameSaveBackend` 是存档边界 |

App 入口只装配上述模块与场景。Bridge 属于 Native 仓库内部 TS 源码，不发布新包，不向 Engine 引入 NativeScript/iOS 依赖。App 只消费 `@haiyue/engine` 公共导出和打包后的 Engine tarball。

## render

- 使用 Canvas 导出的 `GPU` 创建 provider，显式注入 Engine；不用 `navigator.gpu` 的存在与否推断 Metal。
- surface 对象最小行为为 `getContext('webgpu')`、可写绘制像素 `width/height`、逻辑 `clientWidth/clientHeight` 和 `getBoundingClientRect()`。矩形取实际布局；零尺寸时等待布局，不用默认 1 像素证明 ready。
- DPR 固定 `min(Screen.mainScreen.scale, 2)`，绘制尺寸取 `max(1, floor(逻辑尺寸 × DPR))`。resize 时更新 surface，再调用 `engine.resizeToDisplaySize(true)`。竖屏、安全区和输入共享同一逻辑坐标系。
- Canvas 2.1.18 的 `queue.submit()` 不呈现；提交完成后每个已取得当前纹理的帧调用一次 `GPUCanvasContext.presentSurface()`。已使用 Engine 的 `after-update` 接线，并由原生 PNG 读回验证该帧提交先于呈现。不能逐个 pass/submit 呈现，不能在后台或没有取得纹理时盲目呈现。
- `presentSurface` 释放当帧交换链纹理及 view 的 native handle；这些对象不得跨帧缓存。异常中断也要终结已取得的 surface 帧，不能只吞异常继续循环。
- 核对 `getCapabilities(adapter)` 中实际格式/usage；Canvas configure 可能回退格式或 alpha/usage。Engine pipeline 和实际 surface 格式必须相同，无法满足时显示错误，不隐式转 WebGL。
- Engine 现有类型要求 `HTMLCanvasElement`；G02 将经过真机行为验证的兼容转换限制在 Native surface 单一边界，未修改 Engine 公共类型。不得将全局 `window/document` 伪造成浏览器。

## input

选择专用 NativeScript Core `touch` 适配，禁止同时订阅 Canvas 合成 pointer 事件。G04 验证关闭 Canvas 自带触摸处理时 Core recognizer 仍可正常获取取消事件。

- iOS `TouchGestureEventData.getActivePointers()` 对应本次变化的 `UITouch`；`getAllPointers()` 对应整个事件。`Pointer` 没有通用 `getPointerId()`，不能以数组下标或 `getMainPointer()` 当稳定身份。由 `Pointer.ios` 的原生触点身份映射递增 ID，并在真机核实包装对象身份稳定性；若不稳定，使用原生身份比较维护映射。
- 坐标来自 `locationInView`，单位为逻辑点。给 Orbit 的 `clientX/Y` 加上与矩形相同的布局原点，不乘 DPR。转发普通对象，无需构造浏览器 `PointerEvent`。
- 事件字段：`pointerId`、`pointerType: 'touch'`、`button: 0`、`clientX/Y`、`preventDefault()`；目标提供 add/removeEventListener、getBoundingClientRect、setPointerCapture。preventDefault/capture 由 recognizer 的真实行为兜底，不能以空函数声称实现捕获。
- 状态为 idle → primary → idle。第一根新 down 获得主触点，其他触点只登记为忽略；move 只转发主触点。主触点 up/cancel 后不接管已按住的其他手指；只有新的 down 可启动新手势。
- 在暂停、卸载、系统取消前，向 Orbit 派发当前主触点 cancel，释放捕获并清空所有映射。dispose 必须配对移除全部监听。
- 配置 `enableRotate=true`、`enablePan=false`、`enableZoom=false`，`minPhi=0.1`、`maxPhi=π-0.1`。当前 Orbit 双指 pinch 分支未检查 enableZoom，因此单指过滤是必需行为。

## lifecycle

调度契约为 `now(): number`、`requestFrame(callback): number`、`cancelFrame(handle): void`，时间单位毫秒且同一单调时钟。该契约由 lifecycle/frame-scheduler.ts 与 runtime.ts 实现为宿主 globals，不是 Engine option。

- 采用 Core `@nativescript/core/animation-frame`；iOS 连续帧由 CADisplayLink 驱动。其首个 handle 可为 `0`，Bridge 返回自己的正整数 handle，保存与原生 handle 的映射，确保首次回调也可取消。`now` 与帧时间必须使用 Core 相同时间基准。
- 只有 Engine FrameLoop 调度场景；不额外建立一个 App RAF 循环。G02 在构造 Engine 前安装宿主 RAF/performance globals，使 FrameLoop 与 RenderTargetManager 的 resize RAF 使用同一调度器；不改变 Engine 浏览器默认路径与公共 API。
- loaded/ready 且非零布局后 `init → createScene → switchScene → run`；在 await 初始化期间切后台或销毁时，以 generation/token 阻止迟到的异步结果启动循环。
- `Application.suspendEvent`：先取消输入，`engine.stop()`，取消待执行 resize/帧回调。Canvas 的内部后台回调不替代 Engine stop。
- `Application.resumeEvent`：串行恢复，重新测量、确认 surface/device 可用、刷新尺寸，再 run；只允许一次恢复任务。G02 显式关闭设备丢失自动恢复，丢失时停止循环并显示失败原因；完整恢复验收随 G04/G05 进行。
- unloaded/exit/dispose：取消输入与回调，解绑应用/布局/Engine 监听，再销毁控制器、场景和 Engine；销毁重复调用安全。初始化和恢复错误进入原生状态 Label，并记录可导出的原因。

## 后续存档

复用 `@haiyue/engine/save` 的 `GameSaveBackend`：`id`、`capabilities`、异步 `list(gameId)`、`read(gameId, saveId)`、`write(envelope)`、`delete(gameId, saveId)` 和可选 dispose。list 返回完整 envelope。

未来文件后端放 Application Support 私有目录，以逻辑 ID 隔离，使用同目录临时文件与已验证的原子替换，复用现有 serialize/parse。不得把坏文件视为不存在。核对 `structuredClone`、`Object.hasOwn`、文本编解码和原生 I/O 错误；GameSaveService.flush 只等队列，不证明保存成功或磁盘同步。文件选择/分享、缩略图和设置分开接入。详见 [存档架构](../../milestones/native/bridge-architecture.md)。

G02 实测适配还包括：复制 Canvas 会修改的设备 descriptor/features/limits；安装 Core 已有的 AbortController；区分 iOS 后台 Page unloaded 与永久卸载。普通启动不截图，验收环境变量可启用第 120 帧的原生 WebGPU PNG 读回。具体版本、源码哈希、已验证范围和未覆盖扩展路径见 G02 证据。
