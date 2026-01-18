const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = process.cwd();
const DIST_DIR = path.resolve(PROJECT_ROOT, "dist");
const IMG_DIR = path.resolve(PROJECT_ROOT, "img");
const SOURCE_INDEX = path.resolve(PROJECT_ROOT, "index.html");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyDirectoryContents(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  ensureDir(destDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  entries.forEach((entry) => {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

const FALLBACK_HTML = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PrintForm.js Preview</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 16px; }
      table { border-collapse: collapse; border-spacing: 0; width: 100%; }
      th, td { border: 1px solid #333; padding: 4px 8px; text-align: left; }
      .hint { color: #666; margin: 8px 0 16px; }
      .printform_formatter, .printform_formatter_processed { margin-bottom: 24px; }
    </style>
  </head>
  <body>
    <h1>PrintForm.js 预览页</h1>
    <p class="hint">此页面由 build 后自动生成，用于 <code>npm run preview</code> 验证 <code>dist/printform.js</code>。</p>

    <div class="printform" data-papersize-width="600" data-papersize-height="400" data-repeat-footer-logo="n">
      <div class="pheader"><h2>Sales Report</h2></div>
      <div class="pdocinfo"><p>Date: 2025-05-25</p></div>
      <div class="prowheader">
        <table><tr><th>Item</th><th>Qty</th><th>Price</th></tr></table>
      </div>
      <div class="prowitem"><table><tr><td>Widget A</td><td>2</td><td>$10.00</td></tr></table></div>
      <div class="prowitem"><table><tr><td>Gadget B</td><td>5</td><td>$7.50</td></tr></table></div>
      <div class="prowitem"><table><tr><td>Thingamajig C</td><td>1</td><td>$25.00</td></tr></table></div>
      <div class="pfooter"><p>Thank you for your business</p></div>
      <div class="pfooter_logo">
        <img src="./footer_logo.jpg" alt="Footer Logo" style="height:30px;" />
      </div>
      <template class="custom-dummy-row-item-content">
        <tr style="height:20px;">
          <td colspan="3" style="border:0;text-align:center;color:#999;">-- Empty Row --</td>
        </tr>
      </template>
    </div>

    <script src="./printform.js"></script>
  </body>
</html>
`;

function getSourceIndexHtml() {
  if (!fs.existsSync(SOURCE_INDEX)) {
    return FALLBACK_HTML;
  }
  const content = fs.readFileSync(SOURCE_INDEX, "utf8");
  return content.replace(/\.\/dist\/printform\.js/g, "./printform.js");
}

function writeDistIndexHtml() {
  const html = getSourceIndexHtml();
  const outPath = path.resolve(DIST_DIR, "index.html");
  fs.writeFileSync(outPath, html, "utf8");
}

ensureDir(DIST_DIR);

writeDistIndexHtml();

copyDirectoryContents(IMG_DIR, path.resolve(DIST_DIR, "img"));
