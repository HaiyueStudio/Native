# Sky Strike 多指交互修复 — 2026-09-26

## 原因与修复

1. NativeTouchInput 默认只转发主触点，因此按住射击后第二根手指的点击没有到达 GUI。为 iOS/Android 增加可选 pointerMode，Sky Strike 启用 all；其他游戏默认 primary 不变。
2. 应用原先以顶部/底部整条 94 点区域过滤游戏输入。现在依据实际 GUI 炸弹/暂停按钮矩形排除新拖拽，其余 HUD 装饰、底部中间空白可拖动；已经开始的拖拽经过按钮也继续控制飞机。
3. 固定依赖 Engine 0.1.0 的 GUI 只有一个 pressed 状态。打包前应用版本和原始 SHA-256 校验的兼容补丁，按 pointerId 记录按下目标。抬起一根手指不再释放另一根手指的按钮，且从空白处拖过按钮不会产生点击。该补丁只作用于这个 Native 示例的固定依赖，不引入 Engine 工作区中其他在途改动。升级 Engine 包后必须重新审计补丁。
4. GUI 延迟处理同一帧的 down/up 时，仅对仍活动的原生触点申请捕获，避免 stale capture 异常。

## 自动验证

- Sky Strike npm test：16/16；typecheck 通过。
- 原 Orbit 输入回归：7/7；AK47 多指回归：2/2。
- 覆盖射击与炸弹并行、两种松手顺序、先点炸弹后开始飞行、滑过暂停不误触、cancel/suspend、同一帧点击、底部中心与按钮区域区分、默认 primary 模式兼容。
- iOS 构建成功，codesign --verify --deep --strict 通过。
- 已安装到当前可连接的 iPhone（iPad 离线，未更新）。
- 真机 SKY_INPUT_PROBE=1 经真实 OrbitPointerTarget、游戏事件队列及打包后的 GuiSystem 注入手指序列；MemorySaveBackend 隔离玩家存档。结果见 probe.json，complete=true、4 项全部通过：
  - 底部中心按下开始射击；
  - 第二根手指释放炸弹，炸弹从 3 减为 2，第一根继续射击；
  - 先松开射击手指仍可释放炸弹，从 2 减为 1；
  - 第二根手指点击暂停成功，射击停止。
- 这项真机自动检查从原生触点适配器之后注入事件，不等同于手工触摸屏幕验证 UIKit 手势识别。
- 最后以 SKY_INPUT_PROBE=0、SKY_PREVIEW_PROBE=0、SKY_PERF=0、SKY_CAPTURE_FRAME=0 重启恢复普通游戏与真实存档。

## 后续 iPad 更新

用户要求后已将同一已验证安装包更新到 iPad Air 第四代。安装前 bundle 哈希与本证据目录记录一致，系统签名校验通过。ipad-probe.json 的 4 项原生事件注入检查全部通过；未改动真实存档。检查后关闭诊断并恢复普通游戏模式。
