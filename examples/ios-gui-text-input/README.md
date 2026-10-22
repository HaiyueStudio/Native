# G06 physical iPhone text input candidate

问题：UTF-16 编辑曾破坏 emoji；预编辑、宿主焦点和键盘遮挡需要真实 UIKit 闭环。

方法：本工程使用当前私有 Engine tarball、原生 UITextView／输入法桥和公开 GUI。GPU 绘制控件，UIKit 提供输入／候选；工具栏保留编辑焦点。字节清单见 `qualified-candidate.json`。它面向 0.2.2 的 G06，包内基础版本仍为 0.2.1；未发布。

结论：旧候选已通过 Xcode 构建、安装与首帧，第一组真机反馈暴露字符绘制问题，整体设备验收仍未通过。修复后的新候选需独立重建和复验，不能继承旧候选结论。用户提供的环境为 Intel Mac／macOS 26.6.2、iPhone 15 Plus／iOS 27.2 beta；实际版本、Xcode 和连接状态由预检采集。

## 跨平台候选一致性

当前清单使用 schemaVersion 2：仅标记为 `normalization: utf8-lf` 的 UTF-8 文本在校验时将 CRLF 统一为 LF；其他字符、空格、末尾换行仍参与哈希。tarball 等二进制文件始终逐字节校验。浏览器服务器使用同一规则，并分别记录规范化内容与实际发送内容的哈希。

2026-10-22 Mac 修复保留原清单于 `candidate-history/8c4587ae58b3b036.json`，通过 `previousCandidate` 关联新候选。旧浏览器构建已经按当前源码重建，两个 JS 文件均与原清单字节完全一致；Native 保留合并后的宿主错误回调释放修复，经原 Engine tarball 声明与 iOS SDK 静态检查后重新冻结。新候选不继承原候选的真机验收结论。

Mac 构建阶段另外修正了原生启动入口的清单版本检查，使其接受 v1/v2。构建工具固定 webpack 5.110.3：5.112.0 移动了 `WorkerDependency`，与 NativeScript webpack 5.0.38 使用的内部路径不兼容。该依赖修正进入 package/lock 与后续候选；不能沿用修正前的候选 ID 宣称构建通过。

首次真机启动还发现 Canvas 2.1.18 的原生 `writeTexture` 将 ArrayBuffer 直接当作 TypedArray 读取，导致字体图集上传时崩溃。Native surface 在返回设备前安装纹理上传适配，将 BufferSource 转为共享同一内存范围的 Uint8Array，保留布局偏移和原生错误；Engine tarball 不变。修复前的崩溃报告与构建日志保留于 `artifacts/device-acceptance`。

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
3. B 初值为 `é👩🏽‍💻😀😀`：应呈现一个组合字母、一个女程序员和两个独立笑脸。点击两个笑脸之间，应能只删除其中一个；女程序员序列作为一个完整字符。随后测试 删除、选区替换及 Undo／Redo 不拆字素。用 Select／Copy／Cut／Paste 完成实际系统剪贴板往返。密码字段不允许复制；长度 4 的字段不能插入半个 emoji。另检查 Email 和 Decimal 字段的键盘类型提示；类型是键盘提示，不是数值解析器。
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

## 字符绘制修复候选

GUI 字体按 Unicode 15.1 完整字素生成和测量图集，保留彩色字形 RGB，普通文字仍使用主题色与透明度。B 增加两个独立连续 emoji，避免将一个 ZWJ 组合字符的内部码点误判为多个可编辑字符。每次字体上传记录 `font-atlas.coloredPixels`，作为图集含彩色数据的证据；实际字形、点击位置与删除效果仍需肉眼复验。

## 中文缺字与长度上限

真机日志确认 `A😀我`、`A😀啊` 保存完整；旧图集未收录“我”“啊”，因此显示了问号，并非字节截断。GUI 现在按输入框的实际显示内容（包含预编辑和占位文字）补充、缓存字形，并安全替换旧图集；图集按需扩大，自动增长最多至设备上限或 4096 边长，超过容量仍保留既有缺字替代。`maxLength` 继续遵守当前 UTF-16 上限合同，并只在完整字素边界截取；“最多 N 个可见字符”的计数语义属于另一个 API 需求。复验时将限制框的 B 替换为“我”或“啊”，应该完整显示 `A😀我`／`A😀啊`，再追加文字应被拒绝。

## 输入框辅助提示

有限 `maxLength` 的输入框右下角显示“已用长度/上限”；计数与现有 UTF-16 限制一致，因此 `A😀B` 为 `4/4`。预编辑期间显示已提交长度，提交、删除及撤销后更新。单行输入预留右侧空间，多行输入预留底部空间，避免文字与提示重叠。

密码框右侧的眼睛按钮切换遮罩与明文；再次点击或失去焦点后恢复遮罩。点击不会修改值、撤销记录或当前选择，也不会重建安全键盘会话；显示明文时仍禁止复制和剪切。真机检查：点击眼睛来回切换，观察光标位置及键盘；删除限制框文字，再撤销，确认计数同步更新。完成后点 Save。
