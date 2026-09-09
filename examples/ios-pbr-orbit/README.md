# iOS PBR Orbit App

M16 G04 的 private NativeScript App。通过打包后的 HaiYue Engine 和 Canvas/wgpu/Metal，在真实 iPhone 上显示铜色 PBR 立方体，单指驱动已有 OrbitControl。真机输入、后台恢复日志和录屏验收通过，用户确认正常。G02/G03 候选与验收证据作为历史保留。

## 安装与构建

本机已核对 Xcode 26.3 / iOS SDK 26.2、Node 24.19.0、Ruby 4.0.6。Ruby/CocoaPods 版本由 Gemfile.lock 固定；JS 依赖由 package-lock.json 固定。G02 已验收候选为 Core 9.1.1、iOS runtime 9.0.3、Canvas 2.1.18：9.1.0 runtime 的 V8 14.9 与 Canvas 原生 API 不兼容，已留存编译失败证据。

在本目录执行：

```sh
bundle install
npm ci --registry=https://registry.npmjs.org
npm run doctor
npm run typecheck
npm test
```

Xcode 须已添加 Apple 账号并创建有效开发证书。连接并信任 iPhone，启用开发者模式。创建不会提交的 `App_Resources/iOS/signing.local.xcconfig`：

```xcconfig
DEVELOPMENT_TEAM = YOUR_TEAM_ID;
```

脚本显式使用 `/Applications/Xcode.app/Contents/Developer`，无需切换全局 xcode-select；其他安装路径可通过 DEVELOPER_DIR 指定。构建脚本也接受 IOS_TEAM_ID。

```sh
npm run bundle:ios
npm run build:ios
```

`bundle:ios` 生成 native 工程并把 Engine、bridge 和 App JS 打入本地 bundle。`build:ios` 生成签名设备包；首次 Team 尚未登记设备时需要在 Xcode 的 `platforms/ios/iospbrorbit.xcworkspace` 中选择这台 iPhone 并使用自动签名，或使用明确 device destination 的 xcodebuild 自动登记。本仓已提供相同流程：

```sh
IOS_DEVICE_UDID=YOUR_DEVICE_UDID npm run build:device
```

UDID 从 Xcode Devices and Simulators 获取。该脚本读取本机 Team，prepare 后恢复 `locks/Package.resolved` 并禁止 Xcode 自动改动已解析版本，然后针对指定 iPhone 构建。`locks/Podfile.lock` 记录 CocoaPods 集成（当前无 Pod 依赖）；9.0.3 NativeScript framework 随 npm 包携带，Canvas 由其本地 Swift package 接入。签名 `.app` 位于 `platforms/ios/build/Debug-iphoneos/iospbrorbit.app`。

安装和独立启动：

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcrun devicectl device install app --device YOUR_DEVICE_UDID platforms/ios/build/Debug-iphoneos/iospbrorbit.app
xcrun devicectl device process launch --device YOUR_DEVICE_UDID --terminate-existing --console org.haiyue.native.iospbrorbit
```

首次安装后若手机提示开发者未受信任，打开「设置 → 通用 → VPN 与设备管理」，选择对应开发者完成信任；按手机提示允许重启并完成确认。设备信任需由用户在手机上操作。实际启动和呈现结果以 G03 证据为准。

`npm run run:ios` 用于日常开发；独立启动验收使用签名 .app 安装及 devicectl launch，不以开发服务器或热更新成功作为证据。

## 代码与依赖边界

- `src/`：原生 Canvas、状态 Label 与宿主装配。
- `../../bridge/render/`：GPU provider、尺寸/矩形、surface configure/acquire/present。
- `../../bridge/lifecycle/`：正整数帧 handle、统一时钟、Engine init/run/stop/destroy 和失败状态。
- `vendor/haiyue-engine-0.1.0.tgz`：只通过公共导出接入 Engine；候选 revision 与 SHA-256 见同目录 engine-candidate.json。
- `App_Resources/iOS/`：可重建的 App 配置；`platforms/` 是生成目录。

Engine 未添加 NativeScript 依赖。帧调度 globals 及 Core 已有的 AbortController 由宿主在 Engine 构造前安装；没有模拟 window/document。Canvas 内部需要 navigator.gpu，bridge 将其指向同一个显式注入 Engine 的原生 GPU。

失败原因显示在原生 Label；关键事件输出 `[g04]` 并写入 App Documents/g04-host.jsonl，便于导出真机诊断。日志不属于游戏存档 API。

[目标](../../../milestones/native/m16-ios-pbr-orbit/goals/g04-orbit-lifecycle.md)、[当前验证证据](../../../milestones/native/m16-ios-pbr-orbit/evidence/g04-orbit-lifecycle.md)、[iPhone 指南](../../../milestones/native/m16-ios-pbr-orbit/iphone-guide.md)。以上文档位于并列的 milestones 仓库。

## 场景与真机图像

最终参数见 [pbr-scene.ts](./src/pbr-scene.ts)：2 × 2 × 2 铜色 PBR 立方体、半径 6、竖屏垂直 FOV 60°、simple、1x MSAA，光照和物体变换固定。原始 45° 取景裁切的诊断图保留在 evidence/g03/initial-fov45.png。

构建脚本在 prepare/build/run 前执行 [patch-canvas.mjs](./scripts/patch-canvas.mjs)，校验 Canvas 2.1.18 原始文件 SHA-256，补上 render-pass typed-array 动态偏移的默认范围。npm ci 后重新构建会再次应用；不依赖手工改 node_modules。此修正不覆盖未使用的 compute/render-bundle 路径。当前不执行全场景预热：Canvas 的辅助 pipeline 空颜色槽存在原生解析缺陷，实际 PBR 使用 Engine 按需创建路径。

以下为 G03 历史粗糙度验收命令，仅适用于当时构建。当前 G04 的诊断命令见下一节。

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcrun devicectl device process launch --device YOUR_DEVICE_UDID --terminate-existing --environment-variables '{"G03_CAPTURE_FRAME":"1","G03_ROUGHNESS":"0.15"}' org.haiyue.native.iospbrorbit
```

