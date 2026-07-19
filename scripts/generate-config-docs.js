#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const { MAIN_CONFIG_METADATA, PADDT_CONFIG_METADATA } = require("./config-docs/descriptor-metadata.js");
const { buildMetadataMap, buildDocDescriptors, findUnknownMetadataKeys } = require("./config-docs/descriptor-utils.js");
const { generateMarkdown, generateHTML, generateJSON } = require("./config-docs/doc-generators.js");

async function loadConfigDescriptors() {
  const configPath = path.resolve(__dirname, "../src/printform/config.js");
  const configUrl = pathToFileURL(configPath).href;
  const configModule = await import(configUrl);
  if (!configModule.CONFIG_DESCRIPTORS || !configModule.PADDT_CONFIG_DESCRIPTORS) {
    throw new Error("Missing CONFIG_DESCRIPTORS or PADDT_CONFIG_DESCRIPTORS from config.js");
  }
  return {
    main: configModule.CONFIG_DESCRIPTORS,
    paddt: configModule.PADDT_CONFIG_DESCRIPTORS
  };
}

function ensureDocsDir(projectRoot) {
  const docsDir = path.join(projectRoot, "docs");
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
    console.log("✅ 创建 docs 目录");
  }
  return docsDir;
}

function warnUnknownMetadata(label, metadataMap, configDescriptors) {
  const unknown = findUnknownMetadataKeys(metadataMap, configDescriptors);
  unknown.forEach((key) => {
    console.warn(`[docs] ${label} 元数据未匹配到配置项: ${key}`);
  });
}

async function main() {
  console.log("🚀 开始生成配置文档...\n");

  const projectRoot = path.resolve(__dirname, "..");
  const docsDir = ensureDocsDir(projectRoot);
  const { main, paddt } = await loadConfigDescriptors();

  const { map: mainMetadataMap, duplicates: mainDuplicates } = buildMetadataMap(MAIN_CONFIG_METADATA);
  const { map: paddtMetadataMap, duplicates: paddtDuplicates } = buildMetadataMap(PADDT_CONFIG_METADATA);
  mainDuplicates.forEach((key) => console.warn(`[docs] 主配置元数据重复: ${key}`));
  paddtDuplicates.forEach((key) => console.warn(`[docs] PADDT 元数据重复: ${key}`));

  warnUnknownMetadata("主配置", mainMetadataMap, main);
  warnUnknownMetadata("PADDT", paddtMetadataMap, paddt);

  const { descriptors: mainDescriptors } = buildDocDescriptors(main, mainMetadataMap, { warnMissing: true });
  const { descriptors: paddtDescriptors } = buildDocDescriptors(paddt, paddtMetadataMap, { warnMissing: true });

  const markdown = generateMarkdown(mainDescriptors, paddtDescriptors);
  const mdPath = path.join(docsDir, "CONFIGURATION.md");
  fs.writeFileSync(mdPath, markdown, "utf-8");
  console.log(`✅ 生成 Markdown: ${path.relative(projectRoot, mdPath)}`);

  const html = generateHTML(mainDescriptors, paddtDescriptors);
  const htmlPath = path.join(docsDir, "configuration.html");
  fs.writeFileSync(htmlPath, html, "utf-8");
  console.log(`✅ 生成 HTML: ${path.relative(projectRoot, htmlPath)}`);

  const json = generateJSON(mainDescriptors, paddtDescriptors);
  const jsonPath = path.join(docsDir, "config-reference.json");
  fs.writeFileSync(jsonPath, json, "utf-8");
  console.log(`✅ 生成 JSON: ${path.relative(projectRoot, jsonPath)}`);

  console.log("\n🎉 文档生成完成!\n");
  console.log("生成的文件:");
  console.log(`  - ${path.relative(projectRoot, mdPath)}`);
  console.log(`  - ${path.relative(projectRoot, htmlPath)}`);
  console.log(`  - ${path.relative(projectRoot, jsonPath)}`);
  console.log("\n💡 提示: 可以在浏览器中打开 HTML 文件查看可视化文档");
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ 文档生成失败:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  generateMarkdown,
  generateHTML,
  generateJSON,
  loadConfigDescriptors
};
