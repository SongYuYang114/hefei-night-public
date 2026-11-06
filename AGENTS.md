# 合肥惊魂夜开发约定

- 正式开发仓库：https://github.com/galaxy-of-homos/hefei-night ，默认分支 main。后续开发使用本仓库。
- 游戏逻辑和界面源码直接位于 dist/，这里同时存放运行资源，必须跟踪提交；不是可以清理的临时构建目录。
- 当前版本以 package.json 为准；联机协议定义在 dist/direct-room.mjs 和 signaling.cjs。
- npm ci 安装依赖，npm start 启动源码版，npm run build 构建 Windows EXE；构建产物输出到仓库外的 build-v<版本>/。
- 运行模型位于 dist/assets/，原始 Blender 模型位于 resources/models/，导出和验证脚本位于 tools/。
- 玩法修改选择对应 tools/test-*.mjs 或实际游戏验证；联网测试可能访问房间服务，按需要运行。
- 保留用户已经确定的角色配置和玩法规则，版本更新记入 MODLOG.md。
- 不提交 node_modules、EXE、录屏、临时文件、私钥、Token 或本机凭据。
