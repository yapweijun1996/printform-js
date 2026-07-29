import WebSocket from "ws";

const DEFAULT_ORIGINS = [
  "https://yapweijun1996.github.io",
  "http://127.0.0.1:8000",
  "http://127.0.0.1:5173",
  "http://localhost:5173"
];

function allowedStudioUrl(rawUrl, origins) {
  try {
    const url = new URL(rawUrl);
    return origins.includes(url.origin) && url.pathname.includes("/studio-v2/");
  } catch {
    return false;
  }
}

export class CdpStudioClient {
  constructor({ cdpUrl = "http://127.0.0.1:9222", origins = DEFAULT_ORIGINS } = {}) {
    this.cdpUrl = cdpUrl.replace(/\/$/, "");
    this.origins = origins;
    this.socket = null;
    this.sequence = 0;
    this.pending = new Map();
  }

  async discoverTarget() {
    const response = await fetch(`${this.cdpUrl}/json/list`);
    if (!response.ok) throw new Error(`CDP discovery returned HTTP ${response.status}`);
    const targets = await response.json();
    const matches = targets.filter((target) => target.type === "page" && allowedStudioUrl(target.url, this.origins));
    if (matches.length !== 1) throw new Error(`Expected one isolated Studio v2 tab, found ${matches.length}`);
    if (!matches[0].webSocketDebuggerUrl) throw new Error("Studio target has no CDP WebSocket URL");
    return matches[0];
  }

  async connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    const target = await this.discoverTarget();
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(target.webSocketDebuggerUrl);
      socket.once("open", () => { this.socket = socket; resolve(); });
      socket.once("error", reject);
      socket.on("message", (data) => this.handleMessage(data));
      socket.on("close", () => {
        this.pending.forEach(({ reject: rejectPending }) => rejectPending(new Error("CDP connection closed")));
        this.pending.clear();
        this.socket = null;
      });
    });
  }

  handleMessage(data) {
    let message;
    try { message = JSON.parse(data.toString()); } catch { return; }
    if (!message.id || !this.pending.has(message.id)) return;
    const pending = this.pending.get(message.id);
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message));
    else pending.resolve(message.result);
  }

  async send(method, params = {}) {
    await this.connect();
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }), (error) => {
        if (error) { this.pending.delete(id); reject(error); }
      });
    });
  }

  async execute(toolName, input = {}) {
    const expression = `window.PrintFormStudioAgent.execute(${JSON.stringify(toolName)}, ${JSON.stringify(input)})`;
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: false });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Studio command threw an exception");
    if (!result.result || result.result.type === "undefined") throw new Error("PrintFormStudioAgent gateway is unavailable");
    return result.result.value;
  }

  close() { this.socket?.close(); }
}

export { DEFAULT_ORIGINS, allowedStudioUrl };
