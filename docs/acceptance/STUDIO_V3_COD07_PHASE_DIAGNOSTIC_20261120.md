# COD-07 terminal phase diagnostic · 2026-11-20

A paired local diagnostic measured two synthetic workspaces for each endpoint. It supplements the [runner acceptance record](STUDIO_V3_CA07_CA08_LOCAL_20261120.md). No runner source, sealed image, HTTP acknowledgement semantics or production state changed. COD-07 remains open.

The runner checkout was `b9c31150db96aa8edd0dfb9a3fedac06511c34e8`, with sealed source hash `b6a89aa87b2f8ae3f17adc436fed6e47ef22c7862599bc3a76b5c509b69ef23b` and image `sha256:e1e20d5004eb9a5099fee5a1e30c4e5e8168106e39f76927fea8e61f3eddf147`. Node 24.19.0, Playwright 1.62.0 and Chromium Headless Shell 151.0.7922.34 (revision 1234) ran on Linux x64. A local serial unit build overlapped the diagnostic.

Each paired request used a real Chromium connection and local pairing. Each workspace contained 128 files, 128 directories and 4,194,304 UTF-8 bytes. The driver observed an active run container and all 64,000 attached stdout bytes before issuing Stop. Docker `die` provided independent process-exit timing. A separate Docker inventory confirmed the run container was removed. The named endpoints are both HTTP measurements and do not give browser click-to-ready latency.

## Observed ranges in milliseconds

| Boundary | `/cancel` | `/close` |
| --- | ---: | ---: |
| Running-call HTTP status | 15.23–19.72 | 7.76–14.03 |
| Terminal HTTP response | 3447.04–3495.64 | 2656.06–2742.59 |
| Independent Docker die | 88–100 | 93–106 |
| Request through verified run removal | 366.23–391.95 | 327.58–356.46 |
| Verified run removal step | 249.64–256.82 | 197.45–229.96 |
| Run removed through helper start boundary | 0.03–0.04 | 0.03–0.05 |
| Sealed snapshot helper total | 3051.66–3123.73 | 2005.00–2027.64 |
| Helper Docker create | 2344.08–2418.07 | 1057.61–1296.58 |
| Helper start, scan, serialize and attached transfer | 406.64–485.28 | 413.60–675.87 |
| Verified helper removal | 216.61–284.67 | 248.43–291.83 |
| Host reconciliation | 0.20–0.54 | 0.20–0.54 |
| Final workspace destroy | — | 296.04–376.18 |
| Reconciliation end through HTTP response | 3.20–4.99 | 300.62–380.44 |

All four requests received a successful terminal acknowledgement after authoritative reconciliation. Final workspace digests and revisions matched the unchanged synthetic inputs. Cancel retained an accurate terminal receipt. Close revoked the old receipt and removed the owned workspace. Both runs left zero owned resources after cleanup. [Anonymized per-sample results and evidence hashes](STUDIO_V3_COD07_PHASE_DIAGNOSTIC_20261120.json)

Docker helper creation was the longest single post-kill interval in both pairs. Each interval can contain work from nested phases and the two samples can overlap. The independently clocked Docker event records process termination. Helper start/attach also includes immutable startup and transfer, so it cannot isolate filesystem or JSON serialization cost. With two samples per endpoint, sequential endpoint runs and concurrent host load, this diagnostic supports neither a p95 estimate nor an endpoint or optimization comparison.

A follow-up can measure pre-creation of the same sealed disposable helper during a run as a separate experiment. The helper must remain unstarted until verified mutator removal. Keep full reconciliation and terminal acknowledgement intact. Compare matched repeated loads and check run-start latency, false acknowledgements, quota, cancellation before start, ownership, timeout, close/revoke and expiry cleanup against the current behavior.

## Local reproduction

The scratch harness instruments the original broker and workspace methods in the diagnostic Node process. It leaves promise settlement, error propagation, Docker commands and isolation intact. It records timestamps and byte counts and restores its hooks on exit. It omits raw source, stdout, workspace/container IDs and pairing credentials from the reported evidence. The run is explicitly armed below. Use the recorded source checkout and sealed image, and wait for unrelated Docker jobs to finish before running.

```sh
phase=/workspace/scratch/printform-stop-phase
export PLAYWRIGHT_BROWSERS_PATH=/workspace/scratch/pf-ca07-browsers
PF_STOP_PHASE_RUN=1 PF_STOP_PHASE_TERMINAL=cancel node "$phase/run.mjs"
PF_STOP_PHASE_RUN=1 PF_STOP_PHASE_TERMINAL=close node "$phase/run.mjs"
node "$phase/report.mjs" CANCEL_JSONL_PATH CLOSE_JSONL_PATH
```

The driver prints the new trace filename for each endpoint. The compact record includes the original trace and harness-script digests.
