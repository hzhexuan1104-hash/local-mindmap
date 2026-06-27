#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, HashMap},
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

const REGISTRY_FILE_NAME: &str = "desktop-plugin-registry.json";
const MANIFEST_FILE_NAME: &str = "manifest.json";
const CONFIG_DIR_NAME: &str = "config";
const ALLOWED_CAPABILITIES: &[&str] = &[
    "exportText",
    "themePack",
    "iconPack",
    "nodeTypePack",
    "toolPanel",
];
const FORBIDDEN_MANIFEST_FIELDS: &[&str] = &["code", "script", "eval", "function", "remoteUrl"];

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativePluginAbi {
    version: u32,
    exports: BTreeMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativePluginManifest {
    manifest_version: u32,
    plugin_id: String,
    name: String,
    version: String,
    author: String,
    description: String,
    plugin_type: String,
    platform: Option<String>,
    arch: Option<String>,
    entry: String,
    capabilities: Vec<String>,
    enabled: bool,
    abi: Option<NativePluginAbi>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPluginManifestError {
    plugin_id: Option<String>,
    manifest_path: String,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPluginListResult {
    plugin_dir: String,
    plugins: Vec<NativePluginManifest>,
    invalid_plugins: Vec<DesktopPluginManifestError>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct DesktopPluginRegistry {
    enabled: HashMap<String, bool>,
}

fn plugin_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?
        .join("plugins");

    fs::create_dir_all(&dir)
        .map_err(|error| format!("Failed to create desktop plugin directory: {error}"))?;

    Ok(dir)
}

fn config_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?
        .join(CONFIG_DIR_NAME))
}

fn ensure_config_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = config_root_dir(app)?;

    fs::create_dir_all(&dir)
        .map_err(|error| format!("Failed to create desktop config directory: {error}"))?;

    Ok(dir)
}

fn registry_path(plugin_dir: &Path) -> PathBuf {
    plugin_dir.join(REGISTRY_FILE_NAME)
}

fn load_registry(plugin_dir: &Path) -> DesktopPluginRegistry {
    let path = registry_path(plugin_dir);
    let Ok(raw_text) = fs::read_to_string(path) else {
        return DesktopPluginRegistry::default();
    };

    serde_json::from_str(&raw_text).unwrap_or_default()
}

fn save_registry(plugin_dir: &Path, registry: &DesktopPluginRegistry) -> Result<(), String> {
    let raw_text = serde_json::to_string_pretty(registry)
        .map_err(|error| format!("Failed to serialize desktop plugin registry: {error}"))?;

    fs::write(registry_path(plugin_dir), raw_text)
        .map_err(|error| format!("Failed to write desktop plugin registry: {error}"))
}

