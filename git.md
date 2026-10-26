# Madhura WhatsApp CRM — Multi-Repository & Git Synchronization Architecture

This document defines the repository topology, remote configurations, branch mappings, and exact step-by-step push workflows across the Madhura WhatsApp ecosystem.

---

## 1. Repository Topology

The project is structured as a unified monorepo locally, with dedicated standalone repositories for individual components on GitHub:

| Scope | Local Directory | GitHub Repository URL | Default Branch | Port / Role |
| :--- | :--- | :--- | :--- | :--- |
| **Monorepo (Primary)** | `.` (Root) | `https://github.com/Ananth-madura/Madhura_WA.git` | `main` | Full codebase (Backend + Frontend + Landing + Docs) |
| **Frontend Workspace** | `frontend/` | `https://github.com/madhuratech/Madhura-wa-frontend.git` | `main` | Port `3001` (Authenticated React CRM App) |
| **Backend API** | `backend/` | `https://github.com/madhuratech/Madhura-wa-backend.git` | `main` | Port `5001` (Node/Express API & Baileys Engine) |
| **Landing Page** | `landing_page/` | `https://github.com/madhuratech/wa-landing_page-.git` | `main` | Port `3002` (Vite + Tailwind Public Marketing Site) |

---

## 2. Remote Configuration Setup

To avoid manually typing long URLs and to ensure consistent deployments, configure the following named remotes in your local workspace:

```bash
# 1. Monorepo (Root)
git remote add monorepo https://github.com/Ananth-madura/Madhura_WA.git

# 2. Standalone Frontend
git remote add frontend-repo https://github.com/madhuratech/Madhura-wa-frontend.git

# 3. Standalone Backend
git remote add backend-repo https://github.com/madhuratech/Madhura-wa-backend.git

# 4. Standalone Landing Page
git remote add landing-repo https://github.com/madhuratech/wa-landing_page-.git
```

> **Note:** `landing-repo` must point at `madhuratech/wa-landing_page-.git`. Older copies of this document listed `Ananth-madura/whatsapp_landing.git`; that repository is not the push target used by the sync script. If your remote is stale, repoint it with:
> ```bash
> git remote set-url landing-repo https://github.com/madhuratech/wa-landing_page-.git
> ```

To verify your remotes at any time:
```bash
git remote -v
```

---

## 3. Push Commands by Target

### A. Push Full Monorepo (`Madhura_WA`)

To push all changes (including backend, frontend, landing page, and documentation) to the primary monorepo:

```bash
# Push the current working branch to remote main (fast-forward only)
git push monorepo "$(git branch --show-current):main"

# Push the branch under its own name for pull-request tracking
git push monorepo "$(git branch --show-current)"
```

The commands are branch-agnostic on purpose: use whatever branch you are on (`feature/shared-number-assignment`, `feature/enterprise-multi-tenant-multi-branch`, etc.) instead of hardcoding a name. PowerShell equivalent: `git push monorepo "$(git branch --show-current):main"`.

> Never use `--force` when publishing to monorepo `main`. A rejected push means the remote moved ahead — pull or rebase first.

---

### B. Push Subtree Components (Frontend, Backend, Landing Page)

Since the components live inside subdirectories (`frontend/`, `backend/`, and `landing_page/`), use **Git Subtree** to push them cleanly to their respective standalone repositories.

#### Option 1: High-Speed Subtree Split (Recommended & Resilient)

Using `git subtree split` extracts the directory history into a lightweight branch and pushes it with zero overhead:

```powershell
# ─────────────────────────────────────────────────────────────
# 1. PUSH LANDING PAGE (Port 3002 -> wa-landing_page-)
# ─────────────────────────────────────────────────────────────
git branch -D split-landing 2>$null
git subtree split --prefix=landing_page -b split-landing
git push landing-repo split-landing:main --force

# ─────────────────────────────────────────────────────────────
# 2. PUSH FRONTEND (Port 3001 -> Madhura-wa-frontend)
# ─────────────────────────────────────────────────────────────
git branch -D split-frontend 2>$null
git subtree split --prefix=frontend -b split-frontend
git push frontend-repo split-frontend:main --force

# ─────────────────────────────────────────────────────────────
# 3. PUSH BACKEND (Port 5001 -> Madhura-wa-backend)
# ─────────────────────────────────────────────────────────────
git branch -D split-backend 2>$null
git subtree split --prefix=backend -b split-backend
git push backend-repo split-backend:main --force
```

