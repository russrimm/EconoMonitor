# EconoMonitor Product Engineering Audit

**Date:** 2026-07-31

**Repository:** `russrimm/EconoMonitor`

**Baseline:** `91dd249`

**Implementation branch:** `russrimm-improve-economonitor`

**Status:** Implemented and validated

## Accepted commits

| Commit | Description |
|---|---|
| `6d287af5703d8f448da251f0fe5aa04240dd1b9e` | Harden data accuracy and dashboard workflows |
| `3d7e8e603d276f392a659e0cdf11dc1a41abb9ed` | Harden CI and chart accessibility |

Together, these commits changed 46 existing or new application, workflow,
test, script, dependency, and documentation files.

## Audit scope

The audit covered:

- FRED and FRASER data transformations, dates, frequencies, ranges, freshness,
  and attribution
- Misleading calculations and expected dashboard workflows
- API request validation, caching, proxy behavior, and error handling
- AI request size, token cost, prompt construction, cancellation, privacy, and
  provider failure behavior
- Accessibility, responsive layout, loading, error, empty, and keyboard states
- Search, compare, insights, builder, series-detail, dashboard, release, and
  category workflows
- Next.js Server/Client boundaries, request volume, bundle costs, metadata, and
  shareability
- Tests, CI/CD permissions, third-party action integrity, dependencies, and
  project documentation
- Tracked-file credential exposure and regression prevention

The work intentionally did not deploy, use credentials, alter cloud resources,
rewrite Git history, adopt preview dependencies, or introduce product policies
that require owner approval.

## Executive summary

The audit found and fixed several high-impact issues:

1. AI trend statistics used twelve downsampled points as a proxy for one year,
   which was frequency-dependent and could be economically misleading.
2. Start-based normalization could silently use a later non-zero observation,
   contradicting labels such as "start = 100."
3. Two custom-indicator templates combined incompatible level series and could
   produce economically invalid output.
4. A GitHub token-shaped credential was present in tracked documentation.
5. Public AI routes accepted unnecessarily large or weakly validated payloads,
   and not all streams propagated cancellation.
6. Public FRED and FRASER proxies accepted arbitrary upstream paths and exposed
   upstream error bodies.
7. Data failures were frequently presented as missing records or empty charts.
8. Clearing all pinned indicators did not survive a reload.
9. Search URLs did not fully preserve query, pagination, and sort state.
10. CI granted OIDC permission to every job and referenced third-party actions
    by movable version tags.
11. High-value canvas charts had no keyboard-accessible tabular alternative.

The accepted changes correct these defects, reduce unnecessary data and AI
payloads, make stale/source context visible, strengthen release controls, and
add regression coverage.

## Implemented changes

### 1. Economic-data correctness

#### Observation ranges and dates

- Added an explicit observation-range allowlist and parser. Unknown URL values
  now fall back deterministically instead of producing a start date equal to
  the current day.
- Reworked observation start-date calculations to use UTC calendar fields and
  clamp leap-day results correctly.
- Preserved the existing lookback needed by differencing and annual-change
  transforms, then trimmed padded observations back to the requested range.
- Added a bounded `maxObservations` option. Dashboard cards now request at most
  the latest 80 observations in chronological order instead of downloading an
  entire five-year daily series only to plot the final 80 points.

Relevant files:

- `lib/fred.ts`
- `hooks/useFredQuery.ts`
- `app/compare/page.tsx`
- `app/insights/page.tsx`
- `components/dashboard/MetricCard.tsx`

#### Normalization

- Start-based index and percent-change modes now use the actual first visible
  numeric observation.
- A zero first value no longer causes a silent switch to a later base date.
  The affected series is omitted from the normalized plot and an explicit
  warning explains why normalization is undefined.
- Accessible comparison tables use normalized units such as index, percent
  change, or z-score rather than native units.

Relevant files:

- `lib/transform.ts`
- `app/compare/page.tsx`

#### AI statistics and sampling

- Replaced the frequency-dependent "12-period change" calculation with a
  date-based one-year comparison.
- Statistics are calculated before final prompt sampling.
- AI payload preparation retains the latest point, the exact one-year
  comparison anchor, and minimum/maximum observations.
