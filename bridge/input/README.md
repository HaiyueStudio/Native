# Native Orbit 输入

`pointer-target.ts` 提供 OrbitControl 使用的窄事件目标，坐标与布局矩形均为 UIKit 逻辑单位。它只转发当前首指；主指结束后不接管仍按住的手指。DPR 只影响绘制大小。角度、极角限制、target/radius 数学全部使用 Engine 的公共 OrbitControl。

`native-touch.ios.ts` 使用一个 Core GesturesObserver，按原生 UITouch 身份而非临时 JS wrapper 分配 pointerId。Canvas.ignoreTouchEvents 必须开启以避免重复派发。UIKit recognizer 持有触摸直到 up/cancel，离开原始视图仍可结束；目标的 capture 状态用于匹配控制器语义。

暂停先取消输入并清除原生身份，恢复重新接收 down，销毁断开观察器与 unloaded 监听。示例的 `orbit-session.ts` 负责连接相机及诊断采样。测试使用打包 Engine 的实际控制器；真机证据在示例 `evidence/g04/`，录屏核验状态见里程碑 G04 证据。

可选 `new NativeTouchInput(view, sample, { pinchZoom: true })` 增加 `orbitTarget`，用于把多个指针交给 Engine OrbitControl。原 `target` 仍为纸牌/GUI 提供首指事件；第二指加入时取消该交互，双指阶段结束后必须全部松手才能重新开始。三指和后台中断会取消整组手势。未启用此选项的 PBR 示例保持原首指规则。