fn value_string(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn is_safe_plugin_id(plugin_id: &str) -> bool {
    !plugin_id.is_empty()
        && plugin_id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
}

fn validate_native_manifest(raw_manifest: &str) -> Result<NativePluginManifest, String> {
    let value: Value = serde_json::from_str(raw_manifest)
        .map_err(|error| format!("Manifest is not valid JSON: {error}"))?;
    let object = value
        .as_object()
        .ok_or_else(|| "Manifest must be a JSON object.".to_string())?;

    for field_name in FORBIDDEN_MANIFEST_FIELDS {
        if object.contains_key(*field_name) {
            return Err(format!("Manifest field `{field_name}` is not allowed."));
        }
    }

    let manifest_version = value
        .get("manifestVersion")
        .and_then(Value::as_u64)
        .ok_or_else(|| "manifestVersion is required.".to_string())
        .and_then(|version| {
            u32::try_from(version).map_err(|_| "manifestVersion is too large.".to_string())
        })?;
    let plugin_id = value_string(&value, "pluginId");
    let name = value_string(&value, "name");
    let version = value_string(&value, "version");
    let plugin_type = value_string(&value, "pluginType");
    let entry = value_string(&value, "entry");

    if !is_safe_plugin_id(&plugin_id) {
        return Err("pluginId is required and may only contain letters, numbers, dots, underscores, or hyphens.".to_string());
    }

    if name.is_empty() {
        return Err("name is required.".to_string());
    }

    if version.is_empty() {
        return Err("version is required.".to_string());
    }

    if plugin_type != "native" {
        return Err("pluginType must be `native`.".to_string());
    }

    if entry.is_empty() {
        return Err("entry is required.".to_string());
    }

    let capabilities = match value.get("capabilities") {
        Some(Value::Array(values)) => values
            .iter()
            .map(|capability| {
                capability
                    .as_str()
                    .ok_or_else(|| "capabilities must contain strings only.".to_string())
            })
            .collect::<Result<Vec<_>, _>>()?,
        Some(_) => return Err("capabilities must be an array.".to_string()),
        None => Vec::new(),
    };

    if let Some(invalid_capability) = capabilities
        .iter()
        .find(|capability| !ALLOWED_CAPABILITIES.contains(capability))
    {
        return Err(format!(
            "Capability `{invalid_capability}` is not in the allowed whitelist."
        ));
    }

    let abi = value
        .get("abi")
        .cloned()
        .map(serde_json::from_value::<NativePluginAbi>)
        .transpose()
        .map_err(|error| format!("abi declaration is invalid: {error}"))?;

    Ok(NativePluginManifest {
        manifest_version,
        plugin_id,
        name,
        version,
        author: value_string(&value, "author"),
        description: value_string(&value, "description"),
        plugin_type,
        platform: value
            .get("platform")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|platform| !platform.is_empty())
            .map(str::to_string),
        arch: value
            .get("arch")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|arch| !arch.is_empty())
            .map(str::to_string),
        entry,
        capabilities: capabilities.into_iter().map(str::to_string).collect(),
        enabled: value
            .get("enabled")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        abi,
    })
}

fn manifest_to_json(manifest: &NativePluginManifest) -> Result<String, String> {
    serde_json::to_string_pretty(&json!(manifest))
        .map_err(|error| format!("Failed to serialize desktop plugin manifest: {error}"))
}

