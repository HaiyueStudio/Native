# Third-party notices

本仓库原创代码采用 [MIT](LICENSE)。`package.json` 的 `license: MIT` 不改变第三方软件、模型、字体、音频或图片原有的许可与署名要求。

## 软件依赖

发布候选的完整 npm 依赖清单位于 `release/candidate.json` 的 `dependencies` 字段，按应用记录所有锁定包的版本、下载地址、完整性校验和锁文件声明的许可证。`UNDECLARED` 表示锁文件未声明，不能据此推断为 MIT。实际许可证与 NOTICE 以相应包内文件为准；再分发时应保留这些文件。

| 直接运行时依赖 | 固定版本 | 包内声明 |
| --- | --- | --- |
| `@haiyue/engine`、`@haiyue/extensions`、`@haiyue/animation-spec` | 0.1.0，本地 vendor 包，按 SHA-256 区分候选内容 | MIT |
| `@nativescript/core` | 9.1.1 | Apache-2.0 |
| `@nativescript/canvas` | 2.1.18 | Apache-2.0 |
| `@nativescript/font-manager` | 1.0.14 | Apache-2.0 |
| `core-js-pure` | 3.50.0 | MIT |
| `wgpu-matrix` | 3.4.2 | MIT |

NativeScript Canvas 还包含原生渲染库；npm 的 license 字段不是其全部原生传递依赖的许可证清单。iOS SwiftPM 固定 revision 见各示例 `locks/Package.resolved`，CocoaPods 见 `locks/Podfile.lock`；Ruby 工具依赖见 `Gemfile.lock`。Android 应用 Maven 图见 Neon Circuit 的 `locks/android-app.lockfile`。发布二进制时需随包提供其所包含组件的完整许可和署名材料。

## 共享游戏素材

游戏源码和素材从相邻的 Games 仓库读取，候选清单记录实际使用范围内的内容哈希；Native 的 MIT 声明不会重新授权这些素材。

- AK47 Range 的 `ren42.glb`、`qiang_ak47.glb` 为用户提供模型。Games 的 `games/ak47-range/assets/provenance.json` 记录原始与转换后的 SHA-256，但不包含再分发许可。
- Neon Circuit 的 `wraith-raider.glb` 当前可读的 glTF metadata 仅记录格式与转换器，未声明许可证。
- 图片、音频的生成记录保留在各游戏的 `assets/*generation.json`、`assets/audio/generation.json`，以及 Native 各应用 `assets/generation.json`。生成记录与第三方授权文件各自保留，不能相互替代。

2026-09-24，用户说明模型来自技术交流群分享、仅限非商用，没有来源链接。目前没有可核实的作者、原始许可名称或授权文本；这项说明不是原作者再分发授权，也不能推定为某一种 Creative Commons 许可。

本次 0.1 发布范围为 Native 源码，不附带上述模型、从 Games 复制或转换的游戏素材，也不附带含模型的 APK / IPA。模型路径、转换代码及内容哈希仅用于开发和校验，不授予模型使用权。需要运行相关示例的开发者应自行取得相应授权或替换模型；替换后应重新冻结自己的候选并验证，不应绕过完整性检查。

本声明没有将模型改为 MIT，也不表示已确认其非商用再分发条件。后续发布含模型的素材包或应用二进制前，仍需取得相应许可并补齐其署名及第三方声明。
