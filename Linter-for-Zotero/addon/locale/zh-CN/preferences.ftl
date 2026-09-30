## 常规设置
section-general = 常规设置
lint-on-item-added =
    .label = 添加条目时自动执行 Lint
lint-on-groupItem-added =
    .label = 添加群组条目时自动执行 Lint
notify-on-lint =
    .label = Lint 时显示进度通知
lint-numConcurrent = 并行运行的数量：
lint-numConcurrent-description = 建议设为 1；修改从下一批整理任务开始生效。

enable-richtext-toolbar =
    .label = 启用富文本编辑工具条
enable-richtext-preview =
    .label = 启用富文本编辑预览框
enable-richtext-hotkey =
    .label = 启用富文本编辑快捷键
richtext-settings-description = 工具条和预览会在标题编辑器下次获得焦点时更新；快捷键开关立即生效。

shortcuts-header = 快捷键设置
shortcut-description = 点击录制或粘贴组合键，Esc 退出；修改立即生效。富文本用于标题选区，批量操作用于条目列表。
shortcut-subscript = 下标
shortcut-supscript = 上标
shortcut-bold = 粗体
shortcut-italic = 斜体
shortcut-nocase = 保持大小写
shortcut-lint = 执行 Lint

wip =
    .label = 开发中...


## 菜单设置
section-menu = 右键菜单设置
section-menu-description = 自定义右键菜单中显示的功能项。取消勾选只会隐藏相应菜单项，不会关闭自动规则或删除该功能。
section-menu-format = Linter 一级菜单：格式与规范
section-menu-publication = Linter 一级菜单：语言与出版物
section-menu-tools = Linter 一级菜单：其他功能
section-menu-field = 字段右键菜单
menu-standard =
    .label = Lint 并修复
menu-field-correct-title-punctuation =
    .label = 规范标题中的符号
menu-field-correct-extra-order =
    .label = 修正「额外」字段顺序


## 分组标题
section-item = 条目级规则
section-item-description = 点击分组标题可展开或收起；收起只影响显示，不会停用规则。
section-rich-text = 富文本编辑工具
section-title = 标题
section-creators = 作者与创作者
section-language = 语言
section-article = 期刊文章与出版物
section-article-abbreviation = 期刊名称与缩写
section-article-esi = ESI 学科识别
section-article-pagination = 卷期与页码
section-conference = 会议论文
section-thesis = 学位论文
section-book = 图书与章节
section-patent = 专利
section-identifier = 标识符
section-others = 其他字段
section-updateMetadata = 更新元数据
metadata-update-defaults = 默认更新选项
metadata-provider-options = 数据服务设置
section-about = 关于


## 关于
help-version = { $name }, Build { $version }, { $time }

shortcut-chemicalFormula = 批量化学式角标
shortcut-clear =
    .label = 禁用
    .tooltiptext = 禁用此快捷键
shortcut-reset =
    .label = 重置
    .tooltiptext = 恢复此项的默认快捷键
shortcut-input-hint =
    .title = 点击录制，或粘贴 accel,key 格式；accel 对应 Ctrl（macOS 为 Cmd）。Tab 切换、Esc 退出、Backspace/Delete 禁用。
    .placeholder = 点击录制
shortcut-conflict = 与「{ $action }」的快捷键重复，未保存。请使用不同组合。
shortcut-invalid = 无效快捷键，未保存。请使用 Ctrl、Cmd 或 Alt 组合键。
shortcut-saved = 快捷键已保存，立即生效。
shortcut-disabled = 此快捷键已禁用。
