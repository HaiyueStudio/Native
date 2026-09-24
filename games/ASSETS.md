# 模型使用与素材准备

游戏源码、自有图片和音效已包含在 Native 中，无需 Games 仓库。三个第三方模型没有可核实的原作者授权及下载来源，因此源码包不包含模型，也不提供下载链接或自动下载功能；它们不属于本仓库的 MIT 授权。

## 没有模型时能运行什么

| 示例 | 是否需要另外提供模型 | 输入文件 |
| --- | --- | --- |
| PBR Orbit、蜘蛛纸牌、Sky Strike、魔方 | 不需要 | 无 |
| AK47 Range | 需要 | ren42.glb、qiang_ak47.glb |
| Neon Circuit | 需要 | wraith-raider.glb |

没有模型仍可执行全部源码检查 `npm run release:verify -- --install`。构建时选择前四个示例，例如：

```sh
# 在 Native 根目录执行；iOS 工具链和自己的签名按 release/README.md 准备。
IOS_TEAM_ID=<your-team> npm run release:verify -- --install --profile build --platform ios --app rubiks-cube
```

AK47 Range 和 Neon Circuit 当前没有占位模型模式，缺少模型时会明确报错，不能仅凭源码包直接运行。项目维护者目前也没有可提供的授权下载渠道；请从你有权使用的原始副本获取，或自行取得可适配模型的许可。

## 已有原模型：放置、检查、构建

路径相对于 **Native 仓库根目录**，文件名和大小写必须一致。复制原始 GLB，勿将 ZIP、预览图片或生成的 glTF/bin 改名为 GLB。

```text
Native/
  local-assets/                    # 已加入 .gitignore，不提交
    ak47-range/
      ren42.glb
      qiang_ak47.glb
    neon-circuit/
      wraith-raider.glb
```

先进行无第三方依赖、无需 Python 的模型检查：

```sh
npm run models:check
npm run models:check -- --app ak47-range
npm run models:check -- --app neon-circuit
```

成功表示文件与 `release/model-inputs.json` 的 SHA-256 相符，**不代表已验证使用许可**。失败会打印实际查找路径，退出码为 1，不会回退读取 Games、自动下载或修改冻结哈希。

也可以将模型保存在仓库外。该目录下仍需有 `ak47-range/` 与 `neon-circuit/` 子目录：

```sh
export HAIYUE_MODEL_ASSETS="/absolute/path/to/my-models"
npm run models:check -- --app neon-circuit
# Python 3.12.14 / Pillow 12.3.0；Ruby 依赖按各示例 Gemfile.lock 安装。
export PYTHON="/absolute/path/to/python3"
export IOS_TEAM_ID="<your-team>"
npm run release:verify -- --install --profile build --platform ios --app neon-circuit
```

不设置 HAIYUE_MODEL_ASSETS 时默认使用 Native/local-assets。需要取消外部覆盖时执行 `unset HAIYUE_MODEL_ASSETS`。同一个终端中的检查与构建使用相同环境变量。Android 另按示例的 [Android 指南](../examples/neon-circuit/README-ANDROID.md) 设置 SDK / JDK。

## 使用替代模型

替代模型不可能匹配原始哈希，而且仅改成相同文件名不保证兼容。需要同时处理许可、资源适配及新候选：

1. 保留替代素材的作者、来源、许可和署名要求；确认自己的使用与分发方式得到允许。
2. 适配模型结构。ren42 当前需要右手骨骼 `1seal_skeleton_Bip01 R Hand`，以及 `run_top2`、`reload_top`、`run_bottom`、`idle_bottom`、`death` 动画；坐标、缩放、持枪和枪口偏移在 [SoldierModel.ts](ak47-range/SoldierModel.ts) 中。枪械转换仅保留 mesh 名以 `ak_47_reference` 开头的部件，见 [转换脚本](../scripts/assets/prepare-ak47-assets.py)。赛车的资源加载及姿态约定见 [原生模型加载](../examples/neon-circuit/src/models.ts) 和 [游戏实现](neon-circuit/main.ts)。现有转换器要求 GLB 内嵌二进制数据及可由 Pillow 解码的内嵌图片，其他布局或压缩格式需另行适配。
3. 对审核后的新文件计算 SHA-256，例如 `shasum -a 256 local-assets/neon-circuit/wraith-raider.glb`，更新 `release/model-inputs.json` 中对应项；这只是记录新输入，不授予素材许可。
4. 将根 package.json / package-lock.json 和 release/config.json 的候选版本一起递增，执行 `npm run release:freeze`，再运行源码、原生构建与真机验证。不要修改既有发布标签，不要删除完整性检查来冒充原版本。

替换后的结果是你自己的新候选，不能沿用原模型的验收结论。

## 运行资源由构建自动生成

- Sky Strike：scripts/assets/pack-sky-sprites.py 将仓库内 PNG 转为 sprites.json / sprites.rgba，并复制音效与关卡。
- AK47 Range：scripts/assets/prepare-ak47-assets.py 将本地 GLB 转为 glTF、bin、RGBA 和 provenance.json。
- Neon Circuit：examples/neon-circuit/scripts/prepare-assets.py 转换仓库内美术和本地赛车模型，并复制音效。

prepare/build 自动写入 ignored 的 examples/<app>/src/game-assets/。不要提交这些转换产物或包含模型的 APK/IPA；公开分发前仍需解决模型的再分发许可。
