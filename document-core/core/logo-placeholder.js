const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="72" viewBox="0 0 240 72">
<rect width="238" height="70" x="1" y="1" rx="6" fill="#fff7f8" stroke="#b4233b" stroke-width="2" stroke-dasharray="7 5"/>
<path d="M24 48 38 24l14 24H24Zm8-5h12l-6-10-6 10Z" fill="#8f1525"/>
<text x="66" y="36" fill="#8f1525" font-family="Arial,sans-serif" font-size="15" font-weight="700">YOUR LOGO</text>
<text x="66" y="52" fill="#6e3841" font-family="Arial,sans-serif" font-size="9">Replace in PrintForm Studio</text>
</svg>`;

export const LOGO_PLACEHOLDER_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
