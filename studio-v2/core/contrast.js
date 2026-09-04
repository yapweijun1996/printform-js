function rgb(value) {
  const match = String(value).match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
  return match ? match.slice(1, 4).map(Number) : null;
}

function luminance(color) {
  const channels = color.map((value) => value / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function effectiveBackground(node, view) {
  let current = node;
  while (current) {
    const color = view.getComputedStyle(current).backgroundColor;
    if (color && color !== "transparent" && !color.endsWith(", 0)")) return rgb(color);
    current = current.parentElement;
  }
  return [255, 255, 255];
}

export function contrastFailures(doc) {
  const view = doc.defaultView;
  if (!view?.getComputedStyle) return [];
  return Array.from(doc.querySelectorAll(".printform_page h1,.printform_page h2,.printform_page p,.printform_page td,.printform_page th,.printform_page a,.printform_page span")).filter((node) => {
    if (!node.textContent.trim()) return false;
    const style = view.getComputedStyle(node);
    const foreground = rgb(style.color);
    const background = effectiveBackground(node, view);
    if (!foreground || !background) return false;
    const fontSize = Number.parseFloat(style.fontSize) || 16;
    const bold = Number.parseInt(style.fontWeight, 10) >= 700;
    const minimum = fontSize >= 24 || (bold && fontSize >= 18.66) ? 3 : 4.5;
    return contrast(foreground, background) + 0.01 < minimum;
  });
}
