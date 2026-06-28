use std::sync::atomic::{AtomicBool, Ordering};

// Raccourci global courant pour afficher/masquer l'overlay (configurable depuis l'UI).
#[cfg(desktop)]
static TOGGLE_SHORTCUT: std::sync::Mutex<Option<tauri_plugin_global_shortcut::Shortcut>> =
    std::sync::Mutex::new(None);

// Zones interactives (rectangles des panneaux) en pixels physiques, relatifs au coin
// haut-gauche de la fenêtre. Mises à jour par le frontend.
#[derive(Clone, Copy)]
struct Region {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

static REGIONS: std::sync::Mutex<Vec<Region>> = std::sync::Mutex::new(Vec::new());
// État courant du clic-traversant (true = les clics passent vers le jeu).
static IGNORING: AtomicBool = AtomicBool::new(false);

#[derive(serde::Deserialize)]
struct RegionInput {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

#[tauri::command]
fn set_interactive_regions(regions: Vec<RegionInput>) {
    let mut g = REGIONS.lock().unwrap();
    *g = regions
        .into_iter()
        .map(|r| Region {
            x: r.x,
            y: r.y,
            w: r.w,
            h: r.h,
        })
        .collect();
}

// Récupère le JSON d'un build Deepwoken via le proxy officiel (évite CORS + Referer).
#[tauri::command]
async fn fetch_build(id: String) -> Result<String, String> {
    let id = id.trim();
    if id.is_empty() {
        return Err("Empty build id".into());
    }
    let url = format!("https://deepwoken.co/api/proxy/builds/{id}");
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        )
        .header("Referer", "https://deepwoken.co/builder")
        .header("Origin", "https://deepwoken.co")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("Build not found (HTTP {})", status.as_u16()));
    }
    resp.text().await.map_err(|e| e.to_string())
}

// Une ligne reconnue par l'OCR avec sa boîte englobante (pixels physiques de l'écran capturé).
#[derive(serde::Serialize)]
struct OcrLineOut {
    text: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

// Infos d'un moniteur exposées au frontend (sélection de l'écran à scanner).
#[derive(serde::Serialize)]
struct MonitorInfo {
    index: usize,
    name: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    primary: bool,
}

#[cfg(windows)]
#[tauri::command]
fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
    let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for (i, m) in monitors.into_iter().enumerate() {
        out.push(MonitorInfo {
            index: i,
            name: m.name().unwrap_or_default(),
            x: m.x().unwrap_or(0),
            y: m.y().unwrap_or(0),
            width: m.width().unwrap_or(0),
            height: m.height().unwrap_or(0),
            primary: m.is_primary().unwrap_or(false),
        });
    }
    Ok(out)
}

#[cfg(not(windows))]
#[tauri::command]
fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
    Ok(Vec::new())
}

