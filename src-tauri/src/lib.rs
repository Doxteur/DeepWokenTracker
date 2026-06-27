use std::sync::atomic::{AtomicBool, Ordering};

// Mode "jeu" : quand actif, l'overlay laisse passer les clics vers le jeu en dessous.
static CLICKTHROUGH: AtomicBool = AtomicBool::new(false);

// Raccourci global courant pour afficher/masquer l'overlay (configurable depuis l'UI).
#[cfg(desktop)]
static TOGGLE_SHORTCUT: std::sync::Mutex<Option<tauri_plugin_global_shortcut::Shortcut>> =
    std::sync::Mutex::new(None);

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

#[cfg(desktop)]
#[tauri::command]
fn set_clickthrough(app: tauri::AppHandle, enabled: bool) {
    use tauri::{Emitter, Manager};
    CLICKTHROUGH.store(enabled, Ordering::Relaxed);
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_ignore_cursor_events(enabled);
        let _ = win.emit("clickthrough", enabled);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    let builder = {
        use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize};
        use tauri_plugin_global_shortcut::{
            Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
        };

        // Ctrl+Shift+A : basculer le mode jeu (clic-traversant). Fixe.
        let toggle_click = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyA);

        builder
            .plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app, shortcut, event| {
                        if event.state() != ShortcutState::Pressed {
                            return;
                        }
                        let Some(win) = app.get_webview_window("main") else {
                            return;
                        };

                        if shortcut == &toggle_click {
                            let next = !CLICKTHROUGH.load(Ordering::Relaxed);
                            CLICKTHROUGH.store(next, Ordering::Relaxed);
                            let _ = win.set_ignore_cursor_events(next);
                            let _ = win.emit("clickthrough", next);
                            return;
                        }

                        // Raccourci d'affichage (configurable).
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
            .invoke_handler(tauri::generate_handler![set_toggle_shortcut, set_clickthrough])
            .setup(move |app| {
                app.global_shortcut().register(toggle_click)?;
                // Raccourci d'affichage par défaut (l'UI le ré-appliquera selon les réglages).
                let _ = set_toggle_shortcut(app.handle().clone(), "Control+Shift+D".to_string());

                // Étend l'overlay sur tout le moniteur principal.
                if let Some(win) = app.get_webview_window("main") {
                    if let Ok(Some(monitor)) = win.primary_monitor() {
                        let pos = monitor.position();
                        let size = monitor.size();
                        let _ = win.set_position(PhysicalPosition::new(pos.x, pos.y));
                        let _ = win.set_size(PhysicalSize::new(size.width, size.height));
                    }
                }
                Ok(())
            })
    };

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
