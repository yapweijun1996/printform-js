# Code Structure: File Map

This file explains the main directories and their responsibilities.

---

## Source code (`src/`)

```
src/
├── printform.js             # Public API + auto-init
├── vite-entry.js            # Vite entry (bundling)
└── printform/
    ├── config.js            # Config descriptors + parsing
    ├── dom.js               # DOM measurement + helpers
    ├── debug.js              # Debug session helpers
    ├── helpers.js            # Parsing + sizing + page number helpers
    ├── text.js               # PTAC/PADDT paragraph splitting
    ├── formatter.js          # Formatter export
    └── formatter/
        ├── PrintFormFormatter.js   # Orchestrator class
        ├── pages.js                # Page container logic (n-up wrappers)
        ├── pagination-context.js   # Shared pagination state
        ├── pagination-dummy.js     # Dummy row/spacer fill logic
        ├── pagination-spacing.js   # Spacing calculations
        ├── sections.js             # Collect header/docinfo/rows/footers
        ├── row-types.js            # PTAC/PADDT row detection + header rules
        ├── rendering.js            # Core height/footers calculations
        ├── pagination-render.js    # Row-by-row pagination
        ├── pagination-finalize.js  # Footer fill + page totals
        ├── segments-ptac.js        # PTAC splitting
        └── segments-paddt.js       # PADDT splitting
```

---

## Scripts (`scripts/`)

- `run-vite.js`: start Vite dev server / build / preview
- `generate-config-docs.js`: generate docs from config descriptors
- `postbuild-generate-preview.js`: copy demo HTML + README to `dist/`

---

## Docs (`docs/`)

- `CONFIGURATION.md`: auto-generated config reference
- `USAGE_GUIDE.md` / `USAGE_GUIDE.zh-CN.md`: usage rules and pitfalls
- `LOGIC_DIAGRAM.md` / `LOGIC_DIAGRAM.zh-CN.md`: flowchart
- `AUTO_DOC_GENERATION_GUIDE.md`, `MAINTAINING_DOCS.md`: doc maintenance
- `STUDIO_V2_INDEX.zh-CN.md`: authoritative v2 documentation entry and maturity matrix
- `STUDIO_V2_PRODUCT_STRATEGY.zh-CN.md`: ERP-engineer product positioning and metrics
- `STUDIO_V2_TRUST_AND_AGENT_MODEL.zh-CN.md`: Current Pilot limits, Agent Contract 3.0.0 and E14 UX trust constraints
- `STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md`: P0–P3 implementation sequence and exit criteria
- `STUDIO_DESIGN.zh-CN.md`: frozen Studio v1 design history
- `ERP_INTEGRATION.zh-CN.md`: data-binding placeholder syntax + backend integration guide

---

## Demos / fixtures

- `index.html`: primary demo
- `index001.html`..`index021.html`: scenario variants
- `tests/`: unit test suite (vitest)

---

## Studio (`studio/`)

Frozen zero-dependency v1 visual tool for building/tuning templates — no bundler, no build step, opened directly as a static HTML file (see [STUDIO_DESIGN.zh-CN.md](../STUDIO_DESIGN.zh-CN.md)).

```
studio/
├── index.html                        # App shell
├── studio.js                         # Config panel, block editor, data binding, A/B compare
├── studio.css
├── bridge.js                         # Injected into preview iframes: console/metrics relay + block click handling
├── mustache-lite.js                  # Zero-dependency {{ }} template renderer (also inlined into data-bound exports)
├── templates.json                    # Built-in template picker entries
└── sample-templates/
    └── invoice-databound.html        # Example template demonstrating {{field}} / {{#items}}...{{/items}}
```

---

## Studio v2 (`studio-v2/`)

The intended production single-HTML editor, currently at Production Pilot maturity. The legacy `studio/` remains independent; see the [v2 documentation index](../STUDIO_V2_INDEX.zh-CN.md).

```
studio-v2/
├── index.html                  # PWA shell
├── core/                       # Protocol, binding, validation, runtime, history, command bus
├── adapters/                   # WebMCP and browser command gateway
├── ui/                         # Editors, preview sandbox, files and draft recovery
├── server/                     # Bounded SQLite durable transaction service (E13-SERVER)
├── samples/                    # Sales invoice pilot and boundary scenarios
├── styles/                     # Studio UI styles, each kept below 300 lines
├── sw.js                       # Offline shell and confirmed-update flow
└── AGENT_SETUP.md              # CDP, Codex, Claude Code and Chrome DevTools MCP setup
```

Current AI Designer entry points include `ui/agent-panel-view.js` (panel
structure), `ui/agent-panel.js` (state/render binding), `ui/agent-panel-runtime.js`
(streaming and auto-apply orchestration) and `ui/agent-settings-modal.js`
(provider/vault settings). The E14 IA redesign is a Target change to this surface;
it does not create a second transaction or rendering path.

- `mcp/`: first-party stdio MCP bridge using a CDP origin allowlist.
- `src/document-runtime-entry.js`: standalone document runtime bundle entry.
- `scripts/build-site.mjs`: creates the dedicated Pages artifact in `site-dist/`.
- `scripts/validate-printform-v2.mjs`: machine-readable headless protocol validator.
- `e2e/studio-v2.spec.js`: Chromium, Firefox and WebKit contract, pagination, performance and offline tests.
