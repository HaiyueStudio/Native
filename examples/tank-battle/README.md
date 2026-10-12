# 铁甲前线 / Tank Battle Native

NativeScript App，包名 `org.haiyue.native.tankbattle`，Android / iOS 竖屏，手机仅支持 1P。
左侧固定虚拟摇杆带死区、四方向判定和回中；右侧按住连续开火，支持双指并行。
后台、取消触控、暂停和销毁都会释放操作。前台恢复后需点击继续作战。

游戏源码和原创像素素材在 `../../games/tank-battle`，构建不访问相邻 Games 仓库。
战场与 HUD 都使用 Engine GUI；透明按钮图集只在启动时上传，四方向坦克图集预先打包。
Canvas 2D 仅供原生字体图集初始化。原生宿主沿用 `NativeRenderHost`、多点触控桥、
安全区域和统一启动页，使用原生 PCM 音效与平台设置存档，无 WebView。

## 安装与检查

```sh
npm ci
npm run assets
npm run typecheck
npm test
npm run bundle:android
npm run bundle:ios
```

`bundle:*` 可在当前 Windows 上检查平台代码解析及资源打包，不生成安装包。
2026-10-12 验证：类型检查通过，22 项测试通过，Android/iOS 资源和 JavaScript 打包通过。
APK 构建已尝试，受缺少 Android SDK / JDK 环境配置阻挡；未进行原生真机验收。

## Android

安装 JDK 21、Android SDK（平台和构建工具 36）、设置 `JAVA_HOME` 和 `ANDROID_HOME`：

```sh
npm run build:android
npm run run:android
```

调试 APK 由 NativeScript 输出到 `platforms/android/app/build/outputs/apk/`。
设备需要支持 Vulkan；本项目不在构建脚本中安装系统 SDK。

## iOS

需要 macOS、Xcode、CocoaPods / Bundler 和开发者签名团队：

```sh
bundle install
npm run build:ios -- --teamId YOUR_TEAM_ID
npm run run:ios -- --teamId YOUR_TEAM_ID
```

未加入证书或个人签名文件。当前 Windows 工作区的浏览器验证不能替代 APK/IPA 真机验收。
安装后检查：首次出击、摇杆同时开火、锁屏/切后台恢复、存档冷启动、基地失守与过关。

素材重新打包：在 Native 根目录运行 `python games/tank-battle/pack-mobile.py`（Pillow），
再运行本项目的 `npm run assets`。字体桥和 Canvas 兼容补丁复用仓库既有已审计实现。
摇杆与开火以原生 pointer ID 独立管理，不依赖 GUI 按钮的单一 pressed 状态。
