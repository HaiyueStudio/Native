# 设备姿态与陀螺仪（iOS）

`NativeDeviceMotion` 使用 Core Motion 的融合设备姿态，提供前后/左右倾斜、pitch/roll/yaw、四元数、三轴角速度及加速度。目前实现 iOS；不向 Engine 引入 NativeScript 或 Core Motion 依赖。

## 接入

App 的 `Info.plist` 添加：

```xml
<key>NSMotionUsageDescription</key>
<string>读取设备倾斜姿态，用于体感交互。</string>
```

在 App 内创建一个控制器，接入现有 Engine 更新循环：

```ts
import { NativeDeviceMotion } from '../../../bridge/motion/device-motion.ios';

const motion = new NativeDeviceMotion({ updateIntervalMs: 1000 / 60 });
const unsubscribe = motion.onUpdate(sample => {
  const { pitch, roll, yaw } = sample.angles; // 单位：度
  const { right, forward, total } = sample.tilt;
  // right > 0：屏幕右边缘向下；forward > 0：屏幕上边缘向下。
  // sample.deltaMs：本次 Engine 帧间隔。
  // sample.sensorDeltaMs：前后两个新传感器样本的间隔。
});

const updateMotion = ({ detail }: { detail: { delta: number } }) => {
  motion.update(detail.delta);
};
if (motion.start()) engine.on('update', updateMotion);
// start() 为 false：陀螺仪或融合姿态不可用，例如 iOS 模拟器。

// 界面切走、不再需要传感器时：
engine.off('update', updateMotion);
unsubscribe();
motion.dispose();
```

`update()` 返回新样本或 `null`，`latest` 保留最近一次样本。首次获得数据前为 `null`，没有新时间戳时不重复发事件；游戏可每帧读取 `latest`。采集频率由 `updateIntervalMs` 请求（5–1000 毫秒），实际频率由设备决定，事件最多每次 `update()` 发一次。监听回调在调用 `update()` 的线程同步执行，异常向调用方传播。

## 字段与坐标

| 字段 | 单位 / 含义 |
| --- | --- |
| `angles.pitch / roll / yaw` | 度，直接对应 Core Motion 的俯仰、横滚、偏航 |
| `radians.pitch / roll / yaw` | 同一姿态的弧度值 |
| `quaternion` | 原始姿态四元数 `{x,y,z,w}`，适合完整 3D 旋转 |
| `rotationRate` | 设备 X/Y/Z 三轴角速度，弧度/秒，融合后的陀螺仪数据 |
| `gravity` | 设备轴重力向量，单位 g |
| `userAcceleration` | 去除重力后的设备轴加速度，单位 g |
| `tilt.right / forward` | 屏幕右/上方向的重力倾斜投影，−90° 到 +90° |
| `tilt.total` | 屏幕法线偏离面朝上水平姿态的角度：水平面朝上 0°、竖直 90°、面朝下 180° |
| `timestampMs` | 设备启动以来的单调采样时间，毫秒，不是 Unix 时间 |
| `deltaMs / sensorDeltaMs` | 调用方本帧间隔 / 新传感器样本间隔，毫秒；采集开始或恢复后的首个 sensorDeltaMs 为 0 |

设备轴固定在手机的竖屏机身上：X 向右、Y 向顶部、Z 指向屏幕外。Core Motion 的 pitch 绕 X、roll 绕 Y、yaw 绕 Z；使用 `XArbitraryZVertical` 重力对齐参考系，yaw 是任意初始水平参考方向的相对角度，**不是罗盘方位**，也不保证重启采集后参考方向不变。欧拉角会在边界跳变，完整旋转应使用四元数。

屏幕方向变化时调用 `motion.setScreenRotation(0 | 90 | 180 | 270)`。数值表示屏幕坐标轴相对机身竖屏坐标轴的顺时针旋转；0 表示屏幕顶部与机身顶部一致，90 表示屏幕顶部朝机身右侧，270 表示朝机身左侧。仅改变 `tilt.right/forward` 的轴映射，不改变原始姿态和设备轴数据。宿主知道当前界面方向，负责传入该值；桥接不把设备传感器方向误当作锁屏后的界面方向。

## 生命周期与限制

- `start()` 幂等；`stop()` 明确停止，随后应用恢复也不会自动重启。
- 自动监听 Application suspend/resume/exit。挂起停止底层传感器并清除旧样本；只有挂起前请求了采集才在恢复时重启。也可显式调用 `suspend()` / `resume()`。
- `dispose()` 幂等，停止采集并移除全部监听。App 只允许一个存活控制器；所有实例周期共用一个 CMMotionManager，避免重复管理硬件。
- `setUpdateInterval(ms)` 可运行时调整采样请求频率。所有样本复制并冻结，不保留可变原生对象。
- 不建立额外 RAF、轮询计时器或传感器回调队列；沿用游戏主线程更新循环。
- 本接口不提供计步、运动历史、磁北定位或纯原始 gyro 流。需要相对“当前手持姿态”的校准时，应在应用层用四元数建立参考姿态。

## 验证

在 `examples/ak47-range` 执行 `npm run typecheck` 与 `npm test`，包含角度/单位、四种屏幕方向、样本去重、失效时间、单实例、后台恢复及异常清理测试。

该 App 以 `MOTION_VERIFY=1` 启动时采集 120 个真实传感器样本，检查重力、四元数、时间戳、停止及恢复，在 Documents 写入 `native-motion-verification.json`。普通启动不开启传感器，也不改变游戏控制方式。

已完成的真机结果和验证边界见 [evidence/verification.md](./evidence/verification.md)。

依据：[Apple CMMotionManager](https://developer.apple.com/documentation/coremotion/cmmotionmanager)、[设备姿态参考系](https://developer.apple.com/documentation/coremotion/cmattitudereferenceframe)、[Core Motion 用途声明](https://developer.apple.com/documentation/coremotion)。
