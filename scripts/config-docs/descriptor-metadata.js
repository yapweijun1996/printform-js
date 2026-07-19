const MAIN_CONFIG_METADATA = [
  { key: "papersizeWidth", category: "纸张尺寸", categoryEn: "Paper Size", description: "页面宽度(像素),打印目标应 <= 750px", descriptionEn: "Page width in pixels; print target should be <= 750px" },
  { key: "papersizeHeight", category: "纸张尺寸", categoryEn: "Paper Size", description: "页面高度(像素)", descriptionEn: "Page height in pixels" },
  { key: "paperSize", category: "纸张尺寸", categoryEn: "Paper Size", description: "预设纸张大小 (A4, A5, LETTER, LEGAL)", descriptionEn: "Preset paper size (A4, A5, LETTER, LEGAL)", options: ["", "A4", "A5", "LETTER", "LEGAL"] },
  { key: "orientation", category: "纸张尺寸", categoryEn: "Paper Size", description: "纸张方向", descriptionEn: "Paper orientation", options: ["portrait", "landscape"] },
  { key: "dpi", category: "纸张尺寸", categoryEn: "Paper Size", description: "DPI 设置,用于从预设纸张大小计算像素尺寸", descriptionEn: "DPI used to derive pixel dimensions from the preset paper size" },
  { key: "nUp", category: "N-Up 打印", categoryEn: "N-Up Printing", description: "每个物理页面包含的逻辑页面数量", descriptionEn: "Number of logical pages packed into one physical sheet" },
  { key: "showLogicalPageNumber", category: "N-Up 打印", categoryEn: "N-Up Printing", description: "显示逻辑页码 (Page 1 of 3)", descriptionEn: "Show logical page numbers (Page 1 of 3)" },
  { key: "showPhysicalPageNumber", category: "N-Up 打印", categoryEn: "N-Up Printing", description: "显示物理页码 (Sheet 1 of 2)", descriptionEn: "Show physical page numbers (Sheet 1 of 2)" },
  { key: "heightOfDummyRowItem", category: "虚拟行填充", categoryEn: "Dummy Row Filling", description: "虚拟行项目的高度(像素)", descriptionEn: "Height of each dummy row item in pixels" },
  { key: "repeatHeader", category: "重复元素", categoryEn: "Repeating Elements", description: "每页重复 .pheader 头部", descriptionEn: "Repeat .pheader on every page" },
  { key: "repeatDocinfo", category: "重复元素", categoryEn: "Repeating Elements", description: "每页重复 .pdocinfo 文档信息", descriptionEn: "Repeat .pdocinfo on every page" },
  { key: "repeatDocinfo002", category: "重复元素", categoryEn: "Repeating Elements", description: "每页重复 .pdocinfo002 文档信息", descriptionEn: "Repeat .pdocinfo002 on every page" },
  { key: "repeatDocinfo003", category: "重复元素", categoryEn: "Repeating Elements", description: "每页重复 .pdocinfo003 文档信息", descriptionEn: "Repeat .pdocinfo003 on every page" },
  { key: "repeatDocinfo004", category: "重复元素", categoryEn: "Repeating Elements", description: "每页重复 .pdocinfo004 文档信息", descriptionEn: "Repeat .pdocinfo004 on every page" },
  { key: "repeatDocinfo005", category: "重复元素", categoryEn: "Repeating Elements", description: "每页重复 .pdocinfo005 文档信息", descriptionEn: "Repeat .pdocinfo005 on every page" },
  { key: "repeatRowheader", category: "重复元素", categoryEn: "Repeating Elements", description: "每页重复 .prowheader 表格行头", descriptionEn: "Repeat .prowheader table header on every page" },
  { key: "repeatPtacRowheader", category: "重复元素", categoryEn: "Repeating Elements", description: "PTAC 页面重复 .prowheader 表格行头", descriptionEn: "Repeat .prowheader on PTAC pages" },
  { key: "repeatFooter", category: "重复元素", categoryEn: "Repeating Elements", description: "每页重复 .pfooter 页脚", descriptionEn: "Repeat .pfooter on every page" },
  { key: "repeatFooter002", category: "重复元素", categoryEn: "Repeating Elements", description: "每页重复 .pfooter002 页脚", descriptionEn: "Repeat .pfooter002 on every page" },
  { key: "repeatFooter003", category: "重复元素", categoryEn: "Repeating Elements", description: "每页重复 .pfooter003 页脚", descriptionEn: "Repeat .pfooter003 on every page" },
  { key: "repeatFooter004", category: "重复元素", categoryEn: "Repeating Elements", description: "每页重复 .pfooter004 页脚", descriptionEn: "Repeat .pfooter004 on every page" },
  { key: "repeatFooter005", category: "重复元素", categoryEn: "Repeating Elements", description: "每页重复 .pfooter005 页脚", descriptionEn: "Repeat .pfooter005 on every page" },
  { key: "repeatFooterLogo", category: "重复元素", categoryEn: "Repeating Elements", description: "每页重复 .pfooter_logo 页脚 Logo", descriptionEn: "Repeat .pfooter_logo on every page" },
  { key: "repeatFooterPagenum", category: "重复元素", categoryEn: "Repeating Elements", description: "每页重复 .pfooter_pagenum 页码区域", descriptionEn: "Repeat .pfooter_pagenum page-number area on every page" },
  { key: "fillPageHeightAfterFooter", category: "虚拟行填充", categoryEn: "Dummy Row Filling", description: "页脚之后补齐页面高度", descriptionEn: "Fill remaining page height after the footer" },
  { key: "insertDummyRowItemWhileFormatTable", category: "虚拟行填充", categoryEn: "Dummy Row Filling", description: "插入虚拟行项目填充剩余空间", descriptionEn: "Insert dummy row items to fill leftover space" },
  { key: "insertPtacDummyRowItems", category: "虚拟行填充", categoryEn: "Dummy Row Filling", description: "PTAC 页面允许虚拟行项目", descriptionEn: "Allow dummy row items on PTAC pages" },
  { key: "insertDummyRowWhileFormatTable", category: "虚拟行填充", categoryEn: "Dummy Row Filling", description: "插入单个完整高度虚拟表格", descriptionEn: "Insert a single full-height dummy table" },
  { key: "insertFooterSpacerWhileFormatTable", category: "虚拟行填充", categoryEn: "Dummy Row Filling", description: "在页脚前插入间隔符", descriptionEn: "Insert a spacer before the footer" },
  { key: "insertFooterSpacerWithDummyRowItemWhileFormatTable", category: "虚拟行填充", categoryEn: "Dummy Row Filling", description: "使用虚拟行项目填充页脚间隔", descriptionEn: "Fill the footer spacer using dummy row items" },
  { key: "customDummyRowItemContent", category: "虚拟行填充", categoryEn: "Dummy Row Filling", description: "自定义虚拟行项目 HTML 内容", descriptionEn: "Custom HTML content for dummy row items" },
  { key: "customDummySpacerContent", category: "虚拟行填充", categoryEn: "Dummy Row Filling", description: "自定义页面高度间隔符内容(单根元素,高度自动填充);也可用 <template class=\"custom-dummy-spacer-content\">", descriptionEn: "Custom page-height spacer content (single root element; height auto-filled); can also use <template class=\"custom-dummy-spacer-content\">" },
  { key: "debug", category: "调试", categoryEn: "Debug", description: "启用详细控制台日志", descriptionEn: "Enable verbose console logging" }
];

