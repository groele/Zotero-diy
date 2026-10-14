# Zotero DIY

这是一个个人维护的 Zotero 插件及其衍生项目集合，当前包含四个相互独立的项目：**Zotero Citation**、**ZoteroPreview**、**MetaRef for Zotero** 和 **RefNexus for Zotero 10**。每个子目录分别维护自己的源码/运行文件、安装包、版本说明、测试方式和许可证信息。

本仓库不是单一插件发行包。请根据需要进入对应项目目录，阅读该项目的 README 后再安装或构建。

## 项目一览

| 项目 | 说明 | 当前版本 | 独立仓库 | 旧版更新兼容 |
|---|---|---:|---|---|
| Zotero Citation | 协助维护 Zotero 与 Word 集成引用信息，并在条目列表中显示引用状态。 | 40.0.4 | [groele/Zotero-Citation](https://github.com/groele/Zotero-Citation) | [update.json](./zotero%20citation/update.json) |
| RefNexus for Zotero 10 | 获取参考文献、施引文献与相关文献，浏览文献卡片及引用关系。 | 11.0.2 | [groele/RefNexus-Zotero10](https://github.com/groele/RefNexus-Zotero10) | [update.json](./RefNexus-Zotero10/update.json) |
| ZoteroPreview | 在主库及阅读标签页的原生侧栏预览参考文献和正文引用。 | 40.1.7 | [groele/Zotero-Preview](https://github.com/groele/Zotero-Preview) | [zoteropreview7-updates.json](./zotero%20preview/zoteropreview7-updates.json) |
| MetaRef for Zotero | 校验、整理和补全文献元数据，支持化学式上下标、缩写、ESI 与 Nature Index。 | 12.2.0 | [groele/MetaRef-for-Zotero](https://github.com/groele/MetaRef-for-Zotero) | [update.json](./MetaRef-for-Zotero/update.json) |

**四个插件已成功拆分为独立仓库维护。** 为了保障已安装用户的无缝平滑升级，本仓库继续保留各插件历史版本的更新清单与下载路径；各插件新版本的开发、发布与问题反馈请移步上述独立仓库。详情参见 [迁移计划与执行记录](./MIGRATION-PLAN.md)。

## 快速开始

### 安装 ZoteroPreview

1. 从 [ZoteroPreview 40.1.4 XPI](./zotero%20preview/dist/ZoteroPreview-40.1.4.xpi) 下载安装包。
2. 在 Zotero 的插件管理器中选择“从文件安装插件/附加组件”，然后选择下载的 `.xpi` 文件。
3. 根据 Zotero 提示重启，再按 [项目 README](./zotero%20preview/README.md) 检查设置与功能。

### 安装 Zotero Citation

Zotero Citation 依赖 Zotero 与 Word 的集成环境。新安装请从 [40.0.4 发布页](https://github.com/groele/Zotero-diy/releases/tag/v40.0.4)下载 XPI 并通过 Zotero 插件管理器安装；配置了 40.x 更新清单的旧安装会收到自动更新。请先阅读[安装说明、兼容声明和验收边界](./zotero%20citation/README.md)。兼容范围仍限于 Zotero 10。

### 安装 MetaRef for Zotero

下载 [MetaRef 11.0.7 XPI](./MetaRef-for-Zotero/dist/metaref-for-zotero.xpi)，在 Zotero 插件管理器中从文件安装。操作与验证范围见 [项目说明](./MetaRef-for-Zotero/README.md)。

### 安装 RefNexus for Zotero 10\n\n见 [RefNexus 项目 README](./RefNexus-Zotero10/README.md)，从现有目录下载安装包，按其说明安装。\n\n## 构建与测试

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

**RefNexus for Zotero 10**（Node.js）：\n\n```powershell\nPush-Location RefNexus-Zotero10\nnpm install\nnpm test\nnpm run build\nPop-Location\n```\n\n**MetaRef for Zotero**（Node.js 22+、pnpm 12.3.4）：

```powershell
Push-Location MetaRef-for-Zotero
pnpm install --frozen-lockfile
pnpm test:unit
pnpm build
Pop-Location
```

MetaRef 另有真实 Zotero E2E，包含数据库、菜单、PDF 索引和生产 XPI 安装；命令见项目 README。其他项目的静态检查和模拟接口回归不能替代真实 Zotero、Reader 或 Word 验收。各项目的测试覆盖与限制分别记录，不互相替代。

## 来源、版权与许可证

各子项目来自不同上游，许可证和版权声明分别管理；**本仓库根目录不为所有子项目声明一个统一许可证**。再分发或修改前，请阅读对应子项目的版权与许可证说明，并保留其上游要求的声明。

- **Zotero Citation** 基于 [MuiseDestiny/zotero-citation](https://github.com/MuiseDestiny/zotero-citation) 二次开发。该子项目 README 说明了上游 AGPL-3.0 许可及当前许可证文件状态。
- **ZoteroPreview** 基于 [dcartertod/zotero-plugins](https://github.com/dcartertod/zotero-plugins) 中的 ZoteroPreview 开发；上游采用 Apache-2.0，子项目目录保留了对应许可证文本。
- **RefNexus for Zotero 10** 基于 [MuiseDestiny/zotero-reference](https://github.com/MuiseDestiny/zotero-reference) 二次开发，保留上游 AGPL-3.0-or-later 许可与版权声明。\n- **MetaRef for Zotero** 基于 [northword/zotero-format-metadata](https://github.com/northword/zotero-format-metadata) 维护，保留上游 AGPL-3.0 许可证与版权声明。

Zotero 及相关产品名称和商标归其各自所有者所有。本仓库为社区维护项目，与 Zotero 官方及各上游作者没有隶属或背书关系。

## 目录结构

```text
zotero citation/   Zotero Citation 插件、构建脚本、测试和审查文档
zotero preview/    ZoteroPreview 插件、安装包、构建脚本、测试和审查文档
MetaRef-for-Zotero/  元数据整理插件源码、参考数据、安装包、真实运行测试和审查文档\nRefNexus-Zotero10/  参考文献获取与引用关系浏览插件、测试及发布文件
```

## 维护与问题反馈

提交问题时请注明插件名称和版本、Zotero 与 Word 版本（如适用）、操作步骤及相关日志。请勿在公开问题中附上包含个人信息或未公开文献内容的 Zotero 数据库、Word 文档或日志。