把 0.15 换成 0.75 获取另一对照；省略 G03_ROUGHNESS 为默认 0.28。第 120 帧提交后、present 前，Canvas 从真实 WebGPU 当前 texture 读回 PNG 到 Documents/g03-pbr-0.15.png。先导出 g03-host.jsonl，确认本次启动参数与新的 frame-capture 时间，再读取图像；旧图像不会自动删除，不能当作新证据。

```sh
xcrun devicectl device copy from --device YOUR_DEVICE_UDID --domain-type appDataContainer --domain-identifier org.haiyue.native.iospbrorbit --source Documents/g03-host.jsonl --destination /tmp/g03-host.jsonl
xcrun devicectl device copy from --device YOUR_DEVICE_UDID --domain-type appDataContainer --domain-identifier org.haiyue.native.iospbrorbit --source Documents/g03-pbr-0.15.png --destination /tmp/g03-pbr-0.15.png
python3 scripts/verify-pbr.py evidence/g03
```

若未到 120 帧就 suspend，重新 activate 同一进程并检查新日志；此时不要将 queue.submit 或旧 PNG 当作捕获成功。对照结束后，不带环境变量冷启动 App 即恢复默认 0.28。

[evidence/g03](./evidence/g03/) 保存三张未经编辑的真机 PNG、事件日志、像素比较和浏览器辅助参考。[vendor/g03-native-candidate.json](./vendor/g03-native-candidate.json) 对应已签名、已安装的 G03 候选；G02 的 native-candidate.json 作为历史身份保留。

浏览器参考同样使用 Engine 公共包和同一 src/pbr-scene.ts，执行 `node scripts/prepare-browser-reference.mjs` 生成临时 JS，再通过 Engine 已有 Chrome/WebGPU fixture runner 运行 test/pbr-reference.html。浏览器结果不代替 iPhone。旧 test/browser-smoke.html 和 verify-capture.py 是 G02 清屏回归工具。

## G04 输入与生命周期诊断

`../../bridge/input/` 使用一个 Core touch 观察器，将稳定 UITouch 身份和逻辑坐标传给现有 OrbitControl；禁用 Canvas 合成触摸。首指结束后不接管仍按住的副指。后台取消输入与帧循环，恢复刷新 surface 与尺寸，永久卸载释放控制器、观察器和 Engine。

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcrun devicectl device process launch --device YOUR_DEVICE_UDID --terminate-existing --environment-variables '{"G04_DIAGNOSTICS":"1"}' org.haiyue.native.iospbrorbit
xcrun devicectl device copy from --device YOUR_DEVICE_UDID --domain-type appDataContainer --domain-identifier org.haiyue.native.iospbrorbit --source Documents/g04-host.jsonl --destination /tmp/g04-host.jsonl
python3 scripts/analyze-orbit-log.py /tmp/g04-host.jsonl
node scripts/verify-candidate.mjs
```

move 最多每 100 ms 采样一次，终止事件刷新到文件；日志保留 host-created 与最新 199 条事件。长验收应分段导出并保留原文件。分析脚本核验真实日志中的相机/物体不变量、取消及恢复计数，不能代替录屏视觉复核。

G04_CAPTURE_FRAME=1 在第 120 帧保存真实 WebGPU texture 到 Documents/g04-orbit.png；G03_ROUGHNESS=0.15 或 0.75 仍可用于粗糙度诊断。普通启动为默认 0.28；旧 G03 文件不能视作当前运行结果。

[evidence/g04](./evidence/g04/) 和 [vendor/g04-native-candidate.json](./vendor/g04-native-candidate.json) 保存当前候选输入、相机、生命周期样本及源文件/bundle 哈希。历史候选指纹描述当时快照，当前 G04 工作区不再匹配 G03 源文件快照。

G04 已验收：[72.443 秒原始录屏](./artifacts/g04/recording.mp4) 存于本地忽略目录，哈希由候选校验工具核对；[视觉审核](./evidence/g04/recording-review.json) 记录复核方法、时间段与日志关联。带上 `--recording artifacts/g04/recording.mp4` 可重放日志分析，视觉结果单独保存。G05 的完整集成、稳定性和性能验收尚未执行。
