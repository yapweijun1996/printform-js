const MAIN_CONFIG_METADATA = [
  { key: "papersizeWidth", category: "纸张尺寸", description: "页面宽度(像素),打印目标应 <= 750px" },
  { key: "papersizeHeight", category: "纸张尺寸", description: "页面高度(像素)" },
  { key: "paperSize", category: "纸张尺寸", description: "预设纸张大小 (A4, A5, LETTER, LEGAL)", options: ["", "A4", "A5", "LETTER", "LEGAL"] },
  { key: "orientation", category: "纸张尺寸", description: "纸张方向", options: ["portrait", "landscape"] },
  { key: "dpi", category: "纸张尺寸", description: "DPI 设置,用于从预设纸张大小计算像素尺寸" },
  { key: "nUp", category: "N-Up 打印", description: "每个物理页面包含的逻辑页面数量" },
  { key: "showLogicalPageNumber", category: "N-Up 打印", description: "显示逻辑页码 (Page 1 of 3)" },
  { key: "showPhysicalPageNumber", category: "N-Up 打印", description: "显示物理页码 (Sheet 1 of 2)" },
  { key: "heightOfDummyRowItem", category: "虚拟行填充", description: "虚拟行项目的高度(像素)" },
  { key: "repeatHeader", category: "重复元素", description: "每页重复 .pheader 头部" },
  { key: "repeatDocinfo", category: "重复元素", description: "每页重复 .pdocinfo 文档信息" },
  { key: "repeatDocinfo002", category: "重复元素", description: "每页重复 .pdocinfo002 文档信息" },
  { key: "repeatDocinfo003", category: "重复元素", description: "每页重复 .pdocinfo003 文档信息" },
  { key: "repeatDocinfo004", category: "重复元素", description: "每页重复 .pdocinfo004 文档信息" },
  { key: "repeatDocinfo005", category: "重复元素", description: "每页重复 .pdocinfo005 文档信息" },
  { key: "repeatRowheader", category: "重复元素", description: "每页重复 .prowheader 表格行头" },
  { key: "repeatPtacRowheader", category: "重复元素", description: "PTAC 页面重复 .prowheader 表格行头" },
  { key: "repeatFooter", category: "重复元素", description: "每页重复 .pfooter 页脚" },
  { key: "repeatFooter002", category: "重复元素", description: "每页重复 .pfooter002 页脚" },
  { key: "repeatFooter003", category: "重复元素", description: "每页重复 .pfooter003 页脚" },
  { key: "repeatFooter004", category: "重复元素", description: "每页重复 .pfooter004 页脚" },
  { key: "repeatFooter005", category: "重复元素", description: "每页重复 .pfooter005 页脚" },
  { key: "repeatFooterLogo", category: "重复元素", description: "每页重复 .pfooter_logo 页脚 Logo" },
  { key: "repeatFooterPagenum", category: "重复元素", description: "每页重复 .pfooter_pagenum 页码区域" },
  { key: "fillPageHeightAfterFooter", category: "虚拟行填充", description: "页脚之后补齐页面高度" },
  { key: "insertDummyRowItemWhileFormatTable", category: "虚拟行填充", description: "插入虚拟行项目填充剩余空间" },
  { key: "insertPtacDummyRowItems", category: "虚拟行填充", description: "PTAC 页面允许虚拟行项目" },
  { key: "insertDummyRowWhileFormatTable", category: "虚拟行填充", description: "插入单个完整高度虚拟表格" },
  { key: "insertFooterSpacerWhileFormatTable", category: "虚拟行填充", description: "在页脚前插入间隔符" },
  { key: "insertFooterSpacerWithDummyRowItemWhileFormatTable", category: "虚拟行填充", description: "使用虚拟行项目填充页脚间隔" },
  { key: "customDummyRowItemContent", category: "虚拟行填充", description: "自定义虚拟行项目 HTML 内容" },
  { key: "debug", category: "调试", description: "启用详细控制台日志" }
];

const PADDT_CONFIG_METADATA = [
  { key: "repeatPaddt", category: "PADDT", description: "重复 PADDT (保留,暂未使用)" },
  { key: "insertPaddtDummyRowItems", category: "PADDT", description: "PADDT 页面允许虚拟行项目" },
  { key: "paddtMaxWordsPerSegment", category: "PADDT", description: "每个 PADDT 段落的最大单词数" },
  { key: "repeatPaddtRowheader", category: "PADDT", description: "PADDT 页面重复行头" },
  { key: "paddtDebug", category: "PADDT", description: "启用 PADDT 调试日志" },
  { key: "repeatPaddtDocinfo", category: "PADDT", description: "PADDT 页面重复 .pdocinfo 文档信息" },
  { key: "repeatPaddtDocinfo002", category: "PADDT", description: "PADDT 页面重复 .pdocinfo002 文档信息" },
  { key: "repeatPaddtDocinfo003", category: "PADDT", description: "PADDT 页面重复 .pdocinfo003 文档信息" },
  { key: "repeatPaddtDocinfo004", category: "PADDT", description: "PADDT 页面重复 .pdocinfo004 文档信息" },
  { key: "repeatPaddtDocinfo005", category: "PADDT", description: "PADDT 页面重复 .pdocinfo005 文档信息" }
];

module.exports = {
  MAIN_CONFIG_METADATA,
  PADDT_CONFIG_METADATA
};
