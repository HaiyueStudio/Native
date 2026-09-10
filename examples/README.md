# Native Examples

每个原生 App 示例放在独立子目录中，记录运行平台、依赖、构建安装步骤和对应里程碑。

| 示例 | 平台 | 目标 | 状态 |
| --- | --- | --- | --- |
| [rubiks-cube](./rubiks-cube/README.md) | iPhone / iOS | 四种魔方，Engine GUI、横竖屏、操作记录还原 | 已安装；真机启动、竖屏及历史还原日志通过 |
| [sky-strike](./sky-strike/README.md) | iPhone / iOS | 竖屏射击，1:2 战场、宽屏留边和窄屏视野跟随 | 已安装；真机运行及三种比例自动验证通过 |
| [spider-solitaire](./spider-solitaire/README.md) | iPhone / iOS | 蜘蛛纸牌，横屏、原生存档、4× MSAA | 已安装；GUI、双指缩放与拖拽真机通过 |
| [ios-pbr-orbit](./ios-pbr-orbit/README.md) | iPhone / iOS | 原生 WebGPU PBR 立方体，单指 Orbit 相机控制 | G03 已验收：真机静态 PBR、固定相机及粗糙度对照通过；Orbit 待 G04 |

移动端共用宿主适配和工具可在 native 仓库内逐步提取，具体位置随实际复用需求确定。
