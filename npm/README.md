# @haiyue/native

Haiyue Native 的移动端 WebGPU 示例源码与初始化命令，包含六个原生示例和五款游戏实现。源码版本为 **0.1.0**，与 GitHub `native-v0.1.0` 冻结输入一致。

## 创建可构建项目

准备 Node **24.19.0**、npm **11.17.0**、Git 和 tar，在已存在的父目录下执行：

```sh
npx --yes @haiyue/native@0.1.0 init my-native-app
cd my-native-app
npm run release:verify -- --install
```

也可安装后使用 `haiyue-native` 命令。目标目录必须不存在；初始化检查源码归档的 SHA-256，解压锁文件和源码，初始化本地 Git 工作目录，再校验全部冻结输入。初始化不安装原生 SDK、npm 依赖或手机应用。

这是可独立构建的项目源码包。原生宿主、六个应用入口和固定引擎依赖均在生成的项目里；不提供 `import ... from '@haiyue/native'` 的单一库入口。

包内源码包含自有美术与固定依赖，压缩后约 192 MiB，首次下载和解压需要一些时间。源码以归档形式保存，避免 npm 打包时省略 package-lock.json、.gitignore 等构建必需文件。

## 模型、平台与签名

- PBR Orbit、蜘蛛纸牌、Sky Strike、魔方无需外部模型。
- AK47 Range 需要 `local-assets/ak47-range/ren42.glb` 和 `qiang_ak47.glb`。
- Neon Circuit 需要 `local-assets/neon-circuit/wraith-raider.glb`。

三个模型没有可核实的原始许可及下载来源，不随包分发；没有占位或自动下载模式。`npm run models:check` 会打印所需路径并校验哈希。缺少模型不影响全部源码检查，仍可构建前四个示例。

生成项目内的 `games/ASSETS.md` 说明替代模型与配置方式，`release/README.md` 说明固定 Xcode、Ruby、Python、Android SDK/JDK 工具链，`release/SIGNING.md` 说明开发者自己的签名。原生构建需另行安装相应平台工具。

## 验证与许可

源码已通过六个应用类型检查、依赖检查和 88 项测试。[源码发布与验证范围](https://github.com/HaiyueStudio/Native/releases/tag/native-v0.1.0) 区分本轮源码检查与历史原生构建、真机记录。npm 包额外验证解压结果和安装后的 CLI。

源码采用 MIT；引擎 vendor 和其他第三方依赖保留各自许可，见生成项目中的 THIRD_PARTY_NOTICES.md。模型不属于 MIT 授权范围。包中不包含模型转换产物、签名、APK/IPA/AAB、历史验收图片或开发机缓存。
