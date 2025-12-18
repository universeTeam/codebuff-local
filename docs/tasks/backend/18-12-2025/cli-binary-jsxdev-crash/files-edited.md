# Files Edited

- File path: `cli/scripts/build-binary.ts`
  - Line ranges modified: 130-228, 274-349
  - Description: Switched the binary build to a TS emit + Bun compile pipeline (with guaranteed temp cleanup on failures), patched `@opentui/react` to avoid `jsxDEV` in production (including `jsxDEV`-only imports), and added a post-build check to fail if `jsxDEV(` call sites remain.

- File path: `cli/tsconfig.emit.json`
  - Line ranges modified: 1-10
  - Description: Added an emit-enabled tsconfig for producing JS output during binary builds.

- File path: `cli/.gitignore`
  - Line ranges modified: 11-12
  - Description: Ignored the transient `.tmp-codebuff-cli-tsc-*` emit directory created during binary builds.

- File path: `docs/tasks/backend/18-12-2025/cli-binary-jsxdev-crash/notes.md`
  - Line ranges modified: 1-27
  - Description: Documented the root cause and verification steps for the React 19 `jsxDEV` production crash.
