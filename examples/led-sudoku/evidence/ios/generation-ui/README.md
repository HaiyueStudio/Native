# 新数独面板触摸修复

规则表单根布局的 raw touch 监听与 iOS UIButton 的 touch-up 发生冲突：按钮能出现按下效果，却不触发 tap；UISwitch 仍能改变，所以看起来像出题卡住。设备日志只记录打开面板后的 suspend，没有开始出题后的 resume。

修复删除整页触摸监听，仅问号处理 down/up/cancel/move，ScrollView 负责滚动关闭说明。提交或取消有一次性保护，并锁定所有按钮和 Switch；返回选项副本，关闭面板、恢复绘制后才进入异步出题。原始玩家存档不变。

验证：

- Native 专项类型检查通过，6 项测试通过。
- 签名构建成功，已覆盖安装到连接的 iPhone 15 Plus，正常启动恢复 seed 3197345908。
- `test/ios/GenerationUITests.swift` 使用 XCTest 真实触摸，完整流程通过（43.638 秒、0 失败）：取消、选择挑战、滚动并切换四项规则、开始后面板消失、棋盘展示唯一解验证进度、进度消失、重新打开面板并验证所选规则保留、再次取消。日志为 `xcui-tests.log`。
- 真实触摸测试在 iOS 26.3 模拟器进行；iPhone 已有三个免费开发签名应用，额外 XCTest runner 不能安装，未卸载其他应用。
- `loading-on-board.png` 是测试过程中观察到的真实生成提示。直接通知 NativeScript tap 回调的旧 smoke 无法发现这类 UIKit 手势拦截，今后需同时运行真实触摸回归。

本次未修改引擎/规则算法，不执行 Games 或全仓检查。
