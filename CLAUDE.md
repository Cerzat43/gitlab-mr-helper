# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single Tampermonkey userscript (`gitlab-mr-helper.user.js`, vanilla JS, **no build step**) that enhances GitLab merge-request *list* pages on gitlab.com. You mark MRs as "seen" (grayed, persisted via `GM_*` storage); an MR re-surfaces in **amber ("changed")** when it has activity after you saw it, and shows in **green ("ready")** when it is approved and carries no blocking label. Your own MRs are de-emphasized. It is **DOM-only**: no GitLab API calls, no Personal Access Token.

> The original "highlight MRs where I'm an unapproved reviewer" idea was dropped: the MR list DOM exposes neither reviewers nor per-user approval, only assignees and an aggregate approval widget (verified live on gitlab.com). The activity model ("changed since seen") replaces it. See the spec under `docs/superpowers/specs/`.

## Commands

```bash
npm test                       # run the full Node test suite (node --test)
node --test tests/url.test.js  # run a single test file
node -e "require('./gitlab-mr-helper.user.js')"  # sanity-check the file parses & exports cleanly under Node
```

There is no linter, no build, and no bundler. Tests use Node's built-in runner (`node:test` + `node:assert`) — **zero dependencies**, Node ≥ 18 required.

## Architecture

The userscript is one file split into two layers that share its scope, plus a dual-purpose tail block.

**1. Pure logic layer** (top of the file) — `isMrListUrl`, `usernameFromHref`, `classifyMr`, `createSeenStore`, `isBlockingLabel`, `isParkedLabel`, `sortRank`/`SORT_ORDER`, `compareStateSort`. No DOM, no `GM_*`, no globals; everything is passed in as arguments. This is the *only* layer with automated tests (the `tests/*.test.js` files `require()` these functions).

**2. Browser layer** — `gmStorage` (GM_* adapter), `detectCurrentUser`, `SELECTORS`, `scopeSelectors`, `sortStyles`, `setStateSort`, `ensureSortOption`, `watchNativeSortClicks`, `updateTokenFromRow`, `createdAtFromRow`, `applySortOrder`, `labelNamesFromRow`, `parseRow`, `injectStyles`, `applyState`, `ensureEyeButton`, `processRow`, `processList`, `updateBar`, `ensureResetBar`, `debounce`, `main`. Touches `document`, `unsafeWindow`, `MutationObserver`, `GM_*`. **Not unit-testable in Node** — verified live on gitlab.com via Chrome DevTools.

**3. Tail guard** — the script ends with:
```js
if (typeof module !== 'undefined' && module.exports) { module.exports = {...}; }  // Node: export pure fns, do NOT run main()
else if (typeof window !== 'undefined') { main(); }                              // Browser: bootstrap
```
This is load-bearing: it lets Node `require()` the file for tests without executing the browser bootstrap. **After any browser-layer change, run `npm test` to confirm the pure-logic tests still pass** — a green suite proves Node still takes the export branch and never calls `main()`.

### Key invariants when editing

- **The pure layer must never touch the DOM or `GM_*`.** Testability depends on it. The browser layer adapts DOM data into the plain objects the pure functions consume — the MR shape is `{ key, author, updateToken, approved, labels: [string], createdAt }` and `classifyMr` returns one of `'ready' | 'changed' | 'seen' | 'mine' | 'neutral'`, in that priority order. `ready` = `approved && no label passes isBlockingLabel`. `seen`/`changed` come from comparing the stored `updateToken` (last-activity date string captured when marked seen) to the current one.
- **`isParkedLabel` forces `seen`**: `Don't merge` or `Status::Work In Progress` → `classifyMr` returns `'seen'` right after the `ready` check (overrides changed/mine), and the eye button is hidden.
- **State sort is CSS-only** (default unless the URL has `?sort=`): `html[data-mrh-sort="state"]` makes the list a flex column; `applySortOrder` sets each row's inline `style.order` from `compareStateSort` (state rank, then creation date desc — independent of the native sort), only when it changes. Never reorder Vue-owned `<li>` nodes in the DOM. Our option is a clone of a native item appended once to the sort listbox.
- **`isBlockingLabel` defines what blocks "ready"**: any `Status::*` label or `Don't merge`. It strips leading non-letter decoration first, because webedia labels carry emoji/✗ prefixes (e.g. `"✗ Don't merge"`, `"Status::📁 Needs review"`). Edit this one pure function to change the blocklist.
- **All GitLab-markup-dependent CSS selectors live in the single `SELECTORS` object**, validated live on gitlab.com; never scatter selector strings elsewhere. Note the webedia DOM differs from gitlab.com public in places (e.g. self-approval uses `approval-solid-icon`, not `check-circle-icon` — `SELECTORS.approvedIcon` matches both). When a selector breaks, fix it here.
- **MutationObserver loop-safety is intentional and fragile.** The observer watches only `childList`. `applyState`/`updateBar` are no-ops when the value is unchanged, and `ensureEyeButton`/`ensureResetBar`/`injectStyles` inject once. Do not introduce code in `run()`/`processList` that mutates the observed subtree unconditionally on every pass, or you create an infinite loop.
- **Styling must adapt to GitLab's theme.** Use GitLab's `--gl-*` design tokens (e.g. `var(--gl-background-color-subtle, #fafafa)`) with a light fallback, not hardcoded colors, so light/dark modes both render correctly.
- **Persistence key** is the MR's pathname (unique instance-wide), so a MR marked seen on a project list is also grayed on the dashboard.

## Workflow conventions

- Specs and implementation plans live under `docs/superpowers/`. The current feature's spec and plan are dated `2026-06-11`.
- TDD is the norm for the pure layer: add the failing test, confirm it fails, implement, confirm green.
