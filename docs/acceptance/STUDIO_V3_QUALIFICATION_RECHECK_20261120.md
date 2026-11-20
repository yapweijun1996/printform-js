# Studio v3 qualification recheck · 2026-11-20

Read-only recheck against source `065adfb5c1dd0b28a1d51537edf19de1284c0257` before the later CA-04 and CA-06 integration. No real model calls, customer data, permission changes or attempt writes. G4, G8 and G9 remain open.

| Gate | Evidence from the recheck | Completion dependency |
| --- | --- | --- |
| CA-05 / G4 | Focused unit tests cover authorization, source and candidate freshness, pixel receipt ownership, synthetic provider wire, independent geometry and completion evidence. Chromium exercised the actual Studio UI, renderer and outgoing request construction with a fixture provider. | A declared real route and explicit disclosure authority for authorized references, same-release real wire checks, a frozen rubric and two independent blinded human reviews. |
| CA-09 / G8 | `validate` found 60 tasks, 20 holdouts and zero errors. The frozen corpus digest remains `sha256:5ec182f03ba8ffb3895ad98c94c7d8bd0ee1832adc9583cae6cfba3cc29e1058`. The read-only preflight refused execution. The selected profile has 3 of 180 recorded slots and 177 missing, with zero envelopes supplied for this recheck. The old corpus has 12 denial tasks with only a `Blocked` outcome, placing its maximum at 144/180 against 162/180 required. The data family max is 0/18, and bindings, references and files each max out at 12/18 against 16/18 required. | Freeze a new corpus only after the supported profile is defined and the required capabilities are qualified. Preserve all prior slots, outcomes and evidence. The supported profile needs a declared route, permitted budget, eligible exact-release runner, independently verified prerequisites and new same-profile attempts. |
| CA-10 / G9 | The local runtime and Pages builds succeeded. The three v3 standalone samples passed structure and attestation validation. Browser and domain checks remain limited to their actual surfaces. The published Studio app, current manifest and immutable manifest identified release `065adfb5c1dd0b28a1d51537edf19de1284c0257`. The actual release, contract, knowledge and package identities all differ from the frozen `8c492ce2a92703a89663d8a12e7f8ed7941d89e5` profile. | Exact deployment and tenant scope, authentication and retention evidence, supported browser/OS and provider conformance, applicable printer/scanner evidence, capacity and cost trials, incident and rollback drills, and maintainer decision. |

The read-only upstream and governance commands exited 1. Neither a fixed-upstream service-owner proof nor a scope-matched data-governance declaration was supplied. The frozen profile records an unavailable upstream version and runner image. These results support route-level history only. The physical inventory exited 2 in this Linux environment with the supported CUPS/USB tools unavailable and no printer or scanner evidence established. No print, scan or device discovery operation was initiated.

The independently verified Wilson interval remains `null`. The latest public manifest was downloaded and consumed as a separate evidence input. It reproduced `liveRelease.status=different-release` with all four identity fields mismatching. No old qualification was transferred.

## Local verification

- Node 24.19.0. The 17 focused G4/G8/G9/physical unit files passed 313 tests before the interval change. The two G8 preflight and register files passed 62 tests after the interval change.
- `npm run build:assets`, `node scripts/build-site.mjs` and `npm run verify:samples` passed. The local agent package hash was `92ed16850a49c6715d606ba1c075e62e81d880265abb6639461089295d37aa0f` and the built Studio app hash was `sha256:fddfacfc4634b2530efdca581392d59259fcb99501ef4d03a331e98638ef658c`. The local build uses the explicit `local` release identity.
- `node scripts/studio-v3-g8.mjs validate` exited 0. `preflight`, `upstream` and `governance` against [the corrected historical profile](STUDIO_V3_G8_CORRECTED_PROFILE_20261017.json) each exited 1 with the missing prerequisites above. Each command made zero model calls and wrote zero attempts.
- Chromium 151.0.7922.173 passed all 14 selected browser cases from `studio-v3-(observation|pixel-observation|semantic-observation|visual-capability)`. The selected specs use fictional data and intercept the Demo route. The comparison case exercised all five injected defects and their repairs.
- Firefox 153.0 passed 13 of the same 14 cases. Its settings dropdown at 1280×720 extended to 730.55 px even though the panel ended at 677 px. The dropdown's viewport-based height cap ignored the space taken by the Studio header and footer.
- Commit `f00edf7` caps the scrollable dropdown using the panel's actual height and adds a regression assertion for the panel boundary. An independent Firefox bounds check moved the dropdown end to 661 px at the prior failing viewport. The rebuilt site passed all 12 composer viewport checks across Chromium 151, Firefox 153 and WebKit 26.5. WebKit initially failed to launch on missing host libraries and ran after those libraries were supplied from isolated local storage. This run used package hash `8a5eba9fc787f0747c44001dc05a6c8d9f6984e4fb3a1a2a45985812be8c7fe5`.
- `node scripts/studio-v3-physical-check.mjs inventory` reported `CUPS_INVENTORY_UNAVAILABLE` and `USB_INVENTORY_UNAVAILABLE`.

## Draft G4 human review procedure

This procedure is preparation for the existing [G4/G8 gates](../STUDIO_V3_CODING_AGENT_ACCEPTANCE.md). It has no reviewer ratings or approved human rubric. Keep the existing [fictional deterministic comparison](STUDIO_V3_CA05_OBS05.md) and historical observations intact.

1. Before generating candidates, freeze each authorized reference, expected fields and bindings, required scenarios, geometry tolerances and reviewer decision rule. Include one clean reference, controls for known detectable defects, and an intentionally ambiguous or unreadable reference. Define tolerances in the reference's declared CSS/physical scale and paper size.
2. For each candidate, collect the exact release and profile identity, raw source and candidate identity, selected scenario and observation ID, and the corresponding rendered page or crop bytes. Preserve authorization and consent decisions as separate evidence. Escalate unclear source text as ambiguity.
3. Two independent reviewers receive the same reference and anonymized candidates in a recorded randomized order. Each independently records `meets expectation`, `defect`, or `uncertain`, with a page, section, field or measurement reference, for each of the following dimensions.

   | Dimension | Human review evidence |
   | --- | --- |
   | Sections and text | Required sections present and in order, with exact supplied text and no fabricated content. |
   | Binding | Required fields and collection values retain their source meaning and appear at the correct target. |
   | Width and alignment | Specified columns, headings and fixed anchors land inside the frozen tolerances, with no clipping or overlap. |
   | Pagination | Required continuation, page breaks, repeated headings and last-page content agree with the frozen expectations. |
   | Ambiguity and source quality | The assistant identifies unreadable or underspecified elements, with supporting evidence and no asserted guess. |

4. The independent comparison also reports deterministic geometry/text/binding results and any stale or foreign observation rejection. The model's own explanation is supporting evidence. Record both reviewer ratings, disagreements and any uncertainty without substituting a model score. An unresolved disagreement or unverified required criterion cannot pass.
