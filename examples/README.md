# Native Examples

每个原生 App 示例放在独立子目录中，记录运行平台、依赖、构建安装步骤和对应里程碑。

| 示例 | 平台 | 目标 | 状态 |
| --- | --- | --- | --- |
| [calendar-puzzle](./calendar-puzzle/README.md) | iPhone / iOS | 日历拼图，原生 GUI、触摸拖拽及自动存档 | 已安装；9 项真机交互检查及重启存档恢复通过 |
| [neon-circuit](./neon-circuit/README.md) | iPhone / iOS | 四赛道竞速、原生 PBR 与 GUI、陀螺仪 / 虚拟摇杆驾驶 | 已安装；28 项真机检查及正常冷启动通过 |
| [ak47-range](./ak47-range/README.md) | iPhone / iOS | 第三人称训练场、骨骼持枪、摇杆与双指射击 | 源码及本地数据备份保留；经用户授权换装霓虹竞速 |
| [rubiks-cube](./rubiks-cube/README.md) | iPhone / iOS | 四种魔方，Engine GUI、横竖屏、操作记录还原 | 源码保留；本机已换装前线训练场 |
| [sky-strike](./sky-strike/README.md) | iPhone / iOS | 竖屏射击，1:2 战场、宽屏留边和窄屏视野跟随 | 已安装；真机运行及三种比例自动验证通过 |
| [spider-solitaire](./spider-solitaire/README.md) | iPhone / iOS | 蜘蛛纸牌，横屏、原生存档、4× MSAA | 源码和本地数据备份保留；经用户授权换装日历拼图 |
| [ios-pbr-orbit](./ios-pbr-orbit/README.md) | iPhone / iOS | 原生 WebGPU PBR 立方体，单指 Orbit 相机控制 | G03 已验收：真机静态 PBR、固定相机及粗糙度对照通过；Orbit 待 G04 |

移动端共用宿主适配和工具可在 native 仓库内逐步提取，具体位置随实际复用需求确定。
