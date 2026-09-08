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
  return { started: true };
}

export async function saveHtmlWithPicker(html, suggestedName, description = "Self-contained PrintForm HTML", { assertCurrent = () => {} } = {}) {
  assertCurrent();
  if (!("showSaveFilePicker" in window)) return false;
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [{ description, accept: { "text/html": [".html"] } }]
  });
  assertCurrent();
  const writable = await handle.createWritable();
  let closing = false;
  try {
    assertCurrent();
    await writable.write(html);
    assertCurrent();
    closing = true;
    await writable.close();
  } catch (error) {
    if (closing) throw Object.assign(new Error("File write completion could not be confirmed", { cause: error }), { code: "FILE_WRITE_UNCONFIRMED" });
    try { await writable.abort?.(); } catch { /* Preserve the original failure; never retry the write. */ }
    throw error;
  }
  // A confirmed close is a real saved snapshot, even if its UI context changed while closing.
  return true;
}
