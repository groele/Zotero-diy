# Zotero DIY

这是一个个人维护的 Zotero 插件及其衍生项目集合，当前包含两个相互独立的项目：**Zotero Citation** 和 **ZoteroPreview**。每个子目录分别维护自己的源码/运行文件、安装包、版本说明、测试方式和许可证信息。

本仓库不是单一插件发行包。请根据需要进入对应项目目录，阅读该项目的 README 后再安装或构建。

## 项目一览

| 项目 | 说明 | 当前版本 | Zotero 兼容声明 | 入口 |
|---|---|---:|---|---|
| Zotero Citation | 协助维护 Zotero 与 Word 集成引用信息，并在 Zotero 条目列表中显示引用状态。 | 40.0.3（候选维护版） | `6.999`–`10.0.*`，以子项目 `manifest.json` 为准 | [项目说明](./zotero%20citation/README.md) · [审查记录](./zotero%20citation/PROJECT_AUDIT.md) |
| ZoteroPreview | 在 Zotero 条目侧栏和 Reader 侧栏预览参考文献及正文引用样式，并提供复制操作。 | 40.0.1 | `8.0`–`10.0.*`，以子项目 `manifest.json` 为准 | [项目说明](./zotero%20preview/README.md) · [审查记录](./zotero%20preview/AUDIT.md) · [XPI 安装包](./zotero%20preview/dist/ZoteroPreview-40.0.1.xpi) |

兼容范围是各插件清单中声明的范围，不代表已在该范围内所有 Zotero 构建上完成实机验收。尤其是 Zotero 主版本升级后，请先阅读子项目的兼容说明和已知限制。

## 快速开始

### 安装 ZoteroPreview

1. 从 [ZoteroPreview 40.0.1 XPI](./zotero%20preview/dist/ZoteroPreview-40.0.1.xpi) 下载安装包。
2. 在 Zotero 的插件管理器中选择“从文件安装插件/附加组件”，然后选择下载的 `.xpi` 文件。
3. 根据 Zotero 提示重启，再按 [项目 README](./zotero%20preview/README.md) 检查设置与功能。

### 安装 Zotero Citation

Zotero Citation 依赖 Zotero 与 Word 的集成环境，当前子项目标记为候选维护版。请先阅读其[安装说明、兼容声明和验收边界](./zotero%20citation/README.md)，再按其中的脚本构建 XPI；安装或升级前建议使用隔离的 Zotero 配置进行测试。

## 构建与测试

各子项目有独立的构建和测试流程，以下命令从仓库根目录运行。

**Zotero Citation**（PowerShell 7、Node.js）：

```powershell
Push-Location 'zotero citation'
node --test tests/*.test.*
./scripts/build.ps1 -OutputDirectory dist/my-build
Pop-Location
```

**ZoteroPreview**（PowerShell 7、Node.js）：

```powershell
pwsh -NoProfile -File './zotero preview/test.ps1'
```

测试以自动化静态检查和模拟接口回归为主，不能替代真实 Zotero 桌面端、Reader、Word、剪贴板和数据库场景的端到端验收。测试覆盖范围与限制请查看各自的 README 和审查记录。

## 来源、版权与许可证

两个子项目来自不同上游，许可证和版权声明分别管理；**本仓库根目录不为所有子项目声明一个统一许可证**。再分发或修改前，请阅读对应子项目的版权与许可证说明，并保留其上游要求的声明。

- **Zotero Citation** 基于 [MuiseDestiny/zotero-citation](https://github.com/MuiseDestiny/zotero-citation) 二次开发。该子项目 README 说明了上游 AGPL-3.0 许可及当前许可证文件状态。
- **ZoteroPreview** 基于 [dcartertod/zotero-plugins](https://github.com/dcartertod/zotero-plugins) 中的 ZoteroPreview 开发；上游采用 Apache-2.0，子项目目录保留了对应许可证文本。

Zotero 及相关产品名称和商标归其各自所有者所有。本仓库为社区维护项目，与 Zotero 官方及各上游作者没有隶属或背书关系。

## 目录结构

```text
zotero citation/   Zotero Citation 插件、构建脚本、测试和审查文档
zotero preview/    ZoteroPreview 插件、安装包、构建脚本、测试和审查文档
```

## 维护与问题反馈

提交问题时请注明插件名称和版本、Zotero 与 Word 版本（如适用）、操作步骤及相关日志。请勿在公开问题中附上包含个人信息或未公开文献内容的 Zotero 数据库、Word 文档或日志。