- Final prompt sampling is retention-aware, so preserved anomalies are not
  discarded by a second evenly spaced sample.
- Labels, units, and series identifiers are JSON-quoted in prompts and are
  explicitly treated as untrusted data.

Relevant files:

- `lib/ai.ts`
- `hooks/useAiAnalysis.ts`
- `tests/core.test.mjs`

#### Custom indicators

- Fixed unary/exponent parsing so both `-2^2` and `2^-2` follow expected
  mathematical precedence.
- Removed the invalid real-wage and misery-index templates, which combined
  incompatible level series without applying the required transformations.
- Added a gender unemployment-gap template that subtracts two compatible
  percentage series.
- Deferred the Chart.js preview bundle until the builder actually renders it.
- Corrected nested landmark markup and associated editor labels with controls.

Relevant files:

- `lib/customIndicator.ts`
- `app/builder/page.tsx`
- `tests/core.test.mjs`

### 2. Freshness, attribution, and dashboard behavior

- Dashboard cards now show the latest observation date and a direct FRED source
  link.
- Prior-observation percentage changes are explicitly labeled as such.
- Series detail now exposes FRED attribution alongside frequency, units,
  seasonal adjustment, and update metadata.
- Metadata or observation failures now render a clear error and retry action
  instead of silently removing a card or reporting a false "not found."
- An intentionally empty pinned-indicator array now persists across reloads.
- Pin controls are visible and operable on touch and keyboard interfaces.
- The sparkline bundle is dynamically loaded.

Relevant files:

- `components/dashboard/MetricCard.tsx`
- `hooks/usePinnedSeries.ts`
- `app/series/[seriesId]/page.tsx`
- `app/page.tsx`

### 3. API and proxy hardening

#### Bounded JSON parsing

Added a streaming JSON reader that enforces both declared and actual byte
limits before parsing:

| Route | Maximum body |
|---|---:|
| AI chat | 96 KiB |
| AI analysis | 256 KiB |
| AI explanation | 64 KiB |

Relevant file:

- `lib/http.ts`

#### AI validation

- Chat history is capped at 20 messages and 4,000 characters per message.
- Analysis is capped at six datasets and 360 finite, dated observations per
  dataset.
- Explanation requests are capped at 60 surrounding observations.
- Series IDs, labels, units, ISO dates, roles, and finite numeric values are
  validated before prompt construction.
- Client chat history and analysis datasets are reduced before transmission.
- Provider startup failures return bounded 429 or 502 responses.
- Every AI route now uses `no-store` and `nosniff` response headers.
- Request abort signals reach the OpenAI SDK, and all streams implement
  cancellation.
- Empty or failed datasets are excluded so one unavailable series does not
  invalidate otherwise usable analysis.

Relevant files:

- `lib/aiValidation.ts`
- `app/api/ai/chat/route.ts`
- `app/api/ai/analyze/route.ts`
- `app/api/ai/explain/route.ts`
- `app/chat/page.tsx`
- `app/compare/page.tsx`
- `app/insights/page.tsx`

#### FRED and FRASER proxies

- Added explicit allowlists for only the upstream paths used by the
  application.
- Rejected oversized query strings.
- Continued stripping caller-supplied API-key parameters.
- Propagated request cancellation upstream.
- Stopped returning upstream response bodies to browsers.
- Added non-cacheable error responses while preserving the existing successful
  response cache lifetimes.

Relevant files:

- `lib/apiProxy.ts`
- `app/api/fred/[...path]/route.ts`
- `app/api/fraser/[...path]/route.ts`

### 4. AI privacy and disclosure

- Added a reusable AI data notice.
- Chat explains that conversation text is sent to the configured provider and
  warns users not to enter personal, confidential, or regulated information.
- Analysis and causal-explanation panels disclose that selected labels and
  chart values are sent only when the user runs the AI action.
- Documentation now describes provider transmission, request bounds, and
  non-cached AI responses.

Relevant files:

- `components/ai/AiDataNotice.tsx`
- `components/ai/InsightsPanel.tsx`
- `components/ai/CausalExplainerPanel.tsx`
- `app/chat/page.tsx`
- `README.md`

### 5. Error, loading, and empty states

