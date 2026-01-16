#!/usr/bin/env node

/**
 * 自动化文档生成脚本
 * 
 * 功能:从 config.js 源代码自动生成配置文档
 * 
 * 用途:
 * 1. 保持文档与代码同步
 * 2. 避免手动维护多个文档副本
 * 3. 自动生成 Markdown 和 HTML 格式的配置参考
 * 
 * 使用方法:
 *   node scripts/generate-config-docs.js
 * 
 * 输出:
 *   - docs/CONFIGURATION.md (Markdown 格式)
 *   - docs/configuration.html (HTML 格式)
 *   - docs/config-reference.json (JSON 格式,供其他工具使用)
 */

const fs = require('fs');
const path = require('path');

// ============================================
// 1. 配置定义 (从 config.js 提取)
// ============================================

/**
 * 这里我们直接定义配置描述符
 * 在实际使用中,可以通过 import 从 config.js 读取
 * 或者解析 config.js 文件内容
 */
const CONFIG_DESCRIPTORS = [
    {
        key: "papersizeWidth",
        datasetKey: "papersizeWidth",
        htmlAttr: "data-papersize-width",
        type: "Number",
        defaultValue: 750,
        category: "纸张尺寸",
        description: "页面宽度(像素),打印目标应 <= 750px"
    },
    {
        key: "papersizeHeight",
        datasetKey: "papersizeHeight",
        htmlAttr: "data-papersize-height",
        type: "Number",
        defaultValue: 1050,
        category: "纸张尺寸",
        description: "页面高度(像素)"
    },
    {
        key: "paperSize",
        datasetKey: "paperSize",
        htmlAttr: "data-paper-size",
        type: "String",
        defaultValue: "",
        category: "纸张尺寸",
        description: "预设纸张大小 (A4, A5, LETTER, LEGAL)",
        options: ["", "A4", "A5", "LETTER", "LEGAL"]
    },
    {
        key: "orientation",
        datasetKey: "orientation",
        htmlAttr: "data-orientation",
        type: "String",
        defaultValue: "portrait",
        category: "纸张尺寸",
        description: "纸张方向",
        options: ["portrait", "landscape"]
    },
    {
        key: "dpi",
        datasetKey: "dpi",
        htmlAttr: "data-dpi",
        type: "Number",
        defaultValue: 96,
        category: "纸张尺寸",
        description: "DPI 设置,用于从预设纸张大小计算像素尺寸"
    },
    {
        key: "nUp",
        datasetKey: "nUp",
        htmlAttr: "data-n-up",
        type: "Number",
        defaultValue: 1,
        category: "N-Up 打印",
        description: "每个物理页面包含的逻辑页面数量"
    },
    {
        key: "showLogicalPageNumber",
        datasetKey: "showLogicalPageNumber",
        htmlAttr: "data-show-logical-page-number",
        type: "Boolean",
        defaultValue: true,
        category: "N-Up 打印",
        description: "显示逻辑页码 (Page 1 of 3)"
    },
    {
        key: "showPhysicalPageNumber",
        datasetKey: "showPhysicalPageNumber",
        htmlAttr: "data-show-physical-page-number",
        type: "Boolean",
        defaultValue: false,
        category: "N-Up 打印",
        description: "显示物理页码 (Sheet 1 of 2)"
    },
    {
        key: "heightOfDummyRowItem",
        datasetKey: "heightOfDummyRowItem",
        htmlAttr: "data-height-of-dummy-row-item",
        type: "Number",
        defaultValue: 18,
        category: "虚拟行填充",
        description: "虚拟行项目的高度(像素)"
    },
    {
        key: "repeatHeader",
        datasetKey: "repeatHeader",
        htmlAttr: "data-repeat-header",
        type: "Boolean",
        defaultValue: true,
        category: "重复元素",
        description: "每页重复 .pheader 头部"
    },
    {
        key: "repeatDocinfo",
        datasetKey: "repeatDocinfo",
        htmlAttr: "data-repeat-docinfo",
        type: "Boolean",
        defaultValue: true,
        category: "重复元素",
        description: "每页重复 .pdocinfo 文档信息"
    },
    {
        key: "repeatRowheader",
        datasetKey: "repeatRowheader",
        htmlAttr: "data-repeat-rowheader",
        type: "Boolean",
        defaultValue: true,
        category: "重复元素",
        description: "每页重复 .prowheader 表格行头"
    },
    {
        key: "repeatFooter",
        datasetKey: "repeatFooter",
        htmlAttr: "data-repeat-footer",
        type: "Boolean",
        defaultValue: false,
        category: "重复元素",
        description: "每页重复 .pfooter 页脚"
    },
    {
        key: "repeatFooterLogo",
        datasetKey: "repeatFooterLogo",
        htmlAttr: "data-repeat-footer-logo",
        type: "Boolean",
        defaultValue: false,
        category: "重复元素",
        description: "每页重复 .pfooter_logo 页脚 Logo"
    },
    {
        key: "repeatFooterPagenum",
        datasetKey: "repeatFooterPagenum",
        htmlAttr: "data-repeat-footer-pagenum",
        type: "Boolean",
        defaultValue: false,
        category: "重复元素",
        description: "每页重复 .pfooter_pagenum 页码区域"
    },
    {
        key: "insertDummyRowItemWhileFormatTable",
        datasetKey: "insertDummyRowItemWhileFormatTable",
        htmlAttr: "data-insert-dummy-row-item-while-format-table",
        type: "Boolean",
        defaultValue: true,
        category: "虚拟行填充",
        description: "插入虚拟行项目填充剩余空间"
    },
    {
        key: "insertDummyRowWhileFormatTable",
        datasetKey: "insertDummyRowWhileFormatTable",
        htmlAttr: "data-insert-dummy-row-while-format-table",
        type: "Boolean",
        defaultValue: false,
        category: "虚拟行填充",
        description: "插入单个完整高度虚拟表格"
    },
    {
        key: "insertFooterSpacerWhileFormatTable",
        datasetKey: "insertFooterSpacerWhileFormatTable",
        htmlAttr: "data-insert-footer-spacer-while-format-table",
        type: "Boolean",
        defaultValue: true,
        category: "虚拟行填充",
        description: "在页脚前插入间隔符"
    },
    {
        key: "debug",
        datasetKey: "debug",
        htmlAttr: "data-debug",
        type: "Boolean",
        defaultValue: false,
        category: "调试",
        description: "启用详细控制台日志"
    }
];

