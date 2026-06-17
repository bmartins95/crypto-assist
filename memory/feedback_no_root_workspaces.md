---
name: feedback-no-root-workspaces
description: Don't use npm workspaces at repo root — it creates root node_modules and corrupts per-project installs
metadata:
  type: feedback
---

Don't use npm workspaces (root `package.json` with `"workspaces"`) in this repo.

**Why:** Adding a root `package.json` with workspaces caused npm to hoist packages from `web/node_modules` to `root/node_modules`, breaking vitest resolution (`@testing-library/jest-dom` was hoisted but `vitest` wasn't). The root `node_modules`, `package.json`, and `package-lock.json` were unexpected and had to be removed and `web/node_modules` had to be fully reinstalled.

**How to apply:** Share code via:
- tsconfig `paths` + webpack `alias` in `next.config.ts` + vitest `resolve.alias` for `web/`
- Metro `extraNodeModules` in `metro.config.js` for `mobile/`
Never install dependencies at the repo root.
