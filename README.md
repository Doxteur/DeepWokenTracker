# DeepWoken Tracker

A lightweight desktop **overlay** to track your [Deepwoken](https://www.roblox.com/games/4111023553) builds in real time. Import a build exported from **Deepwoken Builder**, then follow your progression in game through a fullscreen, transparent, always-on-top overlay.

Built with **Tauri 2** (Rust) + **React**, **TypeScript**, **Vite** and **Tailwind CSS**.

## Features

- **Fullscreen overlay** — transparent, borderless, always-on-top window that sits over the game.
- **Game mode (click-through)** — let mouse clicks pass through the overlay to the game, toggled with a hotkey.
- **Movable & hideable panels** — drag each panel by its header; show/hide them individually. Positions and visibility are persisted.
- **Build library (CRUD)** — manage multiple builds from a home screen: import, open, rename and delete. Everything is saved locally and restored on relaunch.
- **Stat summary** — pre-shrine (grey) and final stats displayed side by side, à la Deepwoken Builder.
- **Manual progression** — allocate your points as you actually progress in game; the talent plan reacts to your current allocation.
- **Talent plan** — your build's talents as a checklist with live status (acquired / available / prerequisite / missing stats), powered by a local talent database with requirement parsing.
- **Configurable global shortcuts** — change the show/hide hotkey from the settings.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + Shift + D` | Show / hide the overlay (configurable in settings) |
| `Ctrl + Shift + A` | Toggle game mode (click-through) |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- Tauri system dependencies — see the [Tauri prerequisites](https://tauri.app/start/prerequisites/). On Windows you also need the **WebView2** runtime (preinstalled on up-to-date Windows 10/11).

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

1. In Deepwoken Builder, export your build (JSON).
2. Launch the app, click **+ New build**, paste the JSON and load it.
3. Use the **Progression** panel to allocate points as you level up; the **Talents** panel shows what becomes available.
4. Press `Ctrl + Shift + A` to switch to game mode and play; press it again to interact with the overlay.
5. Use the home button in the left panel to go back to your build library.

## Talent data

The local talent database (`src/data/talents.json`) is generated from the community-maintained [`pocamind/data`](https://github.com/pocamind/data) repository via `scripts/build-talents.mjs`. Talent names, descriptions and requirements belong to their respective authors and to Deepwoken.

## Disclaimer

This is an unofficial, fan-made tool and is not affiliated with Deepwoken or its developers.