const PADDT_CONFIG_DESCRIPTORS = [
    {
        key: "repeatPaddt",
        datasetKey: "repeatPaddt",
        htmlAttr: "data-repeat-paddt",
        type: "Boolean",
        defaultValue: true,
        category: "PADDT",
        description: "重复 PADDT (保留,暂未使用)"
    },
    {
        key: "insertPaddtDummyRowItems",
        datasetKey: "insertPaddtDummyRowItems",
        htmlAttr: "data-insert-paddt-dummy-row-items",
        type: "Boolean",
        defaultValue: true,
        category: "PADDT",
        description: "PADDT 页面允许虚拟行项目"
    },
    {
        key: "paddtMaxWordsPerSegment",
        datasetKey: "paddtMaxWordsPerSegment",
        htmlAttr: "data-paddt-max-words-per-segment",
        type: "Number",
        defaultValue: 200,
        category: "PADDT",
        description: "每个 PADDT 段落的最大单词数"
    },
    {
        key: "repeatPaddtRowheader",
        datasetKey: "repeatPaddtRowheader",
        htmlAttr: "data-repeat-paddt-rowheader",
        type: "Boolean",
        defaultValue: true,
        category: "PADDT",
        description: "PADDT 页面重复行头"
    },
    {
        key: "paddtDebug",
        datasetKey: "paddtDebug",
        htmlAttr: "data-paddt-debug",
        type: "Boolean",
        defaultValue: false,
        category: "PADDT",
        description: "启用 PADDT 调试日志"
    }
];

// ============================================
// 2. 文档生成函数
// ============================================

/**
 * 按类别分组配置项
 */
function groupByCategory(descriptors) {
    const groups = {};
    descriptors.forEach(desc => {
        const category = desc.category || "其他";
        if (!groups[category]) {
            groups[category] = [];
        }
        groups[category].push(desc);
    });
    return groups;
}

/**
 * 生成 Markdown 格式文档
 */
