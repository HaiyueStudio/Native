# G06 physical iPhone text input candidate

问题：UTF-16 编辑曾破坏 emoji；预编辑、宿主焦点和键盘遮挡需要真实 UIKit 闭环。

方法：本工程使用当前私有 Engine tarball、原生 UITextView／输入法桥和公开 GUI。GPU 绘制控件，UIKit 提供输入／候选；工具栏保留编辑焦点。字节清单见 `qualified-candidate.json`。它面向 0.2.2 的 G06，包内基础版本仍为 0.2.1；未发布。

结论：尚未进行 Xcode 编译和物理设备验收，不能将静态检查或浏览器合成 IME 视为设备通过。用户提供的环境为 Intel Mac／macOS 26.6.2、iPhone 15 Plus／iOS 27.2 beta；实际版本、Xcode 和连接状态由预检采集。

## 在 Mac 上运行

保留解压后的 `Native/bridge` 与 `Native/examples` 相对位置。终端进入本目录，依次执行：

```sh
node scripts/verify-candidate.mjs
node scripts/mac-preflight.mjs
npm ci --registry=https://registry.npmjs.org
bundle install
npm run typecheck
export IOS_TEAM_ID=你的Apple开发团队ID
npm run build:device
npm run run:ios
```

先查看预检的 `devices.json`，确认设备已解锁、信任 Mac、开启开发者模式且 Xcode 能使用该设备。若预检或构建报错，保留 `artifacts` 和终端错误；不要更新依赖或改签名之外的源码来绕过失败。本例继承既有原生工程的 Ruby 4.0.6／CocoaPods 1.17.0 锁定工具链。签名可通过本地 `signing.local.xcconfig` 配置；不提交证书或私钥。

## 真实设备操作

仅输入测试文字。工具栏 `Select` 为全选，`Save` 为记录检查点。

1. A 初值为 `A😀B`。将光标放在 emoji 后退格，确认得到 `AB`；再用中文拼音输入 `你好`，观察预编辑和候选，选择候选后只提交一次。
2. 再启动一次中文预编辑，按工具栏 `Cancel`。确认预编辑取消，原提交值及选区恢复；重新点字段可以继续输入。
3. B 使用 `é`、`👩🏽‍💻`，删除、选区替换及 Undo／Redo 不拆字素。用 Select／Copy／Cut／Paste 完成实际系统剪贴板往返。密码字段不允许复制；长度 4 的字段不能插入半个 emoji。另检查 Email 和 Decimal 字段的键盘类型提示；类型是键盘提示，不是数值解析器。
4. 多行字段连续输入、移动光标；键盘展开时旋转到横屏再回竖屏。观察当前光标和候选始终可见，输入框切换只有一个原生响应器。
5. 保持预编辑切到主屏或其他应用，再回本应用。确认未静默提交、未重复插入，重新点击可以输入；分别检查键盘显示和隐藏。
6. 按 Save。滚到页面末尾按 End，保存释放证据；再导出日志。肉眼观察的候选位置、键盘遮挡和实际操作结果另行说明，不从自动日志推断。

```sh
node scripts/collect-device.mjs 预检中的设备标识
```

也可在 Finder 的设备文件共享中取出 `g06-text-input.jsonl` 与 `g06-host.jsonl`。保留预检、构建输出和这两份日志，并反馈上述步骤结果。RTL 当前核验逻辑文本与字素编辑；本工程不新增完整双向排版或复杂文字 shaping 承诺。

## Mac 浏览器真实 IME

同一传输包附带已经构建的浏览器示例，无需重新打包。执行：

```sh
node scripts/serve-browser-ime.mjs
```

在这台 Mac 的支持 WebGPU 的浏览器打开终端给出的本地地址。在 A 中全选，使用真实中文输入法预编辑并选择“你好”；在 B 中开始预编辑后按 Esc，确认恢复原文字；切换字段并调整窗口尺寸，观察光标及候选位置。点击右上角 Save real IME evidence，保留终端给出的 JSON，并说明实际观察结果。采集器只读取 GUI 状态并保存到本机，不注入按键；日志不自动授予 IME 通过资格。完成后 Ctrl+C 结束服务器。

Unicode 15.1 数据的完整版权与许可通知随本工程保留在 `UNICODE-LICENSE.txt`；转交 Engine 私有 tarball 时需一同保留该说明。G13 正式 npm 打包还需将相同通知纳入包内。
