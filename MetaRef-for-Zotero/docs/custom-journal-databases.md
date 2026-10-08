# 自定义 ESI 与 Nature Index 期刊数据库

## 导入和更新

Zotero 设置 → MetaRef → 期刊索引与自定义数据库，分别为 ESI 和 Nature Index 选择 JSON 或 CSV 文件。选择成功后文件路径保存在本机设置中，名单替代对应内置名单，不自动合并；未列入自定义文件的期刊不会再从内置名单补入。两种数据库独立配置。

可以先导出内置 JSON，再修改或增删记录。编辑原文件后点击「重新读取」，无需重启 Zotero。清除路径恢复内置数据。路径不跨电脑同步，移动文件后需重新选择。

选择文件时逐条校验，错误提示包含记录序号（CSV 第一条数据为记录 1，不含表头）。失败或取消不会覆盖原路径。已配置文件被删除或损坏时，侧栏及批处理回退内置名单并提示，不把读取失败误报为未收录。

「校验数据库」检查当前文件并刷新显示；「导出内置 JSON」始终导出插件内置快照，不会覆盖自定义文件。导出的完整名单与示例模板位于 `dist/databases/`。模板仅用于格式示范，不是官方名单。

## ESI 格式

支持 JSON 数组，或 `{ "journals": [...] }`，不接收以刊名为键的旧式对象。每条记录必须有 `category` 和 `title`／有效格式的 ISSN，支持下列字段：

```json
[
  {
    "title": "Your Journal Title",
    "title20": "YOUR J",
    "title29": "YOUR J",
    "issn": "",
    "eissn": "",
    "category": "PHYSICS"
  }
]
```

CSV 表头：`title,title20,title29,issn,eissn,category`。多个学科可用分号分隔，例如 `PHYSICS;MATERIALS SCIENCE`。含逗号的学科必须加 CSV 引号，例如 `"SOCIAL SCIENCES, GENERAL"`。完整官方学科名称中的斜杠或逗号不会被错误拆分。用户可设置自己的分类，但自定义分类不代表 Clarivate 官方 ESI 分类。

## Nature Index 格式

推荐 JSON 数组，或与内置数据库一致的 `{ "venues": [...] }` 对象：

```json
[
  {
    "title": "Your Journal Title",
    "type": "journal",
    "aliases": ["Your J."],
    "issn": []
  }
]
```

`type` 省略时为 `journal`；也可记录 `conference`，但会议不会匹配期刊文章，名单须至少包含一条期刊。`aliases` 是完整别名／缩写数组，`issn` 是印刷或电子 ISSN 数组，也支持独立 `eissn`。

CSV 表头：`title,type,aliases,issn`。`aliases` 和 `issn` 单元格内多个值用分号或竖线分隔。标题不变的重复记录不会导致标题匹配失效；不同期刊共享的缩写不用于命中，避免误识别。

## 编码、校验与范围

- 使用 UTF-8，支持 BOM、JSON／CSV 大小写扩展名。CSV 保留表头，ISSN 作为文本处理，避免 Excel 删除前导零。
- 文件支持 1–100000 条记录。字段类型、必须字段、ISSN 格式及 Nature Index 类型均校验；部分错误不会静默丢弃，整份文件不启用。ISSN 校验检查格式，不校验其实际注册状态。
- 自定义列表按当前 ISSN、刊名、缩写匹配，不写入系统字段、Extra 或标签。自定义 Nature Index 结果不能被当作官方收录证明；期刊名单身份也不证明某篇文章计入自然指数。
- 提供的是当前插件快照：ESI 为 Clarivate 2026 年第 6 期，12245 条记录、22 学科；Nature Index 为 2026 年 6 月名单、2026-09-30 快照，177 期刊及 1 会议。没有宣称本次联网更新了名单。
- 数据来源与许可说明见 `data/esi/README.md` 和 `data/nature-index/README.md`。`dist/databases/manifest.json` 记录文件字节数与 SHA-256，用于检查交付完整性。