function generateMarkdown(descriptors, paddtDescriptors) {
    let md = `# PrintForm.js 配置参考

> 自动生成于: ${new Date().toISOString()}
> 来源: js/printform/config.js

## 使用说明

所有配置属性都应用在 \`.printform\` 容器元素上:

\`\`\`html
<div class="printform" 
     data-papersize-width="750" 
     data-papersize-height="1050"
     data-repeat-header="y">
  <!-- 内容 -->
</div>
\`\`\`

## 布尔值格式

布尔类型的配置接受以下值:
- **True**: \`y\`, \`yes\`, \`true\`, \`1\`
- **False**: \`n\`, \`no\`, \`false\`, \`0\`

---

## 主要配置

`;

    // 主配置按类别分组
    const mainGroups = groupByCategory(descriptors);
    Object.keys(mainGroups).sort().forEach(category => {
        md += `\n### ${category}\n\n`;
        md += `| HTML 属性 | 类型 | 默认值 | 说明 |\n`;
        md += `|-----------|------|--------|------|\n`;

        mainGroups[category].forEach(desc => {
            const defaultVal = typeof desc.defaultValue === 'boolean'
                ? (desc.defaultValue ? 'true' : 'false')
                : (desc.defaultValue === '' ? '""' : desc.defaultValue);

            md += `| \`${desc.htmlAttr}\` | ${desc.type} | ${defaultVal} | ${desc.description} |\n`;
        });
    });

    // PADDT 配置
    md += `\n---\n\n## PADDT 配置\n\n`;
    md += `| HTML 属性 | 类型 | 默认值 | 说明 |\n`;
    md += `|-----------|------|--------|------|\n`;

    paddtDescriptors.forEach(desc => {
        const defaultVal = typeof desc.defaultValue === 'boolean'
            ? (desc.defaultValue ? 'true' : 'false')
            : desc.defaultValue;

        md += `| \`${desc.htmlAttr}\` | ${desc.type} | ${defaultVal} | ${desc.description} |\n`;
    });

    // 使用示例
    md += `\n---\n\n## 使用示例\n\n`;
    md += `### 最小配置\n\n\`\`\`html\n`;
    md += `<div class="printform" \n`;
    md += `     data-papersize-width="750" \n`;
    md += `     data-papersize-height="1050">\n`;
    md += `  <!-- 内容 -->\n`;
    md += `</div>\n\`\`\`\n\n`;

    md += `### 完整配置示例\n\n\`\`\`html\n`;
    md += `<div class="printform" \n`;
    md += `     data-debug="y"\n`;
    md += `     data-papersize-width="750" \n`;
    md += `     data-papersize-height="1050"\n`;
    md += `     data-repeat-header="y"\n`;
    md += `     data-repeat-footer-logo="y"\n`;
    md += `     data-repeat-footer-pagenum="y">\n`;
    md += `  <!-- 内容 -->\n`;
    md += `</div>\n\`\`\`\n`;

    return md;
}

/**
 * 生成 HTML 格式文档
 */