#[tauri::command]
fn get_desktop_plugin_dir(app: AppHandle) -> Result<String, String> {
    Ok(plugin_root_dir(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
fn get_desktop_config_dir(app: AppHandle) -> Result<String, String> {
    Ok(config_root_dir(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
fn ensure_desktop_config_dir(app: AppHandle) -> Result<String, String> {
    Ok(ensure_config_root_dir(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
fn list_desktop_plugins(app: AppHandle) -> Result<DesktopPluginListResult, String> {
    let plugin_dir = plugin_root_dir(&app)?;
    let registry = load_registry(&plugin_dir);
    let mut plugins = Vec::new();
    let mut invalid_plugins = Vec::new();

    let entries = fs::read_dir(&plugin_dir)
        .map_err(|error| format!("Failed to scan desktop plugin directory: {error}"))?;

    for entry_result in entries {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(error) => {
                invalid_plugins.push(DesktopPluginManifestError {
                    plugin_id: None,
                    manifest_path: plugin_dir.to_string_lossy().to_string(),
                    message: format!("Failed to read plugin directory entry: {error}"),
                });
                continue;
            }
        };

        let Ok(file_type) = entry.file_type() else {
            continue;
        };

        if !file_type.is_dir() {
            continue;
        }

        let manifest_path = entry.path().join(MANIFEST_FILE_NAME);
        let plugin_id_hint = entry.file_name().to_string_lossy().to_string();
        let raw_manifest = match fs::read_to_string(&manifest_path) {
            Ok(raw_manifest) => raw_manifest,
            Err(error) => {
                invalid_plugins.push(DesktopPluginManifestError {
                    plugin_id: Some(plugin_id_hint),
                    manifest_path: manifest_path.to_string_lossy().to_string(),
                    message: format!("Failed to read manifest.json: {error}"),
                });
                continue;
            }
        };

        match validate_native_manifest(&raw_manifest) {
            Ok(mut manifest) => {
                if let Some(enabled) = registry.enabled.get(&manifest.plugin_id) {
                    manifest.enabled = *enabled;
                }
                plugins.push(manifest);
            }
            Err(message) => invalid_plugins.push(DesktopPluginManifestError {
                plugin_id: Some(plugin_id_hint),
                manifest_path: manifest_path.to_string_lossy().to_string(),
                message,
            }),
        }
    }

    plugins.sort_by(|left, right| left.plugin_id.cmp(&right.plugin_id));

    Ok(DesktopPluginListResult {
        plugin_dir: plugin_dir.to_string_lossy().to_string(),
        plugins,
        invalid_plugins,
    })
}

#[tauri::command]
fn install_desktop_plugin_manifest(
    app: AppHandle,
    raw_manifest: String,
    overwrite: bool,
) -> Result<NativePluginManifest, String> {
    let plugin_dir = plugin_root_dir(&app)?;
    let mut manifest = validate_native_manifest(&raw_manifest)?;
    manifest.enabled = false;

    let target_dir = plugin_dir.join(&manifest.plugin_id);
    if target_dir.exists() && !overwrite {
        return Err("Plugin already exists.".to_string());
    }

    fs::create_dir_all(&target_dir)
        .map_err(|error| format!("Failed to create plugin directory: {error}"))?;
    fs::write(
        target_dir.join(MANIFEST_FILE_NAME),
        manifest_to_json(&manifest)?,
    )
    .map_err(|error| format!("Failed to install manifest.json: {error}"))?;

    let mut registry = load_registry(&plugin_dir);
    registry.enabled.insert(manifest.plugin_id.clone(), false);
    save_registry(&plugin_dir, &registry)?;

    Ok(manifest)
}

#[tauri::command]
fn set_desktop_plugin_enabled(
    app: AppHandle,
    plugin_id: String,
    enabled: bool,
) -> Result<NativePluginManifest, String> {
    if !is_safe_plugin_id(&plugin_id) {
        return Err("Invalid pluginId.".to_string());
    }

    let plugin_dir = plugin_root_dir(&app)?;
    let manifest_path = plugin_dir.join(&plugin_id).join(MANIFEST_FILE_NAME);
    let raw_manifest = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("Failed to read manifest.json: {error}"))?;
    let mut manifest = validate_native_manifest(&raw_manifest)?;

    if manifest.plugin_id != plugin_id {
        return Err("Manifest pluginId does not match the plugin directory.".to_string());
    }

    let mut registry = load_registry(&plugin_dir);
    registry.enabled.insert(plugin_id, enabled);
    save_registry(&plugin_dir, &registry)?;
    manifest.enabled = enabled;

    Ok(manifest)
}

#[tauri::command]
fn uninstall_desktop_plugin(app: AppHandle, plugin_id: String) -> Result<(), String> {
    if !is_safe_plugin_id(&plugin_id) {
        return Err("Invalid pluginId.".to_string());
    }

    let plugin_dir = plugin_root_dir(&app)?;
    let target_dir = plugin_dir.join(&plugin_id);

    if target_dir.exists() {
        fs::remove_dir_all(&target_dir)
            .map_err(|error| format!("Failed to remove plugin directory: {error}"))?;
    }

    let mut registry = load_registry(&plugin_dir);
    registry.enabled.remove(&plugin_id);
    save_registry(&plugin_dir, &registry)?;

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_desktop_config_dir,
            ensure_desktop_config_dir,
            get_desktop_plugin_dir,
            list_desktop_plugins,
            install_desktop_plugin_manifest,
            set_desktop_plugin_enabled,
            uninstall_desktop_plugin
        ])
        .run(tauri::generate_context!())
        .expect("failed to run local-mindmap desktop shell");
}
