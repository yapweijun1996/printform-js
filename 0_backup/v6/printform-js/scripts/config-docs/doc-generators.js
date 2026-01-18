function groupByCategory(descriptors) {
  const groups = {};
  descriptors.forEach((desc) => {
    const category = desc.category || "其他";
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(desc);
  });
  return groups;
}

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

  const mainGroups = groupByCategory(descriptors);
  Object.keys(mainGroups).sort().forEach((category) => {
    md += `\n### ${category}\n\n`;
    md += `| HTML 属性 | 类型 | 默认值 | 说明 |\n`;
    md += `|-----------|------|--------|------|\n`;

    mainGroups[category].forEach((desc) => {
      const defaultVal = typeof desc.defaultValue === "boolean"
        ? (desc.defaultValue ? "true" : "false")
        : (desc.defaultValue === "" ? "\"\"" : desc.defaultValue);

      md += `| \`${desc.htmlAttr}\` | ${desc.type} | ${defaultVal} | ${desc.description} |\n`;
    });
  });

  md += `\n---\n\n## PADDT 配置\n\n`;
  md += `| HTML 属性 | 类型 | 默认值 | 说明 |\n`;
  md += `|-----------|------|--------|------|\n`;

  paddtDescriptors.forEach((desc) => {
    const defaultVal = typeof desc.defaultValue === "boolean"
      ? (desc.defaultValue ? "true" : "false")
      : desc.defaultValue;

    md += `| \`${desc.htmlAttr}\` | ${desc.type} | ${defaultVal} | ${desc.description} |\n`;
  });

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
  <p class="timestamp">自动生成于: ${new Date().toLocaleString("zh-CN")}</p>

  <div class="info-box">
    <strong>使用说明:</strong> 所有配置属性都应用在 <code>.printform</code> 容器元素上。
  </div>

  <h2>主要配置</h2>
`;

  const mainGroups = groupByCategory(descriptors);
  Object.keys(mainGroups).sort().forEach((category) => {
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

    mainGroups[category].forEach((desc) => {
      const defaultVal = typeof desc.defaultValue === "boolean"
        ? (desc.defaultValue ? "true" : "false")
        : (desc.defaultValue === "" ? "\"\"" : desc.defaultValue);

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

  paddtDescriptors.forEach((desc) => {
    const defaultVal = typeof desc.defaultValue === "boolean"
      ? (desc.defaultValue ? "true" : "false")
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

function generateJSON(descriptors, paddtDescriptors) {
  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    version: "1.0",
    mainConfig: descriptors,
    paddtConfig: paddtDescriptors
  }, null, 2);
}

module.exports = {
  generateMarkdown,
  generateHTML,
  generateJSON
};
