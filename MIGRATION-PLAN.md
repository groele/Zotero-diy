# Zotero-diy 四插件独立仓库迁移计划

状态：**准备中**。此文件是执行清单；并不表示目标仓库已创建或迁移完成。

## 目标

- `groele/MetaRef-for-Zotero`
- `groele/RefNexus-Zotero10`
- `groele/Zotero-Citation`
- `groele/Zotero-Preview`
- 保留 `groele/Zotero-diy` 用作统一展示与入口。

如目标名称已被占用，先确认目标的身份和已有内容；**不得覆盖现有仓库**。

## 迁移顺序

1. 在 GitHub 创建四个**空**仓库（不要自动初始化 README、LICENSE 或 .gitignore）。确认创建者有推送权限。
2. 对源仓库做完整镜像备份（分支、标签、release 资产与更新清单另行备份）。将四个项目的当前插件 ID、版本、更新地址及 XPI SHA-256 记录为迁移基线。
3. 分别从完整克隆中提取子目录历史，不改变源仓库。一个项目一个临时克隆：
   ```bash
   git clone https://github.com/groele/Zotero-diy.git MetaRef-extract
   cd MetaRef-extract
   git filter-repo --subdirectory-filter MetaRef-for-Zotero --force
   git remote add destination https://github.com/groele/MetaRef-for-Zotero.git
   git push destination HEAD:main
   ```
   对 `RefNexus-Zotero10`、`zotero citation`、`zotero preview` 分别重复，并替换目录及目标仓库。针对带空格目录的参数加引号。**不要在唯一原始克隆或源仓库运行 `git filter-repo`。**
4. 检查子目录变为仓库根目录后，构建脚本、工作目录、工作流、`package.json`、文档和 `.gitmodules` 的所有路径。MetaRef 的 JabRef 子模块特别核对：相对路径必须有效，并执行 `git submodule sync --recursive` 和 `git submodule update --init --recursive`。
5. 在各仓库配置独立 CI、发行与 Issues；复核各项目 LICENSE、版权声明、上游来源、插件 ID、签名和兼容性范围。
6. 逐个更新项目内部 `repository`、`homepage`、`bugs`、XPI 下载地址、`updateURL`、文档、release notes、打包模板及源码常量。搜索全部 `Zotero-diy`、`raw.githubusercontent.com`、`github.com/groele` 引用。
7. **先发布新仓库 XPI，再迁移更新源**。保留旧仓库路径下的 `update.json` 和既有 Release；原更新源中的新版本应指向新仓库可访问的安装包（如清单格式允许），以支持已安装插件平滑升级。核对 Zotero 实际使用的更新清单路径来自 XPI/manifest、而不只来自 package.json。
8. 在隔离 Zotero 配置下分别测试：全新安装、旧版升级、重启后加载、禁用/卸载、数据与偏好保留、更新检查；Citation 还需真实 Word 集成回归。
9. 四个插件均通过发布和自动更新验证后，再单独提交删除源仓库重复源码的 PR。统一仓库保留项目介绍、安装链接和旧路径迁移说明；如不能保证旧更新 URL 可用，就不得删除相关清单。

## 重要约束

- 不因仓库分拆而改变 Zotero 的 addon ID、首选项前缀或数据命名空间。
- 历史提取需另行处理 tags：原仓库标签可能跨插件，**不要直接推送全部旧标签**，应按插件筛选后使用新的发布标签。
- Git 历史提取只保留触及对应子目录的提交，不保证完整保留根目录级更改的上下文。必要时补充迁移来源说明。
- Citation README 说明尚缺少完整原始 TypeScript 工程，此问题独立跟踪，不以仓库迁移表示已解决。
- 对 MetaRef、RefNexus 的大数据、子模块、构建产物及潜在 LFS 使用做单独核查。
- 拆分完成前保留源仓库 `main` 与所有现有下载链接原样。

## 验收条件

- 四个新仓库存在且完整包含各自源码、许可证、文档、可复现的构建与测试。
- 四个插件可通过各自独立 Release/XPI 安装。
- 各插件 addon ID 不变，旧安装在隔离环境能够通过原更新源升级到新发布包。
- Zotero-diy 导航页全部链接可用，且发布历史可被追溯。
