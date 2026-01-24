# Code Structure: File Map

This file explains the main directories and their responsibilities.

---

## Source code (`js/`)

```
js/
├── printform.js             # Public API + auto-init
├── vite-entry.js            # Vite entry (bundling)
└── printform/
    ├── config.js            # Config descriptors + parsing
    ├── dom.js               # DOM measurement + helpers
    ├── helpers.js           # Parsing + sizing + page number helpers
    ├── text.js              # PTAC/PADDT paragraph splitting
    ├── formatter.js         # Formatter export
    └── formatter/
        ├── PrintFormFormatter.js  # Orchestrator class
        ├── pages.js               # Page container logic (n-up wrappers)
        ├── sections.js            # Collect header/docinfo/rows/footers
        ├── row-types.js           # PTAC/PADDT row detection + header rules
        ├── rendering.js           # Core height/footers calculations
        ├── pagination-render.js   # Row-by-row pagination
        ├── pagination-finalize.js # Footer fill + page totals
        ├── segments-ptac.js       # PTAC splitting
        └── segments-paddt.js      # PADDT splitting
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

---

## Demos / fixtures

- `index.html`: primary demo
- `index001.html`..`index017.html`: scenario variants
- `examples/`, `tests/`: extra samples

