# DeepWoken Tracker

A lightweight desktop **overlay** to track your [Deepwoken](https://www.roblox.com/games/4111023553) builds in real time. Import a build from **Deepwoken Builder** (JSON or a share link), then follow your progression in game through a fullscreen, transparent, always-on-top overlay.

Built with **Tauri 2** (Rust) + **React**, **TypeScript**, **Vite** and **Tailwind CSS**.

## Features

- **Talents scanner (OCR)** — scan the in-game talents card screen to detect which offered talents belong to your build, highlight the best pick, and draw markers directly on the talents.
- **Fullscreen overlay** — transparent, borderless, always-on-top window that sits over the game.
- **Smart click-through** — clicks on the panels are captured by the app, clicks on the transparent areas pass straight through to the game. No manual mode to toggle (Windows hit-testing).
- **Movable, resizable & hideable panels** — drag each panel by its header, resize from the bottom-right corner, show/hide them individually. Positions, sizes and visibility are persisted.
- **Build library (CRUD)** — manage multiple builds from a home screen: import, open, rename and delete. Everything is saved locally and restored on relaunch.
- **Import from Deepwoken Builder** — paste the exported JSON, or simply paste a builder link (e.g. `https://deepwoken.co/builder?id=...`) and fetch it automatically.
- **Stat summary** — pre-shrine (grey) and final stats displayed side by side, à la Deepwoken Builder.
- **Manual progression** — allocate your points as you actually level up; the talent plan reacts to your current allocation.
- **Shrine of Order** — for builds that use it, a one-click button applies the in-game stat redistribution to pre-fill your post-shrine allocation.
- **Talent plan** — your build's talents grouped by live status (available / needs talent / missing stats / acquired), powered by a local talent database with requirement parsing.
- **Mantras** — track which of your build's mantras you've obtained.
- **Next steps** — an optimal leveling path (which stat to raise next to unlock the most talents) and the closest unlocks, split into pre-shrine and post-shrine.
- **Overlay settings** — panel opacity, UI scale, and target monitor (the overlay follows the chosen screen so scan markers line up with the game).
- **Configurable global shortcut** — change the show/hide hotkey from the settings.
- **Auto-update** — installed apps check for new signed releases on launch and update in one click.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + E` | Show / hide the overlay (configurable in settings) |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- Tauri system dependencies — see the [Tauri prerequisites](https://tauri.app/start/prerequisites/). On Windows you also need the **WebView2** runtime (preinstalled on up-to-date Windows 10/11).

> The card scanner (OCR) relies on the native Windows OCR engine and is therefore Windows-only.

### Install

```bash
npm install
```

### Run in development

```bash
npm run tauri dev
```

### Build a production app

```bash
npm run tauri build
```

The standalone executable and installers (`.exe` / `.msi`) are generated under the Cargo `target/release` directory (see `bundle/`).

## Usage

1. In Deepwoken Builder, export your build (or copy its share link).
2. Launch the app, click **+ New build**, then paste the link (and **Fetch**) or paste the JSON, and load it.
3. Use the **Progression** panel to allocate points as you level up; the **Talents** panel shows what becomes available, and **Next** suggests the most efficient stat to raise.
4. On the in-game card screen, hit **Scan** in the Talents panel: cards that belong to your build get highlighted, with the recommended pick marked `TAKE`.
5. Tweak opacity, UI scale and the target monitor from the **settings** (gear icon, top-right of the left panel).
6. Use the home button in the left panel to go back to your build library.

Clicks only register on the panels — anywhere else passes through to the game, so you can play normally with the overlay on.

## Releases & auto-update

Releases are produced automatically by GitHub Actions (`.github/workflows/release.yml`):

1. Bump the version in `src-tauri/tauri.conf.json` (and `package.json`).
2. Commit and push to `main`.
3. The workflow detects the new version, builds and **signs** the app, then creates the `vX.Y.Z` tag and a GitHub release with the installer and the `latest.json` update manifest.

Installed apps check `releases/latest/download/latest.json` on startup and offer a one-click update. Signing requires two repository secrets: `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

## Talent data

The local talent database (`src/data/talents.json`) is generated from the community-maintained [`pocamind/data`](https://github.com/pocamind/data) repository via `scripts/build-talents.mjs`. Talent names, descriptions and requirements belong to their respective authors and to Deepwoken.

## Disclaimer

This is an unofficial, fan-made tool and is not affiliated with Deepwoken or its developers.
