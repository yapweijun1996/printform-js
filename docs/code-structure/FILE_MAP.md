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
- `STUDIO_DESIGN.zh-CN.md`: PrintForm Studio design doc (Phases 1–3, acceptance criteria)
- `ERP_INTEGRATION.zh-CN.md`: data-binding placeholder syntax + backend integration guide

---

## Demos / fixtures

- `index.html`: primary demo
- `index001.html`..`index021.html`: scenario variants
- `tests/`: unit test suite (vitest)

---

## Studio (`studio/`)

Zero-dependency visual tool for building/tuning templates — no bundler, no build step, opened directly as a static HTML file (see [STUDIO_DESIGN.zh-CN.md](../STUDIO_DESIGN.zh-CN.md)).

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

