// Single source of truth for the pagination engine's own SemVer line.
//
// The engine, Studio v2, the single-HTML Protocol and the Agent Contract each
// version independently (see docs/COMPATIBILITY_MATRIX.zh-CN.md) — they ship on
// different cadences and break for different reasons, so one shared number
// would force meaningless bumps on three of them every time the fourth moved.
//
// package.json's `version` tracks THIS line and is verified against this
// constant by tests/version.test.js, so the copy in package.json cannot drift
// silently (the same machine-check approach the Agent Contract version uses for
// its agent-setup.json / llms.txt copies).
//
// 1.0.0 (2026-07-31): first declared version. The engine itself long predates
// this number — it has been in production ERP use for years — so starting at
// 1.0.0 states the actual stability rather than pretending it is new.
export const PRINTFORM_VERSION = "1.0.0";
