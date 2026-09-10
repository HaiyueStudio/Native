# 生存射击更新验证 — 2026-09-10

本目录记录生存模式最终源码与实际安装包。初次训练场移植记录保留在上一级，当前版本改为横屏游玩。

## 功能和画面

- 每 3 秒随机场景边缘刷新一名敌兵。固定种子的规则测试验证节拍与位置；游戏通过 Engine NavMesh 寻路绕过 8 处实体掩体。敌人仅通过自己的前方 90° 视野获得玩家位置，丢失目标后搜索最后可见位置。
- 敌我共用 90°、26 米视野判定；掩体阻挡观察、角色位移和子弹。暗区保留地形，敌兵及枪口火光隐藏，敌方弹道也按当前位置可见性隐藏。照亮地面的扇形在掩体边缘截断。
- 100 生命、敌方命中扣 12、敌兵承受 3 发子弹；死亡后 GUI 可重新开始。玩家依旧使用 ren42 与手部挂载 AK47、30 发弹匣、600 rpm 和 2.2 秒装填。
- 强制 iOS 左右横屏；浏览器竖屏暂停并提示旋转。Native Canvas 实际覆盖 932×430 点 / 1864×860 像素，安全区左右各 59 点、底部 21 点；仅 GUI 避让安全区。摇杆使用带 alpha 的颜色。
- 曳光线从 0.045×0.045×0.55 缩小到 0.018×0.018×0.24 米。真实出膛事件请求 Light impact，真实受击请求 Medium impact；强反馈优先，暂停停用，无持续计时器。

## 验证结果

- `game-focused-tests.log`：22 项通过，含 14 项 AK47 规则/资源测试及目录/存档集成。
- `native-typecheck.log`：iOS 项目类型检查通过。`native-tests.log`：8 项通过，覆盖原生双指路由、释放后的捕获、生命周期、横屏策略、全屏设置及 10 Hz 轻反馈/中反馈优先级。
- `games-build-all.log`：全部 25 款游戏完整构建成功。
- `browser-landscape.json`：15 项通过，实际 Chrome WebGPU 检查模型、骨骼持枪、移动/跟随、双指开火、装填、90° 可见性、掩体遮挡及敌人射击。
- `browser-portrait.json`：3 项通过，验证竖屏提示、暂停模拟和禁用移动。两次运行未分类 GPU/浏览器错误均为 0。
- `native-build.log`：最终 iOS .app 构建和签名成功，21 个模型/贴图文件逐字节匹配。
- `iphone-verification.json`：iPhone 15 Plus / Apple A16 / NativeScript Canvas 原生 WebGPU Metal，18 项检查通过，包括实际全屏窗口尺寸、安全区、原生双指输入、敌方受击，以及 8 次轻反馈、3 次中反馈 API 调用。
- `iphone.png`、`browser-landscape.png` 和竖屏截图已经目视检查；敌人隐藏和掩体切断视野符合规则。截图由实际 GPU 读回获得。
- `iphone-host.jsonl`：最终验证包持续呈现到 2760 帧，无 error/failure 事件。
- `normal-launch.json` 与 `iphone-normal-host.jsonl`：关闭 RANGE_VERIFY/RANGE_CAPTURE_FRAME 后普通模式启动成功，1920 帧无错误，日志记录实际 UITouch、射击、击败敌人及死亡停止战斗。没有保留脚本输入。当前手机上是普通游戏模式。

原生自动验证在执行时暂时隔离真实触摸，完成后立即恢复真实触摸并重置本局，以免人工输入改变可重复检查。最后另行启动普通模式，使用正常持久化存档。

震动测试确认 UIKit 两档反馈调用及节拍/优先级，不把调用计数当作对物理振幅或主观手感的测量。测试设备为一台 iPhone 15 Plus，未覆盖所有机型。

## 全仓检查限制

`games-test-all.log`：505 项，483 通过、2 失败、20 跳过、0 取消。两项失败属于已有 MUGEN 问题：HYMUGEN v1 固定哈希与当前数据不符，以及 MUGEN Viewer 对 UI 虚拟列表 slot 的断言不符。未改动对应模块或断言。

`games-typecheck.log`：全仓仍报告 Sky Strike 的两处既有类型错误（levelCarousel.ts 的参数数量，以及 SkyStrikeGame.ts 可选 audio 参数）。AK47 代码无类型错误，Native 项目包含共享 AK47 源码的完整类型检查通过。没有声称全仓测试或 Games 全仓类型检查通过。

iOS 构建原先被共享音频桥的枚举类型阻挡：`Native/bridge/audio/pcm-bank.ios.ts` 对“不循环”的零值补充 `AVAudioPlayerNodeBufferOptions` 类型断言，运行值不变；没有修改 Sky Strike 的玩法代码。

`build-proof.json` 保存最终游戏源码、iOS 入口/方向配置、网页 bundle 与原生 bundle/vendor/executable 的 SHA-256。两个源 GLB 没有改动，资源出处继续由 Games 的 assets/provenance.json 记录。
