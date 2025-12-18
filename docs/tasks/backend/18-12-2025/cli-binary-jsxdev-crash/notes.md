# CLI binary `jsxDEV` crash

## Problem

Running the compiled `codebuff` binary in production mode crashed at startup with:

`TypeError: import_jsx_dev_runtime2.jsxDEV is not a function`

React 19 intentionally makes `react/jsx-dev-runtime` export `jsxDEV` as `undefined` when `NODE_ENV=production`. Any bundle that calls `jsxDEV(...)` in production will crash.

## Root cause

- `bun build --compile` transpiled TSX/JSX into `jsxDEV(...)` call sites.
- The `@opentui/react` package also shipped an `ErrorBoundary` compiled with `jsxDEV(...)`, which pulled in `react/jsx-dev-runtime`.

## Fix

1. **Build pipeline**: compile the CLI with TypeScript first (TS/TSX → JS) using `cli/tsconfig.emit.json`, then bundle the emitted JS with `bun build --compile`. This avoids Bun's TSX-to-`jsxDEV` transform.
2. **OpenTUI patch during build**: patch `@opentui/react` bundles in `node_modules/` to replace `jsxDEV(...)` with `jsx(...)` from `react/jsx-runtime` (production-safe), handling both `import { Fragment, jsxDEV }` and `import { jsxDEV }` patterns.
3. **Guardrail**: after building, verify the produced binary does not contain `jsxDEV(` call sites.

## Verification

- `bun run --cwd cli build:binary` succeeds.
- `strings -a cli/bin/codebuff | grep 'jsxDEV('` returns no matches.
- `codebuff --help` and starting the TUI no longer crash.
