# 箱庭迷境 · Android

Boxbound 的横屏原生移动版。与 `Games/games/boxbound` 共享全部关卡、规则、撤销、通关流程、存档模型和 Haiyue 3D 场景；NativeScript 原生控件负责移动端菜单与触控，通过现有 Native Canvas / Vulkan 宿主渲染，不使用 WebView。启动页复用 `Native/bridge/branding`。

## 操作

- 左下半透明摇杆：四方向移动、推箱，按住连续移动，松手停止。
- 右侧斜排跳跃、下钻：跳跃可与摇杆双指配合；下钻进入盒内。
- 右上撤销、退出当前关卡、旅程菜单。
- 五个独立存档，每步自动保存；暂停、切后台会释放摇杆并保存。菜单支持重玩当前关卡和音效开关。
- 保留 Parabox 平面关卡限制、紧凑章节布局和通关后返回章节动画。

应用名称：**箱庭迷境**；包名：`org.haiyue.games.boxbound`。Android 8+，需设备支持 Vulkan / 原生 WebGPU；当前只接入 Android 宿主。

## 构建与安装

与 Games、Engine 仓库放在同一 HaiyueStudio 工作区。使用 Node 22+、JDK 21、Android SDK 36 / Build Tools 36.0.0。默认复用 `Native/.android-tools`，也可设置 `JAVA_HOME`、`ANDROID_HOME`。

```sh
npm ci
npm run typecheck
npm test
npm run build:android
node scripts/device.mjs install
node scripts/device.mjs launch
```

APK 位于 `platforms/android/app/build/outputs/apk/debug/app-debug.apk`。多台设备连接时，设置 `BOXBOUND_ANDROID_SERIAL`。安装使用 `adb install -r`，保留存档。Canvas 原生绑定兼容补丁由构建脚本应用；数组运行时兼容放在本 App 的 `src/runtime.ts`。

## 验证

```sh
node scripts/device.mjs stop
node scripts/device.mjs launch smoke
# 等待完整流程结束后读取日志和截图
node scripts/device.mjs journal evidence/android/smoke-host.jsonl
node scripts/device.mjs capture evidence/android/smoke.png
# 回到正常启动，移除诊断启动参数
node scripts/device.mjs stop
node scripts/device.mjs launch
```

诊断仅在 debug 构建且显式传入 `BOXBOUND_SMOKE` 时运行，使用独立存档命名空间，不改玩家旅程。测试覆盖原生控件双指事件、持续移动与释放、撤销、进入 Parabox、下钻、通关返回、退出及保存恢复。`test/mobile.test.mjs` 检查输入与游戏会话逻辑。浏览器回归证据见 `evidence/browser`。

2026-09-21：已在连接的 X4000 安卓机安装运行。7 项逻辑测试、20 项真机流程检查和 71 项浏览器回归通过，类型检查及 Android 构建通过。检查范围为 Boxbound 与本原生 App，未修改引擎。详见 `evidence/validation.json`。

正常模式另通过 ADB 实际点击、摇杆滑动与跳跃，强制关闭后从「继续旅程」恢复，槽位、房间、步数和完成记录一致；最终保持正常游戏模式。截图见 `evidence/android/normal-game.png`。
