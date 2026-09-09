# Native RenderHost 生命周期

Host 初始化生产 Engine 和 surface，场景装配后通过可选 bindInput 回调连接输入。暂停顺序为输入 cancel、Engine.stop、取消待执行帧；恢复刷新布局与绘制尺寸、恢复输入、Engine.run。重复 resume 不添加循环。

销毁先取消输入、释放控制器和原生观察器，再移除 App/layout/GPU 监听并销毁 Engine、释放 surface。初始化中暂停或销毁由状态和 generation 检查阻止迟到启动。失败路径停止输入与呈现，并将原因显示在宿主状态 Label。

示例区分 iOS 后台 root view unload 与永久页面卸载：前者保留已停止 Host 等待恢复；后者销毁。Canvas.ready 只触发一次，重新加载已就绪 Canvas 由 Page.loaded 重建 Host。对应竞态与重入测试位于示例 test/；真机后台行为另有生命周期日志验证。