function generateHTML(descriptors, paddtDescriptors) {
    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PrintForm.js 配置参考</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 40px; border-bottom: 2px solid #ecf0f1; padding-bottom: 8px; }
    h3 { color: #7f8c8d; margin-top: 30px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    th, td {
      padding: 12px;
      text-align: left;
      border: 1px solid #ddd;
    }
    th {
      background-color: #3498db;
      color: white;
      font-weight: 600;
    }
    tr:nth-child(even) { background-color: #f8f9fa; }
    tr:hover { background-color: #e8f4f8; }
    code {
      background-color: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: "Courier New", monospace;
      font-size: 0.9em;
    }
    pre {
      background-color: #f8f9fa;
      padding: 15px;
      border-left: 4px solid #3498db;
      overflow-x: auto;
      border-radius: 4px;
    }
    .info-box {
      background-color: #e8f4f8;
      border-left: 4px solid #3498db;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .timestamp {
      color: #7f8c8d;
      font-size: 0.9em;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>PrintForm.js 配置参考</h1>
  <p class="timestamp">自动生成于: ${new Date().toLocaleString('zh-CN')}</p>
  
  <div class="info-box">
    <strong>使用说明:</strong> 所有配置属性都应用在 <code>.printform</code> 容器元素上。
  </div>

  <h2>主要配置</h2>
`;

    // 主配置按类别分组
    const mainGroups = groupByCategory(descriptors);
    Object.keys(mainGroups).sort().forEach(category => {
        html += `\n  <h3>${category}</h3>\n`;
        html += `  <table>\n`;
        html += `    <thead>\n`;
        html += `      <tr>\n`;
        html += `        <th>HTML 属性</th>\n`;
        html += `        <th>类型</th>\n`;
        html += `        <th>默认值</th>\n`;
        html += `        <th>说明</th>\n`;
        html += `      </tr>\n`;
        html += `    </thead>\n`;
        html += `    <tbody>\n`;

        mainGroups[category].forEach(desc => {
            const defaultVal = typeof desc.defaultValue === 'boolean'
                ? (desc.defaultValue ? 'true' : 'false')
                : (desc.defaultValue === '' ? '""' : desc.defaultValue);

            html += `      <tr>\n`;
            html += `        <td><code>${desc.htmlAttr}</code></td>\n`;
            html += `        <td>${desc.type}</td>\n`;
            html += `        <td><code>${defaultVal}</code></td>\n`;
            html += `        <td>${desc.description}</td>\n`;
            html += `      </tr>\n`;
        });

        html += `    </tbody>\n`;
        html += `  </table>\n`;
    });

    // PADDT 配置
    html += `\n  <h2>PADDT 配置</h2>\n`;
    html += `  <table>\n`;
    html += `    <thead>\n`;
    html += `      <tr>\n`;
    html += `        <th>HTML 属性</th>\n`;
    html += `        <th>类型</th>\n`;
    html += `        <th>默认值</th>\n`;
    html += `        <th>说明</th>\n`;
    html += `      </tr>\n`;
    html += `    </thead>\n`;
    html += `    <tbody>\n`;

    paddtDescriptors.forEach(desc => {
        const defaultVal = typeof desc.defaultValue === 'boolean'
            ? (desc.defaultValue ? 'true' : 'false')
            : desc.defaultValue;

        html += `      <tr>\n`;
        html += `        <td><code>${desc.htmlAttr}</code></td>\n`;
        html += `        <td>${desc.type}</td>\n`;
        html += `        <td><code>${defaultVal}</code></td>\n`;
        html += `        <td>${desc.description}</td>\n`;
        html += `      </tr>\n`;
    });

    html += `    </tbody>\n`;
    html += `  </table>\n`;

    html += `\n</body>\n</html>`;

    return html;
}

/**
 * 生成 JSON 格式配置
 */
function generateJSON(descriptors, paddtDescriptors) {
    return JSON.stringify({
        generatedAt: new Date().toISOString(),
        version: "1.0",
        mainConfig: descriptors,
        paddtConfig: paddtDescriptors
    }, null, 2);
}

// ============================================
// 3. 主执行函数
// ============================================

function main() {
    console.log('🚀 开始生成配置文档...\n');

    const projectRoot = path.resolve(__dirname, '..');
    const docsDir = path.join(projectRoot, 'docs');

    // 确保 docs 目录存在
    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
        console.log('✅ 创建 docs 目录');
    }

    // 生成 Markdown
    const markdown = generateMarkdown(CONFIG_DESCRIPTORS, PADDT_CONFIG_DESCRIPTORS);
    const mdPath = path.join(docsDir, 'CONFIGURATION.md');
    fs.writeFileSync(mdPath, markdown, 'utf-8');
    console.log(`✅ 生成 Markdown: ${path.relative(projectRoot, mdPath)}`);

    // 生成 HTML
    const html = generateHTML(CONFIG_DESCRIPTORS, PADDT_CONFIG_DESCRIPTORS);
    const htmlPath = path.join(docsDir, 'configuration.html');
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`✅ 生成 HTML: ${path.relative(projectRoot, htmlPath)}`);

    // 生成 JSON
    const json = generateJSON(CONFIG_DESCRIPTORS, PADDT_CONFIG_DESCRIPTORS);
    const jsonPath = path.join(docsDir, 'config-reference.json');
    fs.writeFileSync(jsonPath, json, 'utf-8');
    console.log(`✅ 生成 JSON: ${path.relative(projectRoot, jsonPath)}`);

    console.log('\n🎉 文档生成完成!\n');
    console.log('生成的文件:');
    console.log(`  - ${path.relative(projectRoot, mdPath)}`);
    console.log(`  - ${path.relative(projectRoot, htmlPath)}`);
    console.log(`  - ${path.relative(projectRoot, jsonPath)}`);
    console.log('\n💡 提示: 可以在浏览器中打开 HTML 文件查看可视化文档');
}

// 运行脚本
if (require.main === module) {
    main();
}

module.exports = {
    generateMarkdown,
    generateHTML,
    generateJSON,
    CONFIG_DESCRIPTORS,
    PADDT_CONFIG_DESCRIPTORS
};
