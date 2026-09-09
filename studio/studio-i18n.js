const I18N = {
  zh: {
    compare: "对比模式", panelConfig: "配置", panelInspector: "检查器", printPreview: "打印预览",
    export: "导出 HTML", search: "搜索配置项…", inspector: "检查器", logicalPages: "逻辑页",
    physicalPages: "物理页", copyConfig: "复制配置 JSON", resetAll: "全部重置", resetCurrentSide: "重置当前侧",
    logs: "分页日志", printHint: "Studio 预览用于快速迭代;最终效果请以浏览器打印预览为准。", copyAB: "复制 A→B",
    loading: "加载中…", pages: "页", blocks: "个区块", copied: "已复制", resetConfirm: "重置当前侧所有配置修改?",
    import: "导入 HTML", modeStructure: "结构编辑", modePreview: "返回预览", rowCount: "行数", apply: "应用",
    duplicate: "复制", delete: "删除", clickBlockHint: "点击预览中的任一区块进行编辑;仅 .prowitem 支持复制/删除。",
    dataBinding: "数据绑定", dataEmptyHint: "此模板不含 {{占位符}},无需绑定数据。可在结构编辑模式下手动添加 {{field}} 或 {{#items}}...{{/items}}。",
    regenerateData: "重新生成示例数据", exportPackage: "导出数据绑定包", regenerateConfirm: "用新的示例数据骨架覆盖当前 JSON?",
    moreMenu: "更多选项", printformNotInlined: "printform.js 尚未内联 —— 此导出文件只有留在本仓库目录内打开才能正常运行,移到别处会报脚本 404。请稍候几秒后重新导出。",
    restoredNotice: "已恢复上次会话的配置修改(A 侧 {a} 项、B 侧 {b} 项),下方面板可能不是模板默认值。", cancel: "取消", ok: "确定",
    popupBlocked: "打印预览被浏览器拦截了 —— 请在地址栏允许本站弹出窗口,然后重试。"
  },
  en: {
    compare: "Compare", panelConfig: "Config", panelInspector: "Inspector", printPreview: "Print Preview",
    export: "Export HTML", search: "Search config…", inspector: "Inspector", logicalPages: "Logical pages",
    physicalPages: "Physical pages", copyConfig: "Copy config JSON", resetAll: "Reset all", resetCurrentSide: "Reset current side",
    logs: "Pagination log", printHint: "Studio preview is for fast iteration; verify final output with the browser's print preview.", copyAB: "Copy A→B",
    loading: "Loading…", pages: "pages", blocks: "blocks", copied: "Copied", resetConfirm: "Reset all config changes on the current side?",
    import: "Import HTML", modeStructure: "Edit Blocks", modePreview: "Back to Preview", rowCount: "Rows", apply: "Apply",
    duplicate: "Duplicate", delete: "Delete", clickBlockHint: "Click any block in the preview to edit it; only .prowitem supports duplicate/delete.",
    dataBinding: "Data Binding", dataEmptyHint: "This template has no {{placeholders}}. Add {{field}} or {{#items}}...{{/items}} via Structure mode to enable data binding.",
    regenerateData: "Regenerate sample data", exportPackage: "Export data-bound package", regenerateConfirm: "Overwrite the current JSON with a fresh sample skeleton?",
    moreMenu: "More options", printformNotInlined: "printform.js isn't inlined yet — this export will only run while it stays inside this repo folder; moving it elsewhere will 404. Wait a few seconds and export again.",
    restoredNotice: "Restored config changes from your last session (side A: {a}, side B: {b}) — the panel below may not match the template's defaults.", cancel: "Cancel", ok: "OK",
    popupBlocked: "The browser blocked the print preview popup — allow popups for this site in the address bar, then try again."
  }
};

export function createStudioI18n(state, query) {
  function t(key) {
    return (I18N[state.lang] && I18N[state.lang][key]) || key;
  }

  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.placeholder = t(element.getAttribute("data-i18n-placeholder"));
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", t(element.getAttribute("data-i18n-aria-label")));
    });
    query("#lang-toggle").textContent = state.lang === "zh" ? "EN" : "中文";
    document.documentElement.lang = state.lang;
  }

  return { t, applyI18n };
}
