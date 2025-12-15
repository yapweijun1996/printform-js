# Repository Guidelines

## Project Structure & Module Organization
Keep printable sources (`index001.html`–`index007.html`, `index008.html`+, `example.html`) at the repo root; treat each as a production-ready layout. Shared imagery lives in `img/` and must stay lowercase with hyphenated names. Client logic belongs in `js/printform.js`; use `js/printform - Copy.js` only for regression comparison and keep intentional differences noted. Any new tooling or MCP endpoint must update `mcp.config.json` so scripts and ports stay discoverable.

## Build, Test, and Development Commands
`python -m http.server 8000` (run from the repo root) serves the site at `http://localhost:8000/` for print preview and layout QA. `npx eslint js/printform.js` lints the primary script; install ESLint locally before the first run. Use `npx chrome-devtools-mcp@latest` to launch the Chrome DevTools MCP session when auditing print metrics referenced in the config.

## Coding Style & Naming Conventions
All JavaScript sticks to ES5 features, tab indentation, and double-quoted strings; globals stay camelCase (e.g., `repeatFooterLogo`). HTML data attributes should mirror script flags in kebab-case and document non-default behavior in the comment preceding each `.printform` block. Asset filenames remain lowercase, hyphenated, and stored under `img/`.

## Testing Guidelines
Manual Chromium print preview is required before merging; confirm printable widths stay below 750px and pagination matches the form specification. When you add formatting logic, supply a focused smoke demo—either a new `indexXXX.html` variant or an `example.html` tweak—and describe the expected result in your notes. Verify dummy-row templates render at the declared `data-height-of-dummy-row-item`; only enable double fillers deliberately.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat:`, `fix:`, `docs:`) and scope each commit to a single change. Pull requests should list affected layouts, include before/after screenshots for any visual shift, and link tracking issues. Request review from a teammate familiar with print workflows before merging.

## Agent-Specific Notes
Keep `getPrintformConfig` defaults synchronized with inline comments and this guide. Flag any new global variable so it can be centralized in the configuration block. Never delete `js/printform - Copy.js` without maintainer approval, as it anchors regression checks.
