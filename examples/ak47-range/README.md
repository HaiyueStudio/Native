# 前线训练场 — iOS

2026-09-13：因免费开发签名的三 App 上限，经用户明确选择，已从本机 iPhone 卸载并换装霓虹竞速。卸载前完整备份了数据容器，位于 `artifacts/neon-migration-20260913/container/`；同目录 `manifest.json` 记录 61 个文件的大小和 SHA-256，`backup.json` / `uninstall.json` 记录设备操作结果。项目源码和构建资源保留。

独立 App，Bundle ID `org.haiyue.native.ak47range`，显示名“前线训练场”。共享 `games/ak47-range/` 的角色场景、规则、骨骼持枪、跟随相机和 Engine GUI。使用 NativeScript Canvas 的原生 WebGPU/Metal，强制左右横屏，画面全屏延伸至安全区背景，GUI 按 UIView.safeAreaInsets 避让刘海和底部手势条。手机上替换魔方 App；魔方项目源码仍保留。

左下虚拟摇杆移动，右下射击按钮按住即展开为瞄准摇杆并连射，拖动独立控制枪口方向；松手停止并恢复按钮。空仓自动装填，持续按住射击时装填后继续连射，装填按钮也可提前补满弹匣。共享版本已加入每 3 秒刷新同款 ren42 持枪敌兵（10 米有效射程）、掩体绕行/遮挡、玩家 120° / 敌人 60° 战争迷雾、右上半透明敌情雷达、生命和重新开始。玩家材质偏蓝，敌人保留原迷彩色。双方死亡后播放一次 death 动画，保持末帧并在死亡满 5 秒移除模型，死亡敌兵立即从雷达消失。开火按真实出膛事件触发轻度连续震动，受击触发中度震动；后台挂起时禁用反馈。原生触摸通过 `OrbitPointerTarget` 的 all 模式分别管理左右手，生命周期取消会停止两种操作。截图和自动交互只有显式验证环境变量启动时启用。

`src/models.ts` 使用 glTF 公共的 `assetWorker` 预解析输入及按资源名共享的 `AssetManager`（独立骨骼实例共用贴图与解析输入），读取本地 JSON/bin，上传预解码 RGBA，保持纹理 sRGB 语义。模型不依赖网络、Blob、浏览器图片解码或 WebView。`scripts/sync-game-assets.mjs` 在构建前从 local-assets/ak47-range 的 GLB 生成资源；详见 ../../games/ASSETS.md。

## 构建

```sh
npm ci --legacy-peer-deps
bundle install
npm run typecheck
npm test
IOS_DEVICE_UDID=<device-udid> npm run build:device
```

签名复用本机忽略文件 `App_Resources/iOS/signing.local.xcconfig`，或设置 `IOS_TEAM_ID`。产物为 `platforms/ios/build/Debug-iphoneos/ak47range.app`。Engine/Extensions 的本地 tarball 候选由 `vendor/candidates.json` 记录，不发布包。

启动参数 `RANGE_VERIFY=1` 会通过同一个原生 pointer target 执行移动、跟随、双摇杆独立瞄准、按钮/摇杆切换、中心保持方向、GUI 装填、松手、取消、120°/60° 视野、掩体遮挡、敌方命中检查，在 Documents 写入 `ak47-range-verification.json` 和 `ak47-range-verified.png`。它验证原生输入分发链，不代替人工 UITouch 手感验收。`RANGE_CAPTURE_FRAME=1` 在第 120 帧另存 `ak47-range-frame.png`。常规冷启动不执行脚本输入。

运行日志为 Documents 下的 `ak47-range-host.jsonl`，包含 Metal 呈现和游戏状态。真机证据与验证范围见 `evidence/player-tint/verification.md`。
