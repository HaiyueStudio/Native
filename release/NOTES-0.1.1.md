# Native 0.1.1 源码版

五款游戏代码和自有素材已纳入 Native，可在没有相邻 Games 目录的环境中构建。PBR Orbit 示例原本就在本仓库。源码采用 MIT；第三方依赖和模型保留各自许可。

## 包含内容

- 六个 iOS 示例：PBR Orbit、蜘蛛纸牌、Sky Strike、魔方、AK47 Range、Neon Circuit；另提供 Neon Circuit Android 示例。
- NativeScript / WebGPU 原生桥接、GUI、触控、陀螺仪和震动支持，以及各示例的固定 vendor 依赖。
- 游戏图片、音效和资源转换脚本。构建自动从本仓库的图片和独立本地模型生成运行资源。
- `npm run models:check` 打印模型查找路径并检查 SHA-256；没有模型时可验证全部源码，并构建前四个无需模型的示例。
- 统一 `release:verify`、冻结输入、源码导出、构建记录。修复首次构建遇到的类型路径、Ruby 锁校验和、生成 hook 与 Podfile 绝对路径问题。

## 从源码开始

需要 Node 24.19.0 / npm 11.17.0，其他固定工具版本和平台安装步骤见 [构建指南](README.md)。下载 Source code ZIP/TAR 的用户，应在解压的根目录先执行 `git init`；校验入口通过 Git 枚举文件。也可以直接按发布标签克隆。

```sh
git clone --branch v0.1.1 --depth 1 https://github.com/HaiyueStudio/Native.git
cd Native
npm run release:verify -- --install
npm run models:check
```

仓库私有时，克隆、发布页和源码下载均要求已获仓库授权的 GitHub 账号；不要把凭据写入命令或仓库。不具备权限时 GitHub 可能返回 404。

模型检查默认会在缺失模型时报错，这不影响源码验证。详见 [模型使用路径](../games/ASSETS.md)：提供哪些文件、放在哪里、如何设置外部目录、没有模型时能运行哪些示例，以及替代模型的适配约定。iOS 和 Android 均由开发者使用自己的签名配置，见 [签名指南](SIGNING.md)。

## 验证范围

0.1.1-rc.4 已在两个新目录完成六个 iOS Debug App 与 Neon Circuit Android Debug APK 的构建、签名和依赖锁校验，87 项单元测试全部通过，构建前后输入一致。工具链及包下载缓存允许复用，未复制旧项目的 node_modules、platforms 或 App 产物，见 [全新目录证据](evidence/0.1.1-rc.4/README.md)。

正式 0.1.1 仅增加模型检查入口、使用说明和发布元数据；运行代码、原生适配、素材、依赖及工具链与 rc.4 相同。内容比较和最终源码检查见 [正式版验证](evidence/0.1.1/README.md)。不声称在正式版上重复执行了全部原生编译或真机交互。

## 不包含的内容

不提供第三方 GLB 模型、模型转换产物、APK / IPA / AAB 或签名凭据。ren42、qiang_ak47、wraith-raider 没有可核实的原始许可和下载来源，不能从 MIT 推导其使用或再分发权。AK47 Range 与 Neon Circuit 需要开发者自行提供有权使用且结构兼容的模型；目前没有占位模式。

本次是源码发布，不是 App Store / Play Store 上架。应用版本仍为 0.1.0；源码版本为 0.1.1，不覆盖原有 v0.1.0 标签。
