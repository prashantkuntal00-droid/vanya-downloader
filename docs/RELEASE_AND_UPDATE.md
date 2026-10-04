# Vanya Downloader — Release and Update Guide

This document describes the complete release lifecycle and auto-update mechanism for **Vanya Downloader**.

---

## 1. Overview & Architecture

```
Google Antigravity (Development & Testing)
  │
  ├─ 1. Write Code / Fix Bugs / Add Features
  ├─ 2. Run Tests (`npm test`) & TypeScript Verification (`npx tsc --noEmit`)
  ├─ 3. Run Release Script (`npm run release:patch`)
  │
  ▼
Git Repository & Tagging
  │
  ├─ Automatic Version Bump in `package.json`
  ├─ Automatic Entry Added to `CHANGELOG.md`
  ├─ Git Commit: `chore: release vX.Y.Z`
  ├─ Git Tag: `vX.Y.Z`
  └─ Pushed to `origin/main` + `origin/vX.Y.Z`
  │
  ▼
GitHub Actions CI/CD Pipeline (`.github/workflows/release.yml`)
  │
  ├─ Trigger: Git tag push `v*`
  ├─ Clean Install (`npm ci`)
  ├─ TypeScript Verification (`npx tsc --noEmit`)
  ├─ Full Test Suite Execution (`npm test`)
  ├─ Production Build (`npm run build`)
  ├─ Download Engine Binaries (`npm run fetch-engines`)
  ├─ Package Windows Installer (`electron-builder --win`)
  └─ Publish to GitHub Releases:
       • `Vanya Downloader Setup X.Y.Z.exe`
       • `latest.yml` (cryptographic SHA-512 + update metadata)
       • `*.blockmap`
  │
  ▼
Installed Vanya Downloader (User Machine)
  │
  ├─ Auto-check on startup (non-blocking, delayed by 3s)
  ├─ Periodic check every 4 hours
  ├─ Manual check in Settings → Updates
  ├─ Background download with real-time percentage & speed
  └─ One-click "Restart & Install" (gracefully persists downloads & restarts)
```

---

## 2. Daily Local Development Workflow in Antigravity

1. **Make Changes**: Edit code, implement features, or fix issues.
2. **Verify Types**:
   ```bash
   npx tsc --noEmit
   ```
3. **Run Test Suite**:
   ```bash
   npm test
   ```
4. **Test Run Locally**:
   ```bash
   npm run dev
   ```

---

## 3. Creating a Release

When you are ready to ship an update to users, choose the semantic version bump:

- **Patch release** (bug fixes, small improvements):
  ```bash
  npm run release:patch
  ```
  *Example: 1.0.1 → 1.0.2*

- **Minor release** (new features, backward-compatible):
  ```bash
  npm run release:minor
  ```
  *Example: 1.0.2 → 1.1.0*

- **Major release** (breaking changes, major architectural redesign):
  ```bash
  npm run release:major
  ```
  *Example: 1.1.0 → 2.0.0*

### What the Release Script Does Automatically:
1. Verifies working tree is clean (no uncommitted dirty changes).
2. Verifies git remote `origin` is set to GitHub.
3. Runs TypeScript type checking (`npx tsc --noEmit`). If errors exist, **it stops immediately**.
4. Runs full automated test suite (`npx vitest run`). If any test fails, **it stops immediately**.
5. Bumps version in `package.json`.
6. Appends the new release section to `CHANGELOG.md`.
7. Commits changes (`chore: release vX.Y.Z`).
8. Creates a git tag (`vX.Y.Z`).
9. Pushes both the commit and tag to GitHub.

---

## 4. GitHub Actions CI/CD Pipeline

Once the tag is pushed to GitHub, GitHub Actions executes `.github/workflows/release.yml`:
- Uses standard GitHub Action runner `windows-latest`.
- Enforces strict quality gate: if compilation or tests fail, no release is published.
- Publishes the installer and `latest.yml` to GitHub Releases using GitHub's built-in `GITHUB_TOKEN`.

---

## 5. User Data & Native Messaging Preservation

- **User Data Survival**: All download history, user preferences, and partial downloads are stored in Windows `%APPDATA%\vanya-downloader\`, completely independent of the installation directory (`%LOCALAPPDATA%\Programs\vanya-downloader\`). Updates never delete user data.
- **Active Download Safety**: Before updating, the application gracefully pauses active downloads, flushes metadata to disk, and keeps partial `.part` files intact. Downloads resume seamlessly upon restart.
- **Browser Native Messaging**: The registry keys for Chrome, Edge, and Brave point to `native-host.bat`, which launches `vanya-downloader.exe`. Because NSIS updates in-place into the same application directory, browser native messaging remains functional without needing reinstallation.

---

## 6. Code Signing (Optional)

If you obtain a Windows Authenticode Code Signing Certificate in the future:
1. Base64-encode your `.pfx` or `.p12` certificate file.
2. In your GitHub repository settings, go to **Settings → Secrets and variables → Actions**.
3. Add two repository secrets:
   - `WIN_CSC_LINK`: The base64-encoded certificate string.
   - `WIN_CSC_KEY_PASSWORD`: The password for the certificate.
4. `electron-builder` will automatically pick up these secrets during CI and sign both the installer and uninstaller.
