---
name: Package manager version alignment
description: Managed workflows can abort when package.json pins a pnpm version unavailable in the current Replit runtime.
---

Keep the packageManager field aligned with the pnpm version provided by the runtime when workflows repeatedly fail during pnpm bootstrap.

**Why:** A project pin to a newer pnpm release caused every managed service to abort before startup while trying to download the pinned version under resource pressure.

**How to apply:** Check `command -v pnpm` and `pnpm --version` before changing workflows; prefer the installed version over adding custom startup commands or duplicate workflows.