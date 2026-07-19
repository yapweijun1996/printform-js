function toKebabCase(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function inferType(defaultValue) {
  if (defaultValue === null || defaultValue === undefined) {
    return "Any";
  }
  if (Array.isArray(defaultValue)) {
    return "Array";
  }
  const kind = typeof defaultValue;
  if (kind === "boolean") return "Boolean";
  if (kind === "number") return "Number";
  if (kind === "string") return "String";
  return "Any";
}

function buildMetadataMap(list) {
  const map = {};
  const duplicates = [];
  (list || []).forEach((item) => {
    if (!item || !item.key) return;
    if (map[item.key]) {
      duplicates.push(item.key);
    }
    map[item.key] = item;
  });
  return { map, duplicates };
}

function buildDocDescriptors(configDescriptors, metadataMap, options) {
  const descriptors = [];
  const missingMetadata = [];
  const warn = (options && options.warn) || console.warn;
  const warnMissing = Boolean(options && options.warnMissing);

  (configDescriptors || []).forEach((descriptor) => {
    if (!descriptor || !descriptor.key) return;
    const meta = metadataMap[descriptor.key];
    if (!meta) {
      missingMetadata.push(descriptor.key);
    }
    const datasetKey = descriptor.datasetKey || descriptor.key;
    const htmlAttr = `data-${toKebabCase(datasetKey)}`;
    const defaultValue = descriptor.defaultValue;
    const type = (meta && meta.type) || inferType(defaultValue);
    const category = (meta && meta.category) || "其他";
    const description = (meta && meta.description) || "（待补充说明）";
    const entry = {
      key: descriptor.key,
      datasetKey,
      htmlAttr,
      type,
      defaultValue,
      category,
      description
    };
    if (meta && meta.options) {
      entry.options = meta.options;
    }
    descriptors.push(entry);
  });

  if (warnMissing && missingMetadata.length) {
    missingMetadata.forEach((key) => warn(`[docs] 缺少配置说明: ${key}`));
  }

  return { descriptors, missingMetadata };
}

function findUnknownMetadataKeys(metadataMap, configDescriptors) {
  const configKeys = new Set((configDescriptors || []).map((descriptor) => descriptor.key));
  return Object.keys(metadataMap || {}).filter((key) => !configKeys.has(key));
}

module.exports = {
  buildDocDescriptors,
  buildMetadataMap,
  findUnknownMetadataKeys
};