#### Option 2: Direct `git subtree push`

If the standalone repositories share an identical fast-forward subtree history:

```bash
# Push landing page
git subtree push --prefix=landing_page landing-repo main

# Push frontend
git subtree push --prefix=frontend frontend-repo main

# Push backend
git subtree push --prefix=backend backend-repo main
```

---

### C. Pulling Updates from Sub-Repositories (e.g. Landing Page)

Because `landing_page/` is a subfolder inside this monorepo rather than an independent `.git` checkout, running a raw `git pull` inside `landing_page` operates on the monorepo root. 

When changes are committed directly to `https://github.com/Ananth-madura/whatsapp_landing.git` (e.g. via GitHub or Lovable/GPT-Engineer), pull them into `landing_page/` using:

```powershell
# 1. Fetch latest changes from whatsapp_landing
git fetch landing-repo main

# 2. Extract into landing_page/ directory
git archive --output=landing.tar landing-repo/main
tar -xf landing.tar -C landing_page
Remove-Item landing.tar -Force

# 3. Commit and push back to monorepo
git add landing_page/
git commit -m "sync(landing): pull latest changes from wa-landing_page-"
git push monorepo "$(git branch --show-current):main"
```

Or run the dedicated pull helper:
```powershell
.\scripts\pull-landing-repo.ps1
```


---

## 4. One-Click Automated Push Script

To synchronize all 4 repositories in a single command, you can run the automated PowerShell script located at:
`scripts/sync-all-git-repos.ps1`

### Running the sync script:
```powershell
.\scripts\sync-all-git-repos.ps1              # validate -> push -> verify
.\scripts\sync-all-git-repos.ps1 -Force       # push committed history despite a dirty tree
.\scripts\sync-all-git-repos.ps1 -SkipVerify  # skip the remote SHA report
```

The script performs:
1. Working tree validation — aborts on uncommitted tracked changes unless `-Force` is passed; untracked files are reported but never pushed.
2. Push to Primary Monorepo (`Ananth-madura/Madhura_WA`) — current branch to `main`, then the branch under its own name.
3. Subtree split & push to Landing Page (`madhuratech/wa-landing_page-`).
4. Subtree split & push to Frontend (`madhuratech/Madhura-wa-frontend`).
5. Subtree split & push to Backend (`madhuratech/Madhura-wa-backend`).
6. Verification report — fetches each remote's `main` and compares it against the local commit/split SHA, exiting non-zero on any mismatch.

Exit codes: `0` on a fully verified sync, `1` on a dirty tree (without `-Force`), a git failure, or a SHA mismatch. Git's own stderr notices (`To <url> ...`, subtree split progress, CRLF warnings) are captured instead of being re-emitted, so a successful sync no longer looks like a PowerShell failure.

---

## 5. Port 3002 White Screen Error — Resolved Root Cause

The white screen issue encountered on port `3002` (`landing_page`) has been diagnosed and permanently resolved:

1. **Uncaught TypeError in Marketing Content Aggregator**:
   - **Location**: `landing_page/src/pages/marketing/content/index.js`
   - **Cause**: Line 45 used `...SUPPORT_PAGES` inside `RAW_PAGES = [...]`. Because `SUPPORT_PAGES` is exported as an Object keyed by URL path (rather than an Array), spreading it directly threw:
     `TypeError: SUPPORT_PAGES is not iterable`
   - **Fix**: Updated to `...Object.values(SUPPORT_PAGES)` to match `PRODUCT_EXTRA_PAGES` and `LEGAL_EXTRA_PAGES`.

2. **Broken Route Target**:
   - **Location**: `landing_page/src/pages/marketing/content/support.js`
   - **Cause**: Pointed to non-existent `/resources/changelog`.
   - **Fix**: Corrected route target to `/changelog`.

3. **Added Production Error Boundary**:
   - **Location**: `landing_page/src/components/ErrorBoundary.jsx` & `src/main.jsx`
   - **Benefit**: Replaces blank white screen crashes with a branded recovery UI (Reload Page / Back to Home) and structured debugging details.

4. **Launcher Integration**:
   - **Location**: `start_normal.bat`
   - **Update**: Automated port freeing, dependency checks, and launch command for port `3002` alongside ports `3001` and `5001`.
