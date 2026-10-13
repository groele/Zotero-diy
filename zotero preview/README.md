# ZoteroPreview 40.1.2

参考文献和正文引用预览，使用 Zotero 官方 `ItemPaneManager.registerSection` 接口。

## 使用

在 Zotero 的“工具 → 插件”中选择“从文件安装插件”，安装 `dist/ZoteroPreview-40.1.2.xpi`。
主库选择文献或进入主窗口的 PDF / EPUB / 网页阅读标签页后，点击右侧的预览眼睛图标即可打开栏目。
阅读页始终使用正在阅读的附件所对应的父文献，不使用主库的选中条目。
没有父文献的独立附件、独立笔记和已删除文献隐藏栏目。

栏目排序和固定使用 Zotero 原生侧栏操作：拖动导航图标排序，或通过原生菜单固定栏目。
旧的顶部 / 信息栏后 / 底部位置选项已移除，原有偏好值保留但不再生效。
样式、展示内容、字号、行距和条目上限继续保留。可选择“跟随 Zotero Quick Copy 设置”。
超出上限时显示省略数量，复制内容与实际预览的条目范围一致。

本机的 Zotero 10.0.6 独立阅读窗口没有原生条目信息侧栏，因此不能显示此栏目；请使用主窗口阅读标签页。
本插件不再向独立窗口正文或左侧目录强行插入自建面板。
多选预览逻辑保留，但显示范围受 Zotero 原生条目侧栏的可见性限制。

## 性能和架构

- 使用原生 `onInit`、`onItemChange`、`onAsyncRender`、`onDestroy` 生命周期。
- 每个栏目独立维护条目、复制内容和渲染状态，避免标签页交叉引用。
- 40 ms 合并快速条目切换；版本令牌取消过时结果。
- 跨栏目共享有界 LRU：最多 64 个结果，序列化内容估算不超过 2 MiB，缓存有效期 60 秒。
- 使用 QuickCopy 的 Zotero 内置 CSL 处理器缓存；点击复制直接复用 HTML / 纯文本。
- 仅使相关文献缓存失效；偏好变更通过官方偏好监听器传播。
- 释放延时任务、复制反馈、监听器、栏目和样式表。关闭窗口与禁用插件均有清理路径。
- 通过 HTML DOMParser 创建 XHTML 节点后导入 Zotero XUL 文档，避免丢失布局和按钮包装。
- 使用 ResizeObserver 随原生侧栏尺寸调整内容上限，防止 XUL 固有宽度把复制按钮推到侧栏外；无尺寸轮询。
- 移除主 / 阅读窗口 DOM 猜测、旧容器 ID 定位、挂载轮询、整文档 select 监听、window-mediator 和私有 File_Interface 调用。
- 富文本剪贴板保留当前 Gecko XPCOM 支持，使用 `setTransferData(flavor, value)`，不将仍被 Zotero 使用的接口错误标记为废弃。

## 兼容性和更新

声明 Zotero 8–10；已针对本机 10.0.6 及当前官方源码检查接口。8/9 和未发布的未来版本未实测。
不放宽最高版本到未知版本。未来可基于原生 API 层集中适配。
自动更新源使用 `groele/Zotero-diy/zotero preview` 下的更新清单，下载地址绑定同目录内的版本化 XPI。
此发布沿用维护仓库的更新通道，不使用原作者仓库的旧下载地址。

## 构建与验证

```powershell
pwsh -NoProfile -File ./test.ps1
node --check bootstrap.js
node --check zoteropreview.js
node --check zoteropreview_prefs.js
pwsh -NoProfile -File ./build.ps1
```

构建脚本只打包运行文件和本地化资源，排除测试、文档和生成目录。
桌面测试使用临时加载的源码；XPI 的安装、重启后加载需要另外验证。
详见 `VALIDATION.md`。

官方依据：
- https://www.zotero.org/support/dev/zotero_7_for_developers#custom_item_pane_sections
- https://www.zotero.org/support/dev/zotero_10_for_developers
- https://github.com/zotero/zotero/blob/main/chrome/content/zotero/xpcom/pluginAPI/itemPaneManager.js
- https://github.com/zotero/zotero/blob/main/chrome/content/zotero/xpcom/quickCopy.js

## 来源与许可证

本项目基于 [David Carter 的 ZoteroPreview](https://github.com/dcartertod/zotero-plugins) 维护。上游 Apache-2.0 许可证保留于 [LICENSE](LICENSE)，原有版权归相应作者所有。Zotero 及相关商标归其各自所有者所有。
