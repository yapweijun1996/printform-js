export async function readHtmlFile(file) {
  if (!file || !file.name.toLowerCase().endsWith(".html")) throw new Error("Choose a single .html file");
  return file.text();
}

export function downloadHtml(html, filename) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function saveHtmlWithPicker(html, suggestedName) {
  if (!("showSaveFilePicker" in window)) return false;
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [{ description: "Self-contained PrintForm HTML", accept: { "text/html": [".html"] } }]
  });
  const writable = await handle.createWritable();
  await writable.write(html);
  await writable.close();
  return true;
}