const PADDT_CONFIG_METADATA = [
  { key: "repeatPaddt", category: "PADDT", categoryEn: "PADDT", description: "重复 PADDT (保留,暂未使用)", descriptionEn: "Repeat PADDT (reserved, not consumed yet)" },
  { key: "insertPaddtDummyRowItems", category: "PADDT", categoryEn: "PADDT", description: "PADDT 页面允许虚拟行项目", descriptionEn: "Allow dummy row items on PADDT pages" },
  { key: "paddtMaxWordsPerSegment", category: "PADDT", categoryEn: "PADDT", description: "每个 PADDT 段落的最大单词数", descriptionEn: "Maximum words per PADDT segment" },
  { key: "repeatPaddtRowheader", category: "PADDT", categoryEn: "PADDT", description: "PADDT 页面重复行头", descriptionEn: "Repeat row header on PADDT pages" },
  { key: "paddtDebug", category: "PADDT", categoryEn: "PADDT", description: "启用 PADDT 调试日志", descriptionEn: "Enable PADDT debug logging" },
  { key: "repeatPaddtDocinfo", category: "PADDT", categoryEn: "PADDT", description: "PADDT 页面重复 .pdocinfo 文档信息", descriptionEn: "Repeat .pdocinfo on PADDT pages" },
  { key: "repeatPaddtDocinfo002", category: "PADDT", categoryEn: "PADDT", description: "PADDT 页面重复 .pdocinfo002 文档信息", descriptionEn: "Repeat .pdocinfo002 on PADDT pages" },
  { key: "repeatPaddtDocinfo003", category: "PADDT", categoryEn: "PADDT", description: "PADDT 页面重复 .pdocinfo003 文档信息", descriptionEn: "Repeat .pdocinfo003 on PADDT pages" },
  { key: "repeatPaddtDocinfo004", category: "PADDT", categoryEn: "PADDT", description: "PADDT 页面重复 .pdocinfo004 文档信息", descriptionEn: "Repeat .pdocinfo004 on PADDT pages" },
  { key: "repeatPaddtDocinfo005", category: "PADDT", categoryEn: "PADDT", description: "PADDT 页面重复 .pdocinfo005 文档信息", descriptionEn: "Repeat .pdocinfo005 on PADDT pages" }
];

module.exports = {
  MAIN_CONFIG_METADATA,
  PADDT_CONFIG_METADATA
};
