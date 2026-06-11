# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single Tampermonkey userscript (`gitlab-mr-helper.user.js`, vanilla JS, **no build step**) that enhances GitLab merge-request *list* pages on gitlab.com. It highlights MRs where you are an unapproved reviewer, de-emphasizes your own MRs, and lets you mark MRs as "seen" (grayed, persisted via `GM_*` storage) with a reset bar. It is **DOM-only**: no GitLab API calls, no Personal Access Token.

## Commands

```bash
npm test                       # run the full Node test suite (node --test)
node --test tests/url.test.js  # run a single test file
node -e "require('./gitlab-mr-helper.user.js')"  # sanity-check the file parses & exports cleanly under Node
```

There is no linter, no build, and no bundler. Tests use Node's built-in runner (`node:test` + `node:assert`) — **zero dependencies**, Node ≥ 18 required.

## Architecture

The userscript is one file split into two layers that share its scope, plus a dual-purpose tail block.

**1. Pure logic layer** (top of the file) — `isMrListUrl`, `usernameFromHref`, `classifyMr`, `createSeenStore`. No DOM, no `GM_*`, no globals; everything is passed in as arguments. This is the *only* layer with automated tests (the `tests/*.test.js` files `require()` these functions).

**2. Browser layer** — `gmStorage` (GM_* adapter), `detectCurrentUser`, `SELECTORS`, `parseRow`, `injectStyles`, `applyState`, `ensureEyeButton`, `processRow`, `processList`, `updateBar`, `ensureResetBar`, `debounce`, `main`. Touches `document`, `unsafeWindow`, `MutationObserver`, `GM_*`. **Not unit-testable in Node** — verified manually on gitlab.com.

**3. Tail guard** — the script ends with:
```js
if (typeof module !== 'undefined' && module.exports) { module.exports = {...}; }  // Node: export pure fns, do NOT run main()
else if (typeof window !== 'undefined') { main(); }                              // Browser: bootstrap
```
This is load-bearing: it lets Node `require()` the file for tests without executing the browser bootstrap. **After any browser-layer change, run `npm test` to confirm the 35 pure-logic tests still pass** — a green suite proves Node still takes the export branch and never calls `main()`.

### Key invariants when editing

- **The pure layer must never touch the DOM or `GM_*`.** Testability depends on it. The browser layer adapts DOM data into the plain objects the pure functions consume — the MR shape is `{ key, author, reviewers: [{ username, approved }] }` and `classifyMr` returns one of `'seen' | 'review' | 'mine' | 'neutral'` (priority in that order).
- **All GitLab-markup-dependent CSS selectors live in the single `SELECTORS` object.** They are deliberate best-guesses that must be tuned against the live DOM; never scatter selector strings elsewhere.
- **MutationObserver loop-safety is intentional and fragile.** The observer watches only `childList`. `applyState`/`updateBar` are no-ops when the value is unchanged, and `ensureEyeButton`/`ensureResetBar`/`injectStyles` inject once. Do not introduce code in `run()`/`processList` that mutates the observed subtree unconditionally on every pass, or you create an infinite loop.
- **Styling must adapt to GitLab's theme.** Use GitLab's `--gl-*` design tokens (e.g. `var(--gl-background-color-subtle, #fafafa)`) with a light fallback, not hardcoded colors, so light/dark modes both render correctly.
- **Persistence key** is the MR's pathname (unique instance-wide), so a MR marked seen on a project list is also grayed on the dashboard.

## Workflow conventions

- Specs and implementation plans live under `docs/superpowers/`. The current feature's spec and plan are dated `2026-06-11`.
- TDD is the norm for the pure layer: add the failing test, confirm it fails, implement, confirm green.
