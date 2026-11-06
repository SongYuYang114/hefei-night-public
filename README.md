# 合肥惊魂夜

基于 Three.js + Electron 的 3D 1v4 非对称追逃游戏。正式分发从 **1.0.0** 开始，玩法基于原 v1.34.1，联机协议 **36**。

开发和发布仓库：[galaxy-of-homos/hefei-night](https://github.com/galaxy-of-homos/hefei-night)。导入源码来源：[SongYuYang114/hefei-night-public](https://github.com/SongYuYang114/hefei-night-public)。

## 登录器与更新

Windows x64 用户从 [GitHub Releases](https://github.com/galaxy-of-homos/hefei-night/releases) 获取 `HefeiNight-版本号-win-x64.exe`，双击进入登录器。自动检查更新，也可手动检查、下载、取消并重启应用更新。首次使用不需要账号。

GitHub 检查或下载失败时，尝试管理员配置的备用下载源。管理员通过独立渠道提供 `hefei-runtime.json`，放在 EXE 旁边运行一次后保存在当前用户目录；未配置时仅使用 GitHub。两个源都不可用时仍可启动当前游戏。备用下载源只提供版本文件，与 P2P 游戏联机无关。

## 运行与构建

需要 Windows x64、Node.js 24 与 npm。首次运行：

```powershell
npm ci
npm start
npm run start:game      # 开发时直接启动游戏
npm test               # 更新器与网络传输回归
npm run test:game       # 现有玩法回归
npm run test:launcher   # Electron 登录器与游戏启动验证
```

生成 Windows 便携版：

```powershell
npm run build
```

构建输出在 `../build-v版本号/`。打包后执行 `npm run release:audit` 检查配置隔离，执行 `npm run release:prepare` 生成签名分发产物。版本管理和分发流程以 [SOP.md](SOP.md) 为准。

## 游戏内容

- 七名求生者：白给、2980、猪脸、宋玉莹、长腿猪脸、欧比旺、Olo。
- 两名追杀者：宋雨杨（经典）、AI嘉豪宋雨杨。普通攻击为横向肘击。
- 无对局倒计时；修复任意五台电机后开门逃离。所有仍在场求生者被囚禁且无人能够使用 yzm 自救时，追杀者获胜。
- 地图宝箱、技能与道具、AI 队友和追杀者、库奇、五只普通哈基米及一只传说橘猫。
- 传说橘猫近身三连挠：整套对求生者造成一次伤害，对追杀者造成三秒眩晕；撞车时把汽车顶飞。
- AI嘉豪形态期间颈椎病暂不生效，随机生成三个全员可见的本人跳舞幻影，猫咪会对幻影哈气。

## 联机与操作

对局数据使用 **P2P 直连**；六位房间号服务只交换连接信息。旧游戏中继保持关闭。可使用手动邀请与回应连接。所有玩家应使用相同版本；没有可用的直连路径时，服务不会转为对局中继。

WASD 移动，鼠标转动视角，滚轮缩放；Q 技能，E 道具，F 交互或原地自疗，空格跳跃，追杀者鼠标左键肘击，Esc 菜单。详细规则见 [玩家指南](docs/PLAYER-GUIDE.md) 和 [联机指南](docs/MULTIPLAYER.md)。

## 文档

- [版本管理与分发 SOP](SOP.md)
- [1.0.0 更新说明](docs/releases/1.0.0.md)
- [文档索引与历史资料](docs/README.md)
- [第三方素材与许可](docs/THIRD-PARTY.md)

## 目录

| 路径 | 内容 |
| --- | --- |
| `launcher/` | 登录器、版本检查、签名校验、下载与版本切换 |
| `dist/` | 游戏逻辑、界面、Three.js 和运行时模型、图片、声音 |
| `resources/` | 应用图标与原始 Blender 模型 |
| `tools/` | 模型导出、游戏与联机验证、打包和维护脚本 |
| `main.cjs` / `preload.cjs` | Electron 主进程与通信桥 |
| `signaling.cjs` | 仅负责连接信息交换的房间号服务 |

仓库保留完整运行资源及原始模型。服务器地址、SSH 信息、私钥、本机运行配置及构建产物不得提交。`.local/`、`hefei-runtime.json` 和 `artifacts/` 已加入 Git 忽略规则；依赖由 `npm ci` 安装。

人物、照片、模型和音效包含用户提供或已有的素材；本仓库未授予第三方素材的再分发许可，也未自动附加开源许可证。

## Apple Vision Pro

当前分发仅面向 Windows。Apple Vision Pro 适配尚未完成，仓库不包含已经验证的 visionOS 安装包或头显版本。