- Added shared App Router loading, error, and not-found boundaries.
- Series metadata errors are distinct from authoritative empty responses.
- Series observations, dashboard cards, compare, insights, and category
  browsing now expose failures and retry controls.
- Compare and insights continue to show successfully loaded series when one
  selected series fails.
- Invalid category IDs are rejected without sending `NaN` upstream.
- Normalization and no-data conditions provide explicit feedback.

Relevant files:

- `app/loading.tsx`
- `app/error.tsx`
- `app/not-found.tsx`
- `app/series/[seriesId]/page.tsx`
- `components/dashboard/MetricCard.tsx`
- `app/compare/page.tsx`
- `app/insights/page.tsx`
- `app/categories/[categoryId]/page.tsx`
- `app/search/page.tsx`

### 6. Search and shareable workflows

- Clearing the search field now removes the stale `q` parameter.
- Search URLs preserve query, page, and sort state.
- Browser back/forward navigation synchronizes external URL changes without
  racing pending debounced input.
- Compare and insights validate route-derived ranges and series IDs.
- Search, compare, releases, category filters, and chat controls received
  accessible names.

Relevant files:

- `app/search/page.tsx`
- `app/compare/page.tsx`
- `app/insights/page.tsx`
- `app/releases/page.tsx`
- `app/categories/[categoryId]/page.tsx`
- `app/chat/page.tsx`

### 7. Accessibility and responsive behavior

- Replaced clickable, non-focusable AI panel headers with disclosure buttons
  using `aria-expanded` and `aria-controls`.
- Added `aria-current` to active navigation links.
- Added `aria-pressed` to range, filter, event, and focus-date controls.
- Associated builder and date-picker labels with their controls.
- Corrected release-table loading cell counts and nested main landmarks.
- Kept the scrollable navigation layout through the `xl` breakpoint to avoid
  tablet/laptop overflow.
- Darkened the light-theme accent token to improve contrast.

Relevant files:

- `components/ai/InsightsPanel.tsx`
- `components/ai/CausalExplainerPanel.tsx`
- `components/layout/Navbar.tsx`
- `app/releases/page.tsx`
- `app/builder/page.tsx`
- `app/globals.css`

#### Accessible chart tables

- Added a reusable disclosure beneath the series-detail and compare charts.
- Tables are rendered only after expansion, avoiding initial row-render cost.
- Each table shows at most the latest 100 observations per series.
- The full dataset remains available through the existing Export control.
- Tables use semantic captions, scoped headers, date elements, series names,
  values, and units.
- The bounded horizontal/vertical scroll region is keyboard focusable and has
  an accessible label.
- Comparison tables display transformed and normalized units correctly.

Relevant files:

- `components/charts/ChartDataTable.tsx`
- `app/series/[seriesId]/page.tsx`
- `app/compare/page.tsx`

### 8. SEO and shareability

- Added a metadata base that can be overridden with `NEXT_PUBLIC_SITE_URL`.
- Added title templates, application name, Open Graph metadata, and Twitter
  summary metadata.
- Added `robots.txt` metadata generation and excluded API routes from crawling.
- Added a sitemap for the public static product routes.

Relevant files:

- `app/layout.tsx`
- `app/robots.ts`
- `app/sitemap.ts`

### 9. Dependencies

- Removed the duplicate `openai` dependency declaration.
- Upgraded Next.js and its matching ESLint configuration from 16.1.7 to the
  stable 16.2.11 release.
- Pinned Tailwind CSS and its PostCSS integration to the reproducibly
  installable 4.1.18 release.
- Regenerated `package-lock.json`.
- Added `test`, `typecheck`, and `check:secrets` scripts.

Relevant files:

- `package.json`
- `package-lock.json`

### 10. CI/CD and repository controls

#### Quality gates

The workflow now runs:

1. Tracked-file secret-pattern check
2. `npm ci`
3. Unit tests
4. TypeScript check
5. ESLint
6. Production build

The deployment smoke test now submits an invalid AI request and expects HTTP
400. This verifies routing and validation without making a billable provider
request.

#### Pull-request safety

- Pull requests to `main` run the complete Build/quality job.
- Pull requests do not assemble or upload a deployment package.
- Deploy and Validate jobs are skipped for pull requests.
- Pushes to `main` and manual dispatches preserve the existing deployment
  behavior.

