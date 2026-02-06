# Mouser Auto Click (Electron)

Cross-platform Electron desktop app that can:
- Repeatedly click a target screen position
- Optionally simulate a key press per cycle (example: `F`)
- Capture your current cursor position with one button
- Enter live pick mode and press `Enter` to lock the final position

## Run

```bash
npm install
npm start
```

## Build Installers

```bash
# macOS DMG
npm run dist:mac

# Windows installer (NSIS .exe)
npm run dist:win

# Windows direct-run executable (portable .exe, no install)
npm run dist:win:portable
```

- Output folder: `dist/`
- Icons are auto-generated before packaging via `npm run icons:generate`.
- If you build Windows installer on macOS, you may need extra system tooling depending on your environment.

## Notes

- This app uses `@nut-tree-fork/nut-js` for global mouse/keyboard automation.
- On macOS, you must grant **Accessibility** permissions to the app/terminal running Electron.
- On Linux, depending on your desktop/session, additional accessibility/input permissions may be needed.

## Controls

- `Capture Current Cursor`: Fills X/Y from the current pointer location.
- `Pick Mode (Enter)`: Track cursor live, move to target, then press `Enter` anywhere to confirm position. Press `Esc` to cancel.
- `Start`: Starts auto-clicking at interval in milliseconds.
- `Keyboard Key`: Optional. Supports letters (`F`), numbers, `F1-F12`, arrows, and common keys (`Enter`, `Esc`, etc.).
- `Stop`: Stops automation.

## Profiles

- Name a profile and click `Save/Update` to persist settings (position, interval, key).
- Select a profile from the list to load it into the editor for changes.
- Click `Run Selected` to execute the selected profile directly.
- Profile list is stored locally and survives app restart.
