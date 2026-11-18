# Releasing, and what the installer registers

A release is a tag `vX.Y.Z` pushed to GitHub: the release workflow (`.github/workflows/release.yml`) builds the signed NSIS installer and publishes it with `latest.json`, which installed apps read to update themselves. The version comes from `package.json` (`tauri.conf.json` reads it; `Cargo.toml` stays 0.0.0).

For a local build without the signing key: `corepack pnpm build:unsigned`. It writes the installer to `src-tauri/target/release/bundle/nsis/`. Do not run it on a PC that has the real app installed unless you mean to replace it.

## What the installer registers

The installer is per user (`installMode: "currentUser"`), so it needs no admin rights and writes only under the current user's registry hive (HKCU):

- The `.nerd` file extension, named "Nerd's Workbench project", opened with the app (`bundle.fileAssociations` in `src-tauri/tauri.conf.json`). Double-clicking a `.nerd` file opens it in the app; if the app is running, the running window takes the file.
- The usual uninstall entry (Windows "Apps" list).

The uninstaller removes both. `.json` and `.disc.json` are never associated: Explorer sees `.disc.json` as `.json`, which would claim every JSON file on the PC.

To see what a build will register, read the generated `installer.nsi` under `src-tauri/target/release/nsis/x64/` and look for `.nerd` (the `APP_ASSOCIATE` and `APP_UNASSOCIATE` macros).
