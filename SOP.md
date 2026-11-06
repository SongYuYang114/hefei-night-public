# 版本管理与分发 SOP

本文件是后续开发、构建与发布的统一指导。开发和发布源为 `galaxy-of-homos/hefei-night`。首次获取的 EXE 已包含完整游戏；登录器用于检查和安装后续版本，不要求账号登录。

## 版本规则

- 首个正式分发版本为 **1.0.0**，对应标签 `v1.0.0`。原 v1.34.1 是导入的玩法基线，不属于新分发序列。
- 使用 `MAJOR.MINOR.PATCH`：破坏性调整增加主版本，兼容新功能增加次版本，修复增加补丁版本。版本只前进，不复用。
- `package.json`、`package-lock.json`、Git 标签、Release、EXE 文件名及签名清单必须一致。使用 `npm version patch|minor|major --no-git-tag-version` 同步依赖清单，再提交和打标签。
- 当前联机协议为 36，与分发版本分开管理。协议变更时同步服务端兼容策略、清单生成脚本和客户端提示；混用版本不能绕过协议检查。
- 正式通道只接受无预发布后缀的版本，draft 和 prerelease 不进入自动更新。不得覆盖已经公开的同版本文件或清单。

## 更新来源与行为

1. 启动登录器及点击“检查更新”时，首先查询组织仓库的 GitHub 最新正式 Release。
2. GitHub 元数据和清单请求各有 8 秒总超时，最多跟随 5 次重定向。超时、连接错误、限流、非成功状态或无效清单时尝试配置的服务端备用源。
3. 下载优先使用检查成功的源。GitHub 文件下载失败时，读取备用源中**同一目标版本**的清单；版本、大小和 SHA-256 必须一致。下载有 12 秒空闲超时及 15 分钟总超时。
4. 备用源缺少目标版本或与主源不一致则终止更新；备用源较旧时不降级。两个源都失败时保留当前游戏，允许离线启动及稍后重试。
5. 下载使用用户数据目录 `updates/versions/版本号/` 内的 `.part` 临时文件。签名、大小和 SHA-256 全部通过后才保存为正式 EXE。失败或取消时清理临时文件。
6. 点击“重启并更新”后再次校验文件，启动新版本。新登录器加载成功后才保存本机已启用版本指针，并通知旧进程退出。启动失败则保留当前版本。以后双击旧入口会转到已验证的新版本。
7. 登录器和游戏整体更新，不在对局中替换文件。下载可取消，更新就绪后也可先启动当前版本。下载备用源与游戏 P2P 无关，不提供游戏中继。

## 产物与信任

每版至少包含同一构建输出的三份产物：

```text
HefeiNight-1.0.0-win-x64.exe
latest.json
SHA256SUMS
```

`latest.json` 包含 `payload` 和 Ed25519 `signature`。签名输入为递归按键名排序的规范 JSON。载荷包含 schema、版本、通道、平台、架构、协议、发布时间、说明和文件名、大小、SHA-256。客户端仅信任 `release.config.json` 内的公钥。SHA256SUMS 供人工复核，不能替代签名。

初始私钥由 `node tools/init-release-key.cjs` 生成到 `.local/update-private.pem`。当前仓库已初始化公钥，**不要再次生成或覆盖**。维护者须在仓库外备份私钥，CI 使用仓库 Secret `RELEASE_SIGNING_KEY`。私钥不提交 Git、不上传分发服务器，也不使用 SSH 登录密钥替代。轮换公钥前必须制定已安装客户端的迁移流程。

GitHub 和备用源必须镜像同一 EXE 和同一清单，不分别构建。当前未配置 Windows Authenticode 商业证书；更新清单签名不是系统代码签名。

## 运行配置隔离

服务器地址、SSH 账号、登录凭据、部署目录、运行配置和密钥禁止提交到仓库、PR、日志或公开 Release 附件。运行配置支持以下字段：

| 字段 | 含义 |
| --- | --- |
| `fallbackBaseUrl` | 管理员交付的 HTTPS 备用源根地址 |
| `fallbackCa` | 可选私有 CA 或自签公开证书 PEM；不得禁用 TLS 验证 |
| `signaling.host` / `signaling.port` | 房间号服务地址和端口 |
| `signaling.ca` | 可选房间号服务公开证书 PEM |

加载优先级：`HEFEI_RUNTIME_CONFIG` 指向的文件、便携 EXE 旁的 `hefei-runtime.json`、源码目录 `.local/runtime.json`、用户数据目录保存的配置。外部配置会保存到用户数据目录，更新 EXE 后继续生效。缺少配置时使用 GitHub 和手动 P2P，不猜测服务器地址。

公开 EXE **不内置部署地址**，打包审计验证配置隔离。管理员通过私有渠道交付配置，放到 EXE 同目录运行一次即可。可制作私有首发 ZIP（EXE + 配置），但不得上传公开 Release。没有事先获取配置的客户端不能自动发现私有备用源。

## 发布流程

1. 在组织仓库的功能分支开发并评审，更新版本和 `docs/releases/版本号.md`。发布说明不包含部署信息或本机路径。
2. 完成验证和构建：

   ```powershell
   npm ci
   npm test
   npm run test:game
   npm run test:launcher
   npm run build
   npm run release:audit
   npm run release:prepare
   ```

3. `release:prepare` 从 `HEFEI_SIGNING_KEY` 文件读取私钥，默认使用本机忽略目录的私钥，输出到 `artifacts/release/版本号/`。验证 EXE 启动、离线启动、下载进度及 GitHub 失败后的备用切换。
4. 对验证提交打 `v版本号` 标签并推送。`.github/workflows/release.yml` 会验证、构建、签名并生成 **draft Release**。CI 构建与本机构建只能选其中一套作为最终产物；镜像不得混用两套文件。
5. 将最终三份文件上传到备用源的新暂存目录，核对签名、大小和 SHA-256 后原子重命名为版本号目录。已有版本禁止覆盖。
6. 验证 HTTPS 读取 `/版本号/latest.json` 及 EXE。最后通过临时文件加原子重命名更新根目录 `/latest.json`，避免客户端看到尚未上传完成的文件。
7. 实际从备用源下载并核对哈希后，将 GitHub draft 发布为 latest。首发 1.0.0 同样执行本流程。源码 ZIP 不作为游戏更新包。
8. 复查 GitHub、备用根清单和文件一致性。仓库只记录版本、提交、摘要与验证结果，不记录部署细节。

## 服务端要求

`tools/distribution-server.py` 提供 Python 3.9+ 只读 HTTPS 文件分发，不依赖 Node.js：

```sh
python3 tools/distribution-server.py --root "$RELEASE_ROOT" --cert "$TLS_CERT" --key "$TLS_KEY" --host "$BIND_HOST" --port "$DISTRIBUTION_PORT"
```

路径、证书和监听参数全部由服务器外部配置提供。服务不列目录、不提供写入 API，只允许读取根清单和版本目录中的规定产物。证书私钥和运行配置不放入静态目录。独立服务管理和重启策略由管理员配置，不替换已有游戏服务。

## 异常处理

- 签名或哈希错误：停止安装，保留当前游戏，检查两源是否同步同一构建。
- 新版无法启动：成功标记超时后允许继续旧版。旧 EXE 和版本目录不会自动删除，维护者可在关闭游戏后人工恢复或清理。
- 错误版本已发布：发更高补丁版本，不覆盖已发布文件，不自动降级。
- 两源均不可用：使用当前版，联网恢复后重试。下载备用源不能改善 P2P 穿透。