// Déplace l'overlay pour couvrir le moniteur choisi (alignement des marqueurs OCR).
#[cfg(windows)]
#[tauri::command]
fn set_overlay_monitor(app: tauri::AppHandle, index: usize) -> Result<(), String> {
    use tauri::{Manager, PhysicalPosition, PhysicalSize};
    let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
    let m = monitors
        .get(index)
        .ok_or_else(|| "Monitor index out of range".to_string())?;
    let x = m.x().map_err(|e| e.to_string())?;
    let y = m.y().map_err(|e| e.to_string())?;
    let w = m.width().map_err(|e| e.to_string())?;
    let h = m.height().map_err(|e| e.to_string())?;
    if let Some(win) = app.get_webview_window("main") {
        win.set_position(PhysicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        win.set_size(PhysicalSize::new(w, h))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
fn set_overlay_monitor(_app: tauri::AppHandle, _index: usize) -> Result<(), String> {
    Err("Monitor selection is only available on Windows.".into())
}

// OCR d'un moniteur via le moteur natif Windows (aucune dépendance externe).
#[cfg(windows)]
fn ocr_screen(index: Option<usize>) -> Result<Vec<OcrLineOut>, String> {
    use windows::Graphics::Imaging::{BitmapPixelFormat, SoftwareBitmap};
    use windows::Media::Ocr::OcrEngine;
    use windows::Security::Cryptography::CryptographicBuffer;

    let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
    let monitor = match index {
        Some(i) => monitors.into_iter().nth(i),
        None => monitors.into_iter().find(|m| m.is_primary().unwrap_or(false)),
    }
    .or_else(|| xcap::Monitor::all().ok().and_then(|v| v.into_iter().next()))
    .ok_or_else(|| "No monitor found".to_string())?;

    let img = monitor.capture_image().map_err(|e| e.to_string())?;
    let width = img.width() as i32;
    let height = img.height() as i32;
    let mut raw = img.into_raw(); // RGBA8

    // RGBA -> BGRA + alpha opaque (évite les soucis d'alpha pré-multiplié).
    for px in raw.chunks_exact_mut(4) {
        px.swap(0, 2);
        px[3] = 255;
    }

    let buffer = CryptographicBuffer::CreateFromByteArray(&raw).map_err(|e| e.to_string())?;
    let bitmap = SoftwareBitmap::CreateCopyFromBuffer(&buffer, BitmapPixelFormat::Bgra8, width, height)
        .map_err(|e| e.to_string())?;

    let engine = OcrEngine::TryCreateFromUserProfileLanguages()
        .map_err(|e| e.to_string())?;
    let result = engine
        .RecognizeAsync(&bitmap)
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;

    let mut lines = Vec::new();
    for line in result.Lines().map_err(|e| e.to_string())? {
        let text = line.Text().map(|t| t.to_string()).unwrap_or_default();
        let (mut minx, mut miny, mut maxx, mut maxy) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
        if let Ok(words) = line.Words() {
            for w in words {
                if let Ok(r) = w.BoundingRect() {
                    minx = minx.min(r.X);
                    miny = miny.min(r.Y);
                    maxx = maxx.max(r.X + r.Width);
                    maxy = maxy.max(r.Y + r.Height);
                }
            }
        }
        if minx == f32::MAX {
            continue;
        }
        lines.push(OcrLineOut {
            text,
            x: minx as f64,
            y: miny as f64,
            w: (maxx - minx) as f64,
            h: (maxy - miny) as f64,
        });
    }
    Ok(lines)
}

// Masque l'overlay, capture + OCR l'écran, puis ré-affiche l'overlay.
#[cfg(windows)]
#[tauri::command]
async fn scan_screen(
    app: tauri::AppHandle,
    monitor_index: Option<usize>,
) -> Result<Vec<OcrLineOut>, String> {
    use tauri::Manager;
    let win = app.get_webview_window("main");
    if let Some(w) = &win {
        let _ = w.hide();
    }
    let res = tauri::async_runtime::spawn_blocking(move || {
        std::thread::sleep(std::time::Duration::from_millis(150));
        ocr_screen(monitor_index)
    })
    .await
    .map_err(|e| e.to_string())?;
    if let Some(w) = &win {
        let _ = w.show();
        let _ = w.set_focus();
    }
    res
}

#[cfg(not(windows))]
#[tauri::command]
async fn scan_screen(_monitor_index: Option<usize>) -> Result<Vec<OcrLineOut>, String> {
    Err("Screen scan is only available on Windows.".into())
}

#[cfg(desktop)]
#[tauri::command]
fn set_toggle_shortcut(app: tauri::AppHandle, accelerator: String) -> Result<(), String> {
    use std::str::FromStr;
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

    let shortcut =
        Shortcut::from_str(&accelerator).map_err(|e| format!("Invalid shortcut: {e}"))?;
    let gs = app.global_shortcut();

    let mut guard = TOGGLE_SHORTCUT.lock().unwrap();
    if let Some(old) = guard.take() {
        let _ = gs.unregister(old);
    }
    gs.register(shortcut).map_err(|e| e.to_string())?;
    *guard = Some(shortcut);
    Ok(())
}

// Boucle qui ajuste le clic-traversant selon la position globale du curseur.
#[cfg(windows)]
fn spawn_hit_test(app: tauri::AppHandle) {
    use tauri::Manager;
    use windows::Win32::Foundation::POINT;
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(50));

        let Some(win) = app.get_webview_window("main") else {
            continue;
        };
        if !win.is_visible().unwrap_or(false) {
            continue;
        }
        let Ok(origin) = win.outer_position() else {
            continue;
        };

        let mut pt = POINT::default();
        if unsafe { GetCursorPos(&mut pt) }.is_err() {
            continue;
        }

        let lx = (pt.x - origin.x) as f64;
        let ly = (pt.y - origin.y) as f64;

        let inside = {
            let regions = REGIONS.lock().unwrap();
            // Pas encore de zones connues -> on capture tout (écran d'accueil, modales...).
            regions.is_empty()
                || regions
                    .iter()
                    .any(|r| lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h)
        };

        let desired_ignore = !inside;
        if IGNORING.load(Ordering::Relaxed) != desired_ignore {
            let _ = win.set_ignore_cursor_events(desired_ignore);
            IGNORING.store(desired_ignore, Ordering::Relaxed);
        }
    });
}

#[cfg(not(windows))]
fn spawn_hit_test(_app: tauri::AppHandle) {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    let builder = {
        use tauri::{Manager, PhysicalPosition, PhysicalSize};
        use tauri_plugin_global_shortcut::ShortcutState;

        builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init())
            .plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app, shortcut, event| {
                        if event.state() != ShortcutState::Pressed {
                            return;
                        }
                        let Some(win) = app.get_webview_window("main") else {
                            return;
                        };

                        let is_toggle = TOGGLE_SHORTCUT
                            .lock()
                            .map(|g| g.as_ref() == Some(shortcut))
                            .unwrap_or(false);
                        if is_toggle {
                            match win.is_visible() {
                                Ok(true) => {
                                    let _ = win.hide();
                                }
                                _ => {
                                    let _ = win.show();
                                    let _ = win.set_focus();
                                }
                            }
                        }
                    })
                    .build(),
            )
            .invoke_handler(tauri::generate_handler![
                set_toggle_shortcut,
                set_interactive_regions,
                fetch_build,
                scan_screen,
                list_monitors,
                set_overlay_monitor
            ])
            .setup(move |app| {
                // Raccourci d'affichage par défaut (l'UI le ré-appliquera selon les réglages).
                let _ = set_toggle_shortcut(app.handle().clone(), "Control+E".to_string());

                // Étend l'overlay sur tout le moniteur principal.
                if let Some(win) = app.get_webview_window("main") {
                    if let Ok(Some(monitor)) = win.primary_monitor() {
                        let pos = monitor.position();
                        let size = monitor.size();
                        let _ = win.set_position(PhysicalPosition::new(pos.x, pos.y));
                        let _ = win.set_size(PhysicalSize::new(size.width, size.height));
                    }
                }

                spawn_hit_test(app.handle().clone());
                Ok(())
            })
    };

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
