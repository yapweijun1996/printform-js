import WebSocket from "ws";
import { AGENT_CONTRACT_VERSION, PROTOCOL_VERSION } from "../studio-v2/core/constants.js";
import { stableStringify } from "../studio-v2/core/json.js";
import { TOOL_CONTRACTS } from "../studio-v2/core/tool-contracts.js";

const DEFAULT_ORIGINS = [
  "https://yapweijun1996.github.io",
  "http://127.0.0.1:8000",
  "http://127.0.0.1:5173",
  "http://localhost:5173"
];

const LOCAL_TOOL_CATALOG = TOOL_CONTRACTS.map((tool) => ({
  name: tool.name,
  description: tool.description,
  inputSchema: structuredClone(tool.inputSchema)
}));

function targetIdentity(target) {
  return [target?.id || "", target?.url || "", target?.webSocketDebuggerUrl || ""].join("\u0000");
}

function rejectPending(pending, code = "CDP_CONNECTION_CLOSED") {
  const error = Object.assign(new Error("CDP connection closed"), { code });
  pending.forEach(({ reject }) => reject(error));
  pending.clear();
}

function catalogMatches(actual) {
  return Array.isArray(actual) && stableStringify(actual) === stableStringify(LOCAL_TOOL_CATALOG);
}

function allowedStudioUrl(rawUrl, origins) {
  try {
    const url = new URL(rawUrl);
    return origins.includes(url.origin) && url.pathname.includes("/studio-v2/");
  } catch {
    return false;
  }
}

export class CdpStudioClient {
  constructor({ cdpUrl = "http://127.0.0.1:9222", origins = DEFAULT_ORIGINS, protocolVersion = PROTOCOL_VERSION, contractVersion = AGENT_CONTRACT_VERSION } = {}) {
    this.cdpUrl = cdpUrl.replace(/\/$/, "");
    this.origins = origins;
    this.socket = null;
    this.sequence = 0;
    this.pending = new Map();
    this.protocolVersion = protocolVersion;
    this.contractVersion = contractVersion;
    this.contractChecked = false;
    this.target = null;
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

  async connect(checkTarget = true) {
    if (!checkTarget && this.socket?.readyState === WebSocket.OPEN) return;
    const target = await this.discoverTarget();
    if (this.socket?.readyState === WebSocket.OPEN && targetIdentity(this.target) === targetIdentity(target)) return;
    if (this.socket) {
      const previous = this.socket;
      this.socket = null;
      this.target = null;
      this.contractChecked = false;
      rejectPending(this.pending, "CDP_TARGET_REPLACED");
      previous.close();
    }
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(target.webSocketDebuggerUrl);
      socket.once("open", () => { this.socket = socket; this.target = target; resolve(); });
      socket.once("error", reject);
      socket.on("message", (data) => this.handleMessage(data));
      socket.on("close", () => {
        if (this.socket !== socket) return;
        rejectPending(this.pending);
        this.socket = null;
        this.target = null;
        this.contractChecked = false;
      });
    });
  }

  handleMessage(data) {
    let message;
    try { message = JSON.parse(data.toString()); } catch { return; }
    if (!message.id || !this.pending.has(message.id)) return;
    const pending = this.pending.get(message.id);
    this.pending.delete(message.id);
    if (message.error) pending.reject(Object.assign(new Error("CDP command failed"), { code: "CDP_COMMAND_FAILED" }));
    else pending.resolve(message.result);
  }

  async send(method, params = {}) {
    await this.connect(false);
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }), (error) => {
        if (error) { this.pending.delete(id); reject(error); }
      });
    });
  }

  async evaluateGateway(toolName, input = {}) {
    const expression = `window.PrintFormStudioAgent.execute(${JSON.stringify(toolName)}, ${JSON.stringify(input)})`;
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: false });
    if (result.exceptionDetails) throw Object.assign(new Error("Studio command failed"), { code: "STUDIO_COMMAND_FAILED" });
    if (!result.result || result.result.type === "undefined") throw Object.assign(new Error("Studio gateway unavailable"), { code: "STUDIO_GATEWAY_UNAVAILABLE" });
    return result.result.value;
  }

  async ensureContract() {
    if (this.socket) await this.connect();
    if (this.contractChecked) return;
    const response = await this.evaluateGateway("get_capabilities", {});
    const actualProtocol = response?.ok && response.result?.protocolVersion;
    if (actualProtocol !== this.protocolVersion) throw Object.assign(new Error("Studio Protocol version is incompatible"), { code: "STUDIO_PROTOCOL_VERSION_MISMATCH" });
    const actual = response?.ok && response.result?.contractVersion;
    if (actual !== this.contractVersion) throw Object.assign(new Error("Studio Agent Contract version is incompatible"), { code: "AGENT_CONTRACT_VERSION_MISMATCH" });
    if (!catalogMatches(response?.ok && response.result?.tools)) throw Object.assign(new Error("Studio Agent tool catalog is incompatible"), { code: "AGENT_TOOL_CATALOG_MISMATCH" });
    this.contractChecked = true;
  }

  async execute(toolName, input = {}) {
    await this.ensureContract();
    return this.evaluateGateway(toolName, input);
  }

  close() {
    this.contractChecked = false;
    this.target = null;
    const socket = this.socket;
    this.socket = null;
    rejectPending(this.pending);
    socket?.close();
  }
}

export { DEFAULT_ORIGINS, allowedStudioUrl };