#### Least privilege

- Workflow-level token permissions default to none.
- Build receives only `contents: read`.
- Validate receives no token permissions.
- Only Deploy receives `contents: read` and `id-token: write`.
- Checkout no longer persists credentials in the local Git configuration.

#### Immutable action pins

All third-party actions are pinned to immutable commits:

| Action | Commit |
|---|---|
| `actions/checkout` | `11d5960a326750d5838078e36cf38b85af677262` |
| `actions/setup-node` | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` |
| `actions/download-artifact` | `d3f86a106a0bac45b974a628896c90dbdf5c8093` |
| `azure/login` | `a457da9ea143d694b1b9c7c869ebb04ebe844ef5` |
| `azure/webapps-deploy` | `02a81bead70021f5284939794bcec79c271ab383` |
| `azure/CLI` | `9f7ce6f37c31b777ec6c6b6d1dfe7db79f497956` |

Relevant files:

- `.github/workflows/azure-deploy.yml`
- `AZURE_DEPLOYMENT.md`
- `README.md`

### 11. Secret-exposure controls

- Replaced the tracked GitHub token-shaped value in `BUILDING.md` with a
  non-secret placeholder.
- Removed concrete Azure application, tenant, and subscription identifiers
  from workflow comments.
- Added a dependency-free scanner for tracked text files.
- The scanner detects a deliberately narrow set of high-confidence patterns:
  GitHub personal access tokens, GitHub fine-grained tokens, OpenAI-style keys,
  AWS access-key IDs, private-key blocks, and Azure Storage account keys.
- Findings report only detector name, file, and line number. Matched values are
  neither returned by the scanning API nor printed by the CLI.
- The scanner runs before dependency installation in CI.
- A regression test verifies detection and confirms that result objects do not
  retain the matched token.

Relevant files:

- `BUILDING.md`
- `scripts/check-secrets.mjs`
- `.github/workflows/azure-deploy.yml`
- `tests/core.test.mjs`

## Regression tests added

The native Node test suite now covers nine behaviors:

1. URL range validation and UTC/leap-day date calculations
2. Strict first-observation normalization
3. Date-based AI one-year statistics
4. Bounded AI payload preparation with retained annual and anomaly points
5. AI validation of dates, finite observations, and multiline chat
6. FRED/FRASER proxy allowlists and query limits
7. Declared and streamed JSON body-size enforcement
8. Unary/exponent formula precedence
9. Secret-pattern detection without retaining matched values

Relevant file:

- `tests/core.test.mjs`

## Validation results

| Validation | Result |
|---|---|
| Exact dependency install (`npm ci`) | Passed |
| Native Node regression tests | 9/9 passed |
| TypeScript (`tsc --noEmit`) | Passed |
| ESLint | Passed with zero findings |
| Next.js 16.2.11 production build | Passed |
| App Router output | 20 static/dynamic routes generated |
| Workflow YAML parse | Passed |
| Workflow action-pin check | 7/7 actions pinned to 40-character SHAs |
| Workflow OIDC permission check | Exactly one `id-token: write` grant |
| Tracked-file secret check | Passed across 84 tracked text files |
| Diff whitespace checks | Passed |

Production-mode smoke checks also passed:

- `/` returned 200
- A shareable search URL with query, page, and sort returned 200
- Compare with an invalid range returned 200 and used the safe fallback
- `/robots.txt` returned 200
- `/sitemap.xml` returned 200
- An unknown route returned 404
- Invalid AI chat input returned 400 without provider inference

## Known residual risks and deferred recommendations

### Credential rotation remains required

Removing the token from the current tree does not invalidate or erase the value
from repository history. Commits
`b4ed4a9891488f8e3cc2bf6ee519bd630616ab2f` and
`44a985feb7c618c49cb4f28ee17b16e149a47904` touched the affected line.
The credential owner must revoke or rotate that token outside this repository.
History was intentionally not rewritten.

### Remaining Next.js transitive advisories

`npm audit --omit=dev` reports three high-severity vulnerable-package entries:
`postcss`, `sharp`, and their parent `next`. The `next` entry aggregates the
transitive findings rather than adding an independent vulnerability.

- PostCSS
  [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93),
  [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q),
  and
  [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849)
  are reachable during the trusted build's Tailwind/PostCSS processing. They
  are not reachable from an attacker-controlled runtime input: the application
  has no CSS compilation endpoint, user-authored styles, or uploaded source
  maps. The current exposure is build-time processing of repository-owned CSS.
- Sharp
  [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj)
  is present through Next.js image optimization, but the application imports
  neither `next/image` nor `sharp`, configures no remote image sources, and has
  no image-upload path. The framework image route may load Sharp for a
  repository-owned local asset, but no current application path supplies the
  attacker-controlled image required to exploit the inherited libvips flaws.

At the second follow-up audit, npm still offered only
`next@16.3.0-preview.9` as a resolution. A preview framework upgrade was
intentionally rejected. Upgrade to the next patched stable Next.js release
after compatibility validation.

### Distributed AI abuse controls

The AI routes now have strict request, history, dataset, observation, and output
caps, but they remain publicly callable. Reliable user quotas require an
authentication policy and a shared rate-limit store; an in-memory limiter would
be misleading in a multi-instance App Service deployment.

Relevant files:

- `app/api/ai/chat/route.ts`
- `app/api/ai/analyze/route.ts`
- `app/api/ai/explain/route.ts`

### Server/Client architecture and request waterfalls

Most public data pages remain top-level Client Components and fetch through
browser hooks and route-handler proxies. A route-by-route Server Component or
TanStack hydration migration could improve first content, indexability, and
request waterfalls, but was deferred to avoid a broad architecture rewrite.

Highest-value follow-up targets:

- `app/page.tsx`
- `app/categories/page.tsx`
- `app/releases/page.tsx`
- `app/news/page.tsx`
- `app/series/[seriesId]/page.tsx`
- `hooks/useFredQuery.ts`
- `hooks/useFraserQuery.ts`

### Remaining chart alternatives

Series detail and comparison now have accessible tables. The custom-indicator
builder preview and dashboard sparklines remain canvas-only. The dashboard
cards already expose their latest value, change, dates, and source in text, so
the next table alternative should focus on the custom-indicator preview if that
workflow becomes a primary reporting surface.

### Route-specific metadata and share artwork

Global Open Graph/Twitter metadata, robots, and sitemap support now exist.
Dynamic series/FRASER metadata, canonical custom-domain policy, and share
artwork remain deferred because they require a canonical domain and product
asset decisions.

## Files added

- `app/error.tsx`
- `app/loading.tsx`
- `app/not-found.tsx`
- `app/robots.ts`
- `app/sitemap.ts`
- `components/ai/AiDataNotice.tsx`
- `components/charts/ChartDataTable.tsx`
- `lib/aiValidation.ts`
- `lib/apiProxy.ts`
- `lib/http.ts`
- `scripts/check-secrets.mjs`
- `tests/core.test.mjs`

## Files substantially updated

- `.github/workflows/azure-deploy.yml`
- `AZURE_DEPLOYMENT.md`
- `BUILDING.md`
- `README.md`
- `app/about/page.tsx`
- `app/api/ai/analyze/route.ts`
- `app/api/ai/chat/route.ts`
- `app/api/ai/explain/route.ts`
- `app/api/fraser/[...path]/route.ts`
- `app/api/fred/[...path]/route.ts`
- `app/builder/page.tsx`
- `app/categories/[categoryId]/page.tsx`
- `app/chat/page.tsx`
- `app/compare/page.tsx`
- `app/globals.css`
- `app/insights/page.tsx`
- `app/layout.tsx`
- `app/releases/page.tsx`
- `app/search/page.tsx`
- `app/series/[seriesId]/page.tsx`
- `components/ai/CausalExplainerPanel.tsx`
- `components/ai/InsightsPanel.tsx`
- `components/dashboard/MetricCard.tsx`
- `components/layout/Navbar.tsx`
- `hooks/useAiAnalysis.ts`
- `hooks/useFredQuery.ts`
- `hooks/usePinnedSeries.ts`
- `lib/ai.ts`
- `lib/customIndicator.ts`
- `lib/fred.ts`
- `lib/transform.ts`
- `package.json`
- `package-lock.json`
