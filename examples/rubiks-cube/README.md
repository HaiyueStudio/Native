# 魔方实验室 — iOS

第三款使用仓库内 游戏源码的独立 iPhone App，Bundle ID `org.haiyue.native.rubikscube`，显示名“魔方实验室”。支持二阶、三阶、四阶和会改变外形的镜面魔方。

一个原生 WebGPU / Metal Canvas 绘制 PBR 魔方和 Engine GUI。Native Canvas 2D 只在启动时生成一次中文字形图集。无需远程资源、WebView 或外部图片。游戏规则、动画、选型页、HUD、拖动转层和相机交互均来自 `games/rubiks-cube/`。

小块本体与面片均使用 Engine 圆角盒体几何，使用 45° 透视相机并随横竖屏调整取景。此版本已更新到 iPhone，并归档真机圆角四阶首页截图及运行日志，见 `evidence/rounded-perspective/verification.md`。

`orientation.json` 将初始与支持方向设为 `any`：允许竖屏、左右横屏，排除倒置。画布置于 iOS 安全区内；旋转时通过现有 NativeSurface 重新布局，当前魔方与历史保持不变。触摸取消、退后台和视图卸载会清理手势。后台暂停动画；返回继续。返回首页开启新局，冷启动通过 Engine 单槽存档记住上次选择类型，不恢复旧局。

还原使用本局的完整旋转记录（包括打乱），逆序播放每一步的逆操作。支持撤销单步，以及在当前动画完成后停止回放。公式求解待后续实现。

## 构建

工具链、Engine tarball 和 Canvas 2.1.18 审计补丁与 Spider Solitaire 一致，独立锁定依赖。`vendor/engine-candidate.json` 记录 Engine 包来源；不改 Engine 或共享 bridge。

```sh
npm ci
bundle install
npm run typecheck
npm test
npm run bundle:ios
# 设置 IOS_TEAM_ID，或在忽略文件 App_Resources/iOS/signing.local.xcconfig 中设置 DEVELOPMENT_TEAM。
IOS_DEVICE_UDID=<connected-device> npm run build:device
```

`build:device` 构建 Debug iPhone App 到 `platforms/ios/build/Debug-iphoneos/rubikscube.app`。可通过 `npm run run:ios` 安装启动。

`CUBE_CAPTURE_FRAME=1` 启动参数在第 120 帧保存 `Documents/rubiks-cube-frame.png`。`Documents/rubiks-cube-host.jsonl` 记录有界宿主事件及最近 8 步摘要。默认从选择首页开始。测试入口不会在原生包中运行。

图标为程序生成的三面魔方，运行 `python3 scripts/create-icon.py` 可重建（需 Pillow）；图片不参与游戏渲染。

已安装到 iPhone，Apple A16 / Metal 真机启动、竖屏呈现及二阶旋转/历史还原已由宿主日志验证。真机横屏和四阶仍待操作验收。详见 `evidence/verification.md`。
