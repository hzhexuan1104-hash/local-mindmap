#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
use rfd::FileDialog;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, HashMap},
    fs,
    path::{Component, Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Manager};

const REGISTRY_FILE_NAME: &str = "desktop-plugin-registry.json";
const MANIFEST_FILE_NAME: &str = "manifest.json";
const CONFIG_DIR_NAME: &str = "config";
const LEGACY_IDENTIFIER_DIR_NAME: &str = "com.localmindmap.app";
const IDENTIFIER_MIGRATION_FLAG_PATH: &str = "config/identifier-migration-v1.6.json";
const USER_PLUGIN_REGISTRY_PATH: &str = "plugins/plugin-registry.json";
const USER_PLUGIN_INSTALLED_DIR: &str = "plugins/installed";
const USER_PLUGIN_DEV_DIR: &str = "plugins/dev";
const SAMPLE_PLUGIN_DIR_NAME: &str = "sample-json-plugin";
const SAMPLE_PLUGIN_ID: &str = "localmindmap.dev.sample-json-plugin";
const SAMPLE_PLUGIN_MANIFEST: &str =
    include_str!("../../docs/examples/sample-json-plugin/manifest.json");
const SAMPLE_PLUGIN_README: &str = include_str!("../../docs/examples/sample-json-plugin/README.md");
const USER_DATA_DIRS: &[&str] = &[
    "mindmaps",
    "autosave",
    "node-types",
    "node-types/packs",
    "templates",
    "templates/packs",
    "plugins",
    USER_PLUGIN_INSTALLED_DIR,
    USER_PLUGIN_DEV_DIR,
    CONFIG_DIR_NAME,
    "backups",
];
const ALLOWED_CAPABILITIES: &[&str] = &[
    "exportText",
    "themePack",
    "iconPack",
    "nodeTypePack",
    "toolPanel",
];
const FORBIDDEN_MANIFEST_FIELDS: &[&str] = &["code", "script", "eval", "function", "remoteUrl"];
const FORBIDDEN_DECLARATIVE_FIELDS: &[&str] = &[
    "script",
    "eval",
    "function",
    "remoteurl",
    "code",
    "shell",
    "executable",
];
const DECLARATIVE_PLUGIN_TYPES: &[&str] = &[
    "theme-pack",
    "icon-pack",
    "import-export",
    "node-type-pack",
    "template-pack",
    "tool",
];
const DECLARATIVE_PLUGIN_CAPABILITIES: &[&str] = &[
    "themes",
    "icons",
    "export",
    "nodeTypes",
    "templates",
    "tools",
];

fn user_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve user data directory: {error}"))
}

fn copy_user_data_without_overwrite(source: &Path, target: &Path) -> Result<usize, String> {
    if !source.is_dir() {
        return Ok(0);
    }

    fs::create_dir_all(target)
        .map_err(|error| format!("Failed to create identifier migration target: {error}"))?;
    let mut copied_files = 0;

    for entry in fs::read_dir(source)
        .map_err(|error| format!("Failed to read legacy user data directory: {error}"))?
    {
        let entry =
            entry.map_err(|error| format!("Failed to read legacy user data entry: {error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Failed to inspect legacy user data entry: {error}"))?;
        let target_path = target.join(entry.file_name());

        if file_type.is_symlink() {
            continue;
        }

        if file_type.is_dir() {
            if target_path.exists() && !target_path.is_dir() {
                continue;
            }
            copied_files += copy_user_data_without_overwrite(&entry.path(), &target_path)?;
        } else if file_type.is_file() && !target_path.exists() {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!("Failed to create identifier migration directory: {error}")
                })?;
            }
            fs::copy(entry.path(), &target_path)
                .map_err(|error| format!("Failed to copy legacy user data file: {error}"))?;
            copied_files += 1;
        }
    }

    Ok(copied_files)
}

fn migrate_legacy_identifier_data_at(root: &Path) -> Result<usize, String> {
    fs::create_dir_all(root)
        .map_err(|error| format!("Failed to create new user data directory: {error}"))?;
    let migration_flag = root.join(IDENTIFIER_MIGRATION_FLAG_PATH);
    if migration_flag.exists() {
        return Ok(0);
    }

    let legacy_root = root
        .parent()
        .ok_or_else(|| "User data directory has no parent for identifier migration.".to_string())?
        .join(LEGACY_IDENTIFIER_DIR_NAME);
    let legacy_data_found = legacy_root.is_dir() && legacy_root != root;
    let copied_files = if legacy_data_found {
        copy_user_data_without_overwrite(&legacy_root, root)?
    } else {
        0
    };

    if let Some(parent) = migration_flag.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create migration status directory: {error}"))?;
    }
    let status = json!({
        "completed": true,
        "migrationVersion": 1,
        "legacyIdentifier": LEGACY_IDENTIFIER_DIR_NAME,
        "legacyDataFound": legacy_data_found,
        "copiedFiles": copied_files
    });
    let raw_status = serde_json::to_string_pretty(&status)
        .map_err(|error| format!("Failed to serialize identifier migration status: {error}"))?;
    fs::write(&migration_flag, raw_status)
        .map_err(|error| format!("Failed to write identifier migration status: {error}"))?;

    Ok(copied_files)
}

fn ensure_user_data_dirs_at(root: &Path) -> Result<(), String> {
    fs::create_dir_all(root)
        .map_err(|error| format!("Failed to create user data directory: {error}"))?;

    for relative_dir in USER_DATA_DIRS {
        fs::create_dir_all(root.join(relative_dir)).map_err(|error| {
            format!("Failed to create user data subdirectory `{relative_dir}`: {error}")
        })?;
    }

    Ok(())
}

fn ensure_user_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = user_data_root(app)?;
    if let Err(error) = migrate_legacy_identifier_data_at(&root) {
        eprintln!("Legacy identifier user data migration failed: {error}");
    }
    ensure_user_data_dirs_at(&root)?;
    Ok(root)
}

fn invalid_user_path(relative_path: &str, reason: &str) -> String {
    format!("Invalid user path `{relative_path}`: {reason}")
}

fn normalized_user_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    if relative_path.trim().is_empty() {
        return Err(invalid_user_path(relative_path, "path cannot be empty."));
    }

    if relative_path.starts_with(['/', '\\']) {
        return Err(invalid_user_path(
            relative_path,
            "path must be relative to the user data directory.",
        ));
    }

    let normalized = relative_path.replace('\\', "/");
    let first_segment = normalized.split('/').next().unwrap_or_default();
    if first_segment.as_bytes().get(1) == Some(&b':') || normalized.starts_with("//") {
        return Err(invalid_user_path(
            relative_path,
            "absolute paths and Windows path prefixes are not allowed.",
        ));
    }

    let path = Path::new(&normalized);
    if path.is_absolute()
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(invalid_user_path(
            relative_path,
            "only normal relative path components are allowed; `.` and `..` are forbidden.",
        ));
    }

    Ok(path.to_path_buf())
}

fn metadata_is_link_like(metadata: &fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return true;
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
        return metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0;
    }

    #[cfg(not(target_os = "windows"))]
    false
}

fn reject_link_like_user_path_components(
    root: &Path,
    relative_path: &Path,
    input_path: &str,
) -> Result<(), String> {
    let mut current = root.to_path_buf();

    for component in relative_path.components() {
        let Component::Normal(component) = component else {
            return Err(invalid_user_path(
                input_path,
                "only normal relative path components are allowed.",
            ));
        };
        current.push(component);

        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata_is_link_like(&metadata) => {
                return Err(invalid_user_path(
                    input_path,
                    &format!(
                        "symbolic links and reparse points are not allowed below the user data directory (`{}`).",
                        current.display()
                    ),
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(invalid_user_path(
                    input_path,
                    &format!(
                        "failed to inspect user path component `{}`: {error}",
                        current.display()
                    ),
                ));
            }
        }
    }

    Ok(())
}

fn resolve_user_relative_path(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let relative_path_buf = normalized_user_relative_path(relative_path)?;
    reject_link_like_user_path_components(root, &relative_path_buf, relative_path)?;
    Ok(root.join(relative_path_buf))
}

fn read_user_json_at(
    root: &Path,
    relative_path: &str,
    default_value: Value,
) -> Result<Value, String> {
    let target = resolve_user_relative_path(root, relative_path)?;

    if !target.exists() {
        return Ok(default_value);
    }

    let raw_text = fs::read_to_string(&target)
        .map_err(|error| format!("Failed to read user JSON `{relative_path}`: {error}"))?;

    serde_json::from_str(&raw_text)
        .map_err(|error| format!("User JSON `{relative_path}` is invalid: {error}"))
}

fn write_user_json_at(root: &Path, relative_path: &str, value: &Value) -> Result<(), String> {
    let target = resolve_user_relative_path(root, relative_path)?;
    let parent = target
        .parent()
        .ok_or_else(|| invalid_user_path(relative_path, "JSON path has no parent directory."))?;
    fs::create_dir_all(parent).map_err(|error| {
        format!("Failed to create user JSON directory `{relative_path}`: {error}")
    })?;
    resolve_user_relative_path(root, relative_path)?;

    let raw_text = serde_json::to_string_pretty(value)
        .map_err(|error| format!("Failed to serialize user JSON `{relative_path}`: {error}"))?;

    fs::write(&target, raw_text)
        .map_err(|error| format!("Failed to write user JSON `{relative_path}`: {error}"))
}

fn write_local_file_at(path: &Path, bytes: &[u8]) -> Result<String, String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Selected file path has no parent directory.".to_string())?;
    if !parent.is_dir() {
        return Err(format!(
            "Selected file directory does not exist: {}",
            parent.display()
        ));
    }
    fs::write(path, bytes)
        .map_err(|error| format!("Failed to write `{}`: {error}", path.display()))?;
    Ok(path.to_string_lossy().to_string())
}

fn contains_forbidden_declarative_field(value: &Value) -> Option<String> {
    match value {
        Value::Object(object) => {
            for (key, child) in object {
                if FORBIDDEN_DECLARATIVE_FIELDS.contains(&key.to_ascii_lowercase().as_str()) {
                    return Some(key.clone());
                }

                if let Some(field) = contains_forbidden_declarative_field(child) {
                    return Some(field);
                }
            }
            None
        }
        Value::Array(values) => values.iter().find_map(contains_forbidden_declarative_field),
        _ => None,
    }
}

fn validate_declarative_manifest(plugin_id: &str, manifest: &Value) -> Result<(), String> {
    if !is_safe_plugin_id(plugin_id) {
        return Err("Invalid pluginId.".to_string());
    }

    let object = manifest
        .as_object()
        .ok_or_else(|| "Plugin manifest must be a JSON object.".to_string())?;

    if let Some(field) = contains_forbidden_declarative_field(manifest) {
        return Err(format!("插件包含非法字段：{field}"));
    }

    let manifest_plugin_id = object
        .get("pluginId")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if manifest_plugin_id.trim().is_empty() {
        return Err("缺少必填字段：pluginId".to_string());
    }
    if manifest_plugin_id != plugin_id {
        return Err("manifest pluginId 与安装目标不一致。".to_string());
    }

    if object
        .get("manifestVersion")
        .and_then(Value::as_u64)
        .filter(|version| *version == 1)
        .is_none()
    {
        let value = object
            .get("manifestVersion")
            .map(Value::to_string)
            .unwrap_or_else(|| "missing".to_string());
        return Err(format!("manifestVersion 不支持：{value}。当前仅支持 1。"));
    }

    for required_field in ["name", "version", "pluginType"] {
        if object
            .get(required_field)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .is_none()
        {
            return Err(format!("缺少必填字段：{required_field}"));
        }
    }

    let plugin_type = object
        .get("pluginType")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if !DECLARATIVE_PLUGIN_TYPES.contains(&plugin_type) {
        return Err(format!(
            "pluginType 不受支持：{plugin_type}。支持的类型：{}",
            DECLARATIVE_PLUGIN_TYPES.join(", ")
        ));
    }

    match object.get("capabilities") {
        Some(Value::Array(capabilities))
            if capabilities
                .iter()
                .all(|capability| capability.as_str().is_some_and(|value| !value.is_empty())) =>
        {
            for capability in capabilities {
                let capability = capability.as_str().unwrap_or_default();
                if !DECLARATIVE_PLUGIN_CAPABILITIES.contains(&capability) {
                    return Err(format!(
                        "capabilities 包含不受支持的值：{capability}。支持的 capabilities：{}",
                        DECLARATIVE_PLUGIN_CAPABILITIES.join(", ")
                    ));
                }
            }
        }
        _ => return Err("capabilities 必须是数组。".to_string()),
    }

    if let Some(contributions) = object.get("contributions") {
        validate_builtin_handlers(contributions)?;
        validate_menu_command_shape(contributions)?;
    }

    Ok(())
}

fn validate_menu_command_shape(contributions: &Value) -> Result<(), String> {
    let Some(menus) = contributions.get("menus") else {
        return Ok(());
    };
    let menus = menus
        .as_array()
        .ok_or_else(|| "contributions.menus must be an array.".to_string())?;
    for menu in menus {
        let Some(menu) = menu.as_object() else {
            continue;
        };
        if menu
            .get("command")
            .is_some_and(|command| !command.is_string())
        {
            return Err("Plugin menu command must be a string.".to_string());
        }
    }
    Ok(())
}

fn validate_builtin_handlers(value: &Value) -> Result<(), String> {
    match value {
        Value::Object(object) => {
            for (key, child) in object {
                if key == "handler" || key == "handlerId" {
                    let handler = child.as_str().ok_or_else(|| {
                        "Plugin contribution handler must be a string.".to_string()
                    })?;
                    if !handler.starts_with("builtin.") {
                        return Err(
                            "Plugin contribution handlers must use the `builtin.` prefix."
                                .to_string(),
                        );
                    }
                }
                validate_builtin_handlers(child)?;
            }
        }
        Value::Array(values) => {
            for child in values {
                validate_builtin_handlers(child)?;
            }
        }
        _ => {}
    }

    Ok(())
}

fn plugin_registry_contains(registry: &Value, plugin_id: &str) -> Result<bool, String> {
    let plugins = registry
        .as_array()
        .ok_or_else(|| "Plugin registry must be a JSON array.".to_string())?;
    Ok(plugins.iter().any(|plugin| {
        plugin
            .get("pluginId")
            .and_then(Value::as_str)
            .is_some_and(|current_id| current_id == plugin_id)
    }))
}

fn upsert_plugin_registry(
    registry: &Value,
    plugin_id: &str,
    manifest: &Value,
) -> Result<Value, String> {
    let mut plugins = registry
        .as_array()
        .cloned()
        .ok_or_else(|| "Plugin registry must be a JSON array.".to_string())?;
    plugins.retain(|plugin| {
        plugin
            .get("pluginId")
            .and_then(Value::as_str)
            .map(|current_id| current_id != plugin_id)
            .unwrap_or(true)
    });
    plugins.push(manifest.clone());
    Ok(Value::Array(plugins))
}

fn remove_path_if_exists(path: &Path) -> Result<(), String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!(
                "Failed to inspect plugin installation path `{}`: {error}",
                path.display()
            ))
        }
    };

    if metadata.is_dir() {
        fs::remove_dir_all(path).map_err(|error| {
            format!(
                "Failed to remove plugin installation directory `{}`: {error}",
                path.display()
            )
        })
    } else {
        fs::remove_file(path).map_err(|error| {
            format!(
                "Failed to remove plugin installation file `{}`: {error}",
                path.display()
            )
        })
    }
}

fn restore_plugin_registry_after_failed_install(
    root: &Path,
    registry_existed: bool,
    original_registry: &Value,
) -> Result<(), String> {
    if registry_existed {
        write_user_json_at(root, USER_PLUGIN_REGISTRY_PATH, original_registry)
    } else {
        let registry_path = resolve_user_relative_path(root, USER_PLUGIN_REGISTRY_PATH)?;
        if registry_path.exists() {
            fs::remove_file(&registry_path).map_err(|error| {
                format!("Failed to remove newly created plugin registry during rollback: {error}")
            })?;
        }
        Ok(())
    }
}

fn install_plugin_to_user_dir_at_with_writer<F>(
    root: &Path,
    plugin_id: &str,
    manifest: &Value,
    overwrite: bool,
    mut write_json: F,
) -> Result<(), String>
where
    F: FnMut(&Path, &str, &Value) -> Result<(), String>,
{
    validate_declarative_manifest(plugin_id, manifest)
        .map_err(|error| format!("插件 manifest 校验失败：{error}"))?;

    let relative_plugin_dir = format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}");
    let relative_manifest_path = format!("{relative_plugin_dir}/{MANIFEST_FILE_NAME}");
    let relative_staging_dir = format!("{USER_PLUGIN_INSTALLED_DIR}/.{plugin_id}.installing");
    let relative_staging_manifest = format!("{relative_staging_dir}/{MANIFEST_FILE_NAME}");
    let relative_backup_dir = format!("{USER_PLUGIN_INSTALLED_DIR}/.{plugin_id}.backup");

    let target_dir = resolve_user_relative_path(root, &relative_plugin_dir)?;
    let target_manifest = resolve_user_relative_path(root, &relative_manifest_path)?;
    let staging_dir = resolve_user_relative_path(root, &relative_staging_dir)?;
    let backup_dir = resolve_user_relative_path(root, &relative_backup_dir)?;
    let registry_path = resolve_user_relative_path(root, USER_PLUGIN_REGISTRY_PATH)?;
    let registry_existed = registry_path.is_file();
    let original_registry =
        read_user_json_at(root, USER_PLUGIN_REGISTRY_PATH, Value::Array(vec![]))
            .map_err(|error| format!("插件 registry 读取失败：{error}"))?;
    let registry_has_plugin = plugin_registry_contains(&original_registry, plugin_id)?;
    let manifest_exists = target_manifest.is_file();

    if target_dir.exists() && registry_has_plugin && manifest_exists && !overwrite {
        return Err(format!("插件已安装：{plugin_id}"));
    }

    if target_dir.exists() && (!registry_has_plugin || !manifest_exists) {
        remove_path_if_exists(&target_dir)
            .map_err(|error| format!("插件安装记录不完整，自动清理失败（{plugin_id}）：{error}"))?;
    }

    remove_path_if_exists(&staging_dir)
        .map_err(|error| format!("插件安装临时目录清理失败：{error}"))?;
    remove_path_if_exists(&backup_dir)
        .map_err(|error| format!("插件安装备份目录清理失败：{error}"))?;
    fs::create_dir_all(&staging_dir).map_err(|error| format!("插件安装目录创建失败：{error}"))?;

    if let Err(error) = write_json(root, &relative_staging_manifest, manifest) {
        let cleanup_error = remove_path_if_exists(&staging_dir).err();
        return Err(format!(
            "插件 manifest 写入失败：{error}{}",
            cleanup_error
                .map(|cleanup| format!("；临时目录回滚失败：{cleanup}"))
                .unwrap_or_default()
        ));
    }

    let had_previous_install = target_dir.exists();
    if had_previous_install {
        fs::rename(&target_dir, &backup_dir)
            .map_err(|error| format!("插件旧版本备份失败：{error}"))?;
    }

    if let Err(error) = fs::rename(&staging_dir, &target_dir) {
        if had_previous_install {
            let _ = fs::rename(&backup_dir, &target_dir);
        }
        let _ = remove_path_if_exists(&staging_dir);
        return Err(format!("插件安装目录提交失败：{error}"));
    }

    let next_registry = upsert_plugin_registry(&original_registry, plugin_id, manifest)?;
    if let Err(error) = write_json(root, USER_PLUGIN_REGISTRY_PATH, &next_registry) {
        let mut rollback_errors = Vec::new();
        if let Err(rollback_error) = remove_path_if_exists(&target_dir) {
            rollback_errors.push(rollback_error);
        }
        if had_previous_install {
            if let Err(rollback_error) = fs::rename(&backup_dir, &target_dir) {
                rollback_errors.push(format!(
                    "Failed to restore previous plugin installation: {rollback_error}"
                ));
            }
        }
        if let Err(rollback_error) =
            restore_plugin_registry_after_failed_install(root, registry_existed, &original_registry)
        {
            rollback_errors.push(rollback_error);
        }
        return Err(format!(
            "插件 registry 写入失败：{error}{}",
            if rollback_errors.is_empty() {
                "；已回滚 installed 目录".to_string()
            } else {
                format!("；回滚异常：{}", rollback_errors.join("；"))
            }
        ));
    }

    if had_previous_install {
        remove_path_if_exists(&backup_dir)
            .map_err(|error| format!("插件安装成功，但旧版本备份清理失败：{error}"))?;
    }

    Ok(())
}

fn install_plugin_to_user_dir_at(
    root: &Path,
    plugin_id: &str,
    manifest: &Value,
    overwrite: bool,
) -> Result<(), String> {
    install_plugin_to_user_dir_at_with_writer(
        root,
        plugin_id,
        manifest,
        overwrite,
        write_user_json_at,
    )
}

fn remove_plugin_from_registry_at(root: &Path, plugin_id: &str) -> Result<(), String> {
    let registry_path = resolve_user_relative_path(root, USER_PLUGIN_REGISTRY_PATH)?;
    if !registry_path.exists() {
        return Ok(());
    }

    let mut registry = read_user_json_at(root, USER_PLUGIN_REGISTRY_PATH, Value::Array(vec![]))?;
    if let Value::Array(plugins) = &mut registry {
        plugins.retain(|plugin| {
            plugin
                .get("pluginId")
                .and_then(Value::as_str)
                .map(|current_id| current_id != plugin_id)
                .unwrap_or(true)
        });
        write_user_json_at(root, USER_PLUGIN_REGISTRY_PATH, &registry)?;
    }

    Ok(())
}

#[tauri::command]
fn get_user_data_dir(app: AppHandle) -> Result<String, String> {
    Ok(ensure_user_data_root(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
fn ensure_user_data_dirs(app: AppHandle) -> Result<String, String> {
    Ok(ensure_user_data_root(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
fn read_user_json(
    app: AppHandle,
    relative_path: String,
    default_value: Value,
) -> Result<Value, String> {
    let root = ensure_user_data_root(&app)?;
    read_user_json_at(&root, &relative_path, default_value)
}

#[tauri::command]
fn write_user_json(app: AppHandle, relative_path: String, value: Value) -> Result<(), String> {
    let root = ensure_user_data_root(&app)?;
    write_user_json_at(&root, &relative_path, &value)
}

#[tauri::command]
fn list_user_files(app: AppHandle, relative_dir: String) -> Result<Vec<String>, String> {
    let root = ensure_user_data_root(&app)?;
    let mut directory = resolve_user_relative_path(&root, &relative_dir)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Failed to create user directory `{relative_dir}`: {error}"))?;
    directory = resolve_user_relative_path(&root, &relative_dir)?;
    let mut files = Vec::new();

    for entry in fs::read_dir(&directory)
        .map_err(|error| format!("Failed to list user directory `{relative_dir}`: {error}"))?
    {
        let entry =
            entry.map_err(|error| format!("Failed to read user directory entry: {error}"))?;
        if entry
            .file_type()
            .map_err(|error| format!("Failed to inspect user directory entry: {error}"))?
            .is_file()
        {
            files.push(
                Path::new(&relative_dir)
                    .join(entry.file_name())
                    .to_string_lossy()
                    .replace('\\', "/"),
            );
        }
    }

    files.sort();
    Ok(files)
}

#[tauri::command]
fn install_plugin_to_user_dir(
    app: AppHandle,
    plugin_id: String,
    manifest: Value,
    overwrite: bool,
) -> Result<(), String> {
    let root = ensure_user_data_root(&app)?;
    install_plugin_to_user_dir_at(&root, &plugin_id, &manifest, overwrite)
}

#[tauri::command]
fn uninstall_plugin_from_user_dir(app: AppHandle, plugin_id: String) -> Result<(), String> {
    if !is_safe_plugin_id(&plugin_id) {
        return Err("Invalid pluginId.".to_string());
    }

    let root = ensure_user_data_root(&app)?;
    let target_dir =
        resolve_user_relative_path(&root, &format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}"))?;
    if target_dir.exists() {
        fs::remove_dir_all(&target_dir)
            .map_err(|error| format!("Failed to remove installed plugin: {error}"))?;
    }
    remove_plugin_from_registry_at(&root, &plugin_id)
}

#[tauri::command]
fn open_user_data_dir(app: AppHandle) -> Result<(), String> {
    let root = ensure_user_data_root(&app)?;

    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer");
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = Command::new("xdg-open");

    command
        .arg(&root)
        .spawn()
        .map_err(|error| format!("Failed to open user data directory: {error}"))?;
    Ok(())
}

#[tauri::command]
fn open_plugin_dir(app: AppHandle) -> Result<(), String> {
    let root = ensure_user_data_root(&app)?;
    let plugin_dir = plugin_dir_at(&root)?;
    fs::create_dir_all(&plugin_dir)
        .map_err(|error| format!("Failed to create plugin directory: {error}"))?;

    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer");
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = Command::new("xdg-open");

    command
        .arg(&plugin_dir)
        .spawn()
        .map_err(|error| format!("Failed to open plugin directory: {error}"))?;
    Ok(())
}

fn plugin_dir_at(root: &Path) -> Result<PathBuf, String> {
    resolve_user_relative_path(root, "plugins")
}

fn plugin_dev_dir_at(root: &Path) -> Result<PathBuf, String> {
    resolve_user_relative_path(root, USER_PLUGIN_DEV_DIR)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SamplePluginCreationResult {
    created: bool,
    directory_path: String,
    manifest_path: String,
    readme_path: String,
}

fn sample_plugin_creation_result(root: &Path, created: bool) -> SamplePluginCreationResult {
    let directory = root.join(USER_PLUGIN_DEV_DIR).join(SAMPLE_PLUGIN_DIR_NAME);
    SamplePluginCreationResult {
        created,
        directory_path: directory.to_string_lossy().to_string(),
        manifest_path: directory
            .join(MANIFEST_FILE_NAME)
            .to_string_lossy()
            .to_string(),
        readme_path: directory.join("README.md").to_string_lossy().to_string(),
    }
}

fn create_sample_plugin_at(root: &Path) -> Result<SamplePluginCreationResult, String> {
    let manifest: Value = serde_json::from_str(SAMPLE_PLUGIN_MANIFEST)
        .map_err(|error| format!("Bundled sample plugin manifest is invalid: {error}"))?;
    validate_declarative_manifest(SAMPLE_PLUGIN_ID, &manifest)
        .map_err(|error| format!("Bundled sample plugin validation failed: {error}"))?;

    let dev_dir = plugin_dev_dir_at(root)?;
    fs::create_dir_all(&dev_dir)
        .map_err(|error| format!("Failed to create plugin development directory: {error}"))?;
    let target_dir = dev_dir.join(SAMPLE_PLUGIN_DIR_NAME);
    if target_dir.exists() {
        return Ok(sample_plugin_creation_result(root, false));
    }

    let staging_dir = dev_dir.join(format!(".{SAMPLE_PLUGIN_DIR_NAME}.creating"));
    remove_path_if_exists(&staging_dir)?;
    fs::create_dir_all(&staging_dir)
        .map_err(|error| format!("Failed to create sample plugin staging directory: {error}"))?;

    let write_result = (|| {
        fs::write(staging_dir.join(MANIFEST_FILE_NAME), SAMPLE_PLUGIN_MANIFEST)
            .map_err(|error| format!("Failed to write sample plugin manifest: {error}"))?;
        fs::write(staging_dir.join("README.md"), SAMPLE_PLUGIN_README)
            .map_err(|error| format!("Failed to write sample plugin README: {error}"))?;
        fs::rename(&staging_dir, &target_dir)
            .map_err(|error| format!("Failed to commit sample plugin directory: {error}"))
    })();

    if let Err(error) = write_result {
        let _ = remove_path_if_exists(&staging_dir);
        return Err(error);
    }

    Ok(sample_plugin_creation_result(root, true))
}

#[tauri::command]
fn open_plugin_dev_dir(app: AppHandle) -> Result<(), String> {
    let root = ensure_user_data_root(&app)?;
    let dev_dir = plugin_dev_dir_at(&root)?;
    fs::create_dir_all(&dev_dir)
        .map_err(|error| format!("Failed to create plugin development directory: {error}"))?;

    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer");
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = Command::new("xdg-open");

    command
        .arg(&dev_dir)
        .spawn()
        .map_err(|error| format!("Failed to open plugin development directory: {error}"))?;
    Ok(())
}

#[tauri::command]
fn create_sample_plugin(app: AppHandle) -> Result<SamplePluginCreationResult, String> {
    let root = ensure_user_data_root(&app)?;
    create_sample_plugin_at(&root)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstalledPluginScanEntry {
    plugin_id_hint: String,
    manifest_path: String,
    manifest: Option<Value>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PluginDiskSnapshot {
    registry: Value,
    installed_manifests: Vec<InstalledPluginScanEntry>,
}

fn scan_installed_plugin_manifests_at(
    root: &Path,
    expected_plugin_ids: &[String],
) -> Result<Vec<InstalledPluginScanEntry>, String> {
    let installed_dir = resolve_user_relative_path(root, USER_PLUGIN_INSTALLED_DIR)?;
    fs::create_dir_all(&installed_dir)
        .map_err(|error| format!("Failed to create installed plugin directory: {error}"))?;
    let mut results = Vec::new();

    for entry in fs::read_dir(&installed_dir)
        .map_err(|error| format!("Failed to scan installed plugin directory: {error}"))?
    {
        let entry =
            entry.map_err(|error| format!("Failed to read installed plugin entry: {error}"))?;
        if !entry
            .file_type()
            .map_err(|error| format!("Failed to inspect installed plugin entry: {error}"))?
            .is_dir()
        {
            continue;
        }

        let plugin_id_hint = entry.file_name().to_string_lossy().to_string();
        if plugin_id_hint.starts_with('.') {
            continue;
        }
        let relative_manifest_path =
            format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id_hint}/{MANIFEST_FILE_NAME}");
        let manifest_path = entry.path().join(MANIFEST_FILE_NAME);
        if !manifest_path.is_file() {
            results.push(InstalledPluginScanEntry {
                plugin_id_hint,
                manifest_path: relative_manifest_path,
                manifest: None,
                error: Some("manifest.json 缺失。".to_string()),
            });
            continue;
        }

        let raw_manifest = match fs::read_to_string(&manifest_path) {
            Ok(value) => value,
            Err(error) => {
                results.push(InstalledPluginScanEntry {
                    plugin_id_hint,
                    manifest_path: relative_manifest_path,
                    manifest: None,
                    error: Some(format!("manifest 读取失败：{error}")),
                });
                continue;
            }
        };
        match serde_json::from_str::<Value>(&raw_manifest) {
            Ok(manifest) => results.push(InstalledPluginScanEntry {
                plugin_id_hint,
                manifest_path: relative_manifest_path,
                manifest: Some(manifest),
                error: None,
            }),
            Err(error) => results.push(InstalledPluginScanEntry {
                plugin_id_hint,
                manifest_path: relative_manifest_path,
                manifest: None,
                error: Some(format!(
                    "manifest JSON 损坏：第 {} 行第 {} 列附近：{}",
                    error.line(),
                    error.column(),
                    error
                )),
            }),
        }
    }

    for plugin_id in expected_plugin_ids {
        if !is_safe_plugin_id(plugin_id)
            || results
                .iter()
                .any(|entry| entry.plugin_id_hint == *plugin_id)
        {
            continue;
        }
        results.push(InstalledPluginScanEntry {
            plugin_id_hint: plugin_id.clone(),
            manifest_path: format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}/{MANIFEST_FILE_NAME}"),
            manifest: None,
            error: Some("manifest.json 缺失。".to_string()),
        });
    }

    results.sort_by(|left, right| left.plugin_id_hint.cmp(&right.plugin_id_hint));
    Ok(results)
}

#[tauri::command]
fn scan_installed_plugin_manifests(
    app: AppHandle,
    plugin_ids: Option<Vec<String>>,
) -> Result<Vec<InstalledPluginScanEntry>, String> {
    let root = ensure_user_data_root(&app)?;
    scan_installed_plugin_manifests_at(&root, plugin_ids.as_deref().unwrap_or(&[]))
}

fn reload_plugins_from_disk_at(root: &Path) -> Result<PluginDiskSnapshot, String> {
    let registry = read_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, Value::Array(vec![]))?;
    let plugin_ids = registry
        .as_array()
        .map(|plugins| {
            plugins
                .iter()
                .filter(|plugin| {
                    !plugin
                        .get("builtIn")
                        .and_then(Value::as_bool)
                        .unwrap_or(false)
                })
                .filter_map(|plugin| {
                    plugin
                        .get("pluginId")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let installed_manifests = scan_installed_plugin_manifests_at(&root, &plugin_ids)?;
    Ok(PluginDiskSnapshot {
        registry,
        installed_manifests,
    })
}

#[tauri::command]
fn reload_plugins_from_disk(app: AppHandle) -> Result<PluginDiskSnapshot, String> {
    let root = ensure_user_data_root(&app)?;
    reload_plugins_from_disk_at(&root)
}

#[tauri::command]
fn open_plugin_manifest_dir(app: AppHandle, plugin_id: String) -> Result<(), String> {
    if !is_safe_plugin_id(&plugin_id) {
        return Err("Invalid pluginId.".to_string());
    }
    let root = ensure_user_data_root(&app)?;
    let plugin_dir =
        resolve_user_relative_path(&root, &format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}"))?;
    if !plugin_dir.is_dir() {
        return Err(format!("插件目录不存在：{plugin_id}"));
    }

    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer");
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = Command::new("xdg-open");

    command
        .arg(&plugin_dir)
        .spawn()
        .map_err(|error| format!("Failed to open plugin manifest directory: {error}"))?;
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenedLocalFile {
    path: String,
    file_name: String,
    bytes: Vec<u8>,
}

#[tauri::command]
fn save_local_file_with_dialog(
    default_file_name: String,
    filter_name: String,
    extensions: Vec<String>,
    bytes: Vec<u8>,
) -> Result<Option<String>, String> {
    let mut dialog = FileDialog::new()
        .set_title("Save file")
        .set_file_name(default_file_name);
    if !extensions.is_empty() {
        dialog = dialog.add_filter(filter_name, &extensions);
    }
    let Some(path) = dialog.save_file() else {
        return Ok(None);
    };
    write_local_file_at(&path, &bytes).map(Some)
}

#[tauri::command]
fn write_local_file(path: String, bytes: Vec<u8>) -> Result<String, String> {
    write_local_file_at(Path::new(&path), &bytes)
}

#[tauri::command]
fn read_local_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|error| format!("Failed to read `{path}`: {error}"))
}

#[tauri::command]
fn open_local_file_with_dialog(
    filter_name: String,
    extensions: Vec<String>,
) -> Result<Option<OpenedLocalFile>, String> {
    let mut dialog = FileDialog::new().set_title("Open file");
    if !extensions.is_empty() {
        dialog = dialog.add_filter(filter_name, &extensions);
    }
    let Some(path) = dialog.pick_file() else {
        return Ok(None);
    };
    let bytes =
        fs::read(&path).map_err(|error| format!("Failed to read `{}`: {error}", path.display()))?;
    let file_name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());
    Ok(Some(OpenedLocalFile {
        path: path.to_string_lossy().to_string(),
        file_name,
        bytes,
    }))
}

#[tauri::command]
fn open_file_location(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(format!("File does not exist: {}", target.display()));
    }

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer");
        command.arg("/select,").arg(&target);
        command
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg("-R").arg(&target);
        command
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let parent = target
            .parent()
            .ok_or_else(|| "File path has no parent directory.".to_string())?;
        let mut command = Command::new("xdg-open");
        command.arg(parent);
        command
    };

    command
        .spawn()
        .map_err(|error| format!("Failed to open file location: {error}"))?;
    Ok(())
}

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
            get_user_data_dir,
            ensure_user_data_dirs,
            read_user_json,
            write_user_json,
            list_user_files,
            install_plugin_to_user_dir,
            uninstall_plugin_from_user_dir,
            open_user_data_dir,
            open_plugin_dir,
            open_plugin_dev_dir,
            create_sample_plugin,
            open_plugin_manifest_dir,
            scan_installed_plugin_manifests,
            reload_plugins_from_disk,
            save_local_file_with_dialog,
            write_local_file,
            read_local_file,
            open_local_file_with_dialog,
            open_file_location,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_root(name: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("local-mindmap-{name}-{suffix}"))
    }

    fn test_declarative_plugin(plugin_id: &str) -> Value {
        json!({
            "manifestVersion": 1,
            "pluginId": plugin_id,
            "name": "Path fix test plugin",
            "version": "1.0.0",
            "author": "Local Mindmap Test",
            "description": "Tests transactional plugin installation.",
            "pluginType": "import-export",
            "capabilities": ["export"],
            "enabled": true
        })
    }

    #[test]
    fn ensures_expected_user_directories() {
        let root = test_root("directories");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");

        for relative_dir in USER_DATA_DIRS {
            assert!(
                root.join(relative_dir).is_dir(),
                "{relative_dir} is missing"
            );
        }

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn migrates_legacy_identifier_assets_without_overwriting_new_data() {
        let base = test_root("identifier-migration");
        let legacy_root = base.join(LEGACY_IDENTIFIER_DIR_NAME);
        let new_root = base.join("com.localmindmap.desktop");
        let fixtures = [
            (
                "node-types/custom-node-types.json",
                json!([{ "id": "legacy-node-type", "name": "Legacy node type" }]),
            ),
            (
                "templates/custom-templates.json",
                json!([{ "id": "legacy-template", "name": "Legacy template" }]),
            ),
            (
                USER_PLUGIN_REGISTRY_PATH,
                json!([{ "pluginId": "legacy.plugin", "enabled": false }]),
            ),
            (
                "plugins/installed/legacy.plugin/manifest.json",
                json!({
                    "manifestVersion": 1,
                    "pluginId": "legacy.plugin",
                    "name": "Legacy plugin"
                }),
            ),
        ];

        for (relative_path, value) in &fixtures {
            let target = legacy_root.join(relative_path);
            fs::create_dir_all(target.parent().expect("fixture path should have a parent"))
                .expect("legacy fixture directory should be created");
            fs::write(
                target,
                serde_json::to_string_pretty(value).expect("fixture should serialize"),
            )
            .expect("legacy fixture should be written");
        }

        let preserved_path = new_root.join("config/app-settings.json");
        fs::create_dir_all(
            preserved_path
                .parent()
                .expect("preserved path should have a parent"),
        )
        .expect("new config directory should be created");
        fs::write(&preserved_path, r#"{"source":"new-identifier"}"#)
            .expect("new identifier fixture should be written");
        let legacy_preserved_path = legacy_root.join("config/app-settings.json");
        fs::create_dir_all(
            legacy_preserved_path
                .parent()
                .expect("legacy config path should have a parent"),
        )
        .expect("legacy config directory should be created");
        fs::write(&legacy_preserved_path, r#"{"source":"legacy-identifier"}"#)
            .expect("legacy config fixture should be written");

        let copied_files = migrate_legacy_identifier_data_at(&new_root)
            .expect("legacy identifier data should migrate");
        ensure_user_data_dirs_at(&new_root).expect("new user directories should be complete");

        assert_eq!(copied_files, fixtures.len());
        for (relative_path, value) in &fixtures {
            let migrated = fs::read_to_string(new_root.join(relative_path))
                .expect("migrated fixture should be readable");
            assert_eq!(
                serde_json::from_str::<Value>(&migrated)
                    .expect("migrated fixture should remain valid JSON"),
                *value
            );
        }
        assert_eq!(
            fs::read_to_string(&preserved_path).expect("preserved file should be readable"),
            r#"{"source":"new-identifier"}"#
        );
        assert!(new_root.join(IDENTIFIER_MIGRATION_FLAG_PATH).is_file());
        assert_eq!(
            migrate_legacy_identifier_data_at(&new_root)
                .expect("completed migration should be idempotent"),
            0
        );

        fs::remove_dir_all(base).expect("test directory should be removable");
    }

    #[test]
    fn missing_user_json_returns_default_value() {
        let root = test_root("missing-json");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let default_value = json!({ "items": [] });

        let result = read_user_json_at(&root, "config/missing.json", default_value.clone())
            .expect("missing JSON should not fail");

        assert_eq!(result, default_value);
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn writes_and_reads_user_json() {
        let root = test_root("roundtrip");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let value = json!({ "theme": "default-blue", "enabled": true });

        write_user_json_at(&root, "config/app-settings.json", &value)
            .expect("JSON should be written");
        let result = read_user_json_at(&root, "config/app-settings.json", Value::Null)
            .expect("JSON should be read");

        assert_eq!(result, value);
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn writes_user_selected_local_file_and_returns_full_path() {
        let root = test_root("selected-local-file");
        fs::create_dir_all(&root).expect("test directory should be created");
        let target = root.join("竞赛方案.lmind");

        let written_path = write_local_file_at(&target, br#"{"version":"1.0"}"#)
            .expect("selected file should be written");

        assert_eq!(written_path, target.to_string_lossy());
        assert_eq!(
            fs::read_to_string(&target).expect("selected file should be readable"),
            r#"{"version":"1.0"}"#
        );
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn writes_all_supported_user_json_paths() {
        let root = test_root("supported-json-paths");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let value = json!({ "persisted": true });
        let supported_paths = [
            "node-types/custom-node-types.json",
            "templates/custom-templates.json",
            "plugins/plugin-registry.json",
            "plugins/installed/plugin-id/manifest.json",
            "config/recent-files.json",
        ];

        for relative_path in supported_paths {
            write_user_json_at(&root, relative_path, &value)
                .unwrap_or_else(|error| panic!("{relative_path} should be writable: {error}"));
            assert_eq!(
                read_user_json_at(&root, relative_path, Value::Null)
                    .unwrap_or_else(|error| panic!("{relative_path} should be readable: {error}")),
                value
            );
        }

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn creates_missing_user_json_file_and_parent_directories() {
        let root = test_root("missing-json-parent");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let relative_path = "config/nested/missing/recent-files.json";
        let value = json!(["C:/maps/example.lmind"]);

        assert!(!root.join(relative_path).exists());
        write_user_json_at(&root, relative_path, &value)
            .expect("missing file and parent directories should be created");
        assert!(root.join(relative_path).is_file());

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn creates_missing_user_json_file_when_parent_exists() {
        let root = test_root("missing-json-file");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let relative_path = "node-types/custom-node-types.json";

        assert!(root.join("node-types").is_dir());
        assert!(!root.join(relative_path).exists());
        write_user_json_at(&root, relative_path, &json!([]))
            .expect("missing file should be created below an existing parent");
        assert!(root.join(relative_path).is_file());

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn resolves_new_nested_plugin_manifest_path_inside_user_root() {
        let root = test_root("plugin-path");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let plugin_dir = resolve_user_relative_path(
            &root,
            "plugins/installed/localmindmap.test.persistence.theme",
        )
        .expect("new plugin directory should stay inside the user root");
        fs::create_dir_all(&plugin_dir).expect("plugin directory should be created");

        let manifest_path = resolve_user_relative_path(
            &root,
            "plugins/installed/localmindmap.test.persistence.theme/manifest.json",
        )
        .expect("manifest path should stay inside the user root");

        assert_eq!(
            manifest_path,
            root.join("plugins/installed/localmindmap.test.persistence.theme/manifest.json")
        );
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn resolves_plugin_directory_inside_user_root() {
        let root = test_root("open-plugin-dir");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");

        assert_eq!(
            plugin_dir_at(&root).expect("plugin directory should resolve"),
            root.join("plugins")
        );

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn creates_valid_sample_plugin_without_overwriting_existing_files() {
        let root = test_root("sample-plugin");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");

        let created =
            create_sample_plugin_at(&root).expect("sample plugin creation should succeed");
        assert!(created.created);
        let manifest_path = PathBuf::from(&created.manifest_path);
        let readme_path = PathBuf::from(&created.readme_path);
        assert!(manifest_path.is_file());
        assert!(readme_path.is_file());

        let manifest: Value = serde_json::from_str(
            &fs::read_to_string(&manifest_path).expect("sample manifest should be readable"),
        )
        .expect("sample manifest should be JSON");
        validate_declarative_manifest(SAMPLE_PLUGIN_ID, &manifest)
            .expect("sample manifest should satisfy the v1.7 schema");
        assert_eq!(manifest["pluginId"], SAMPLE_PLUGIN_ID);
        assert_eq!(
            manifest["contributions"]["menus"][0]["command"],
            "builtin.exportText"
        );

        fs::write(&readme_path, "user-owned content")
            .expect("test should replace README with user content");
        let existing = create_sample_plugin_at(&root).expect("existing sample should be reported");
        assert!(!existing.created);
        assert_eq!(
            fs::read_to_string(&readme_path).expect("README should remain readable"),
            "user-owned content"
        );

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn codex_localcache_alias_does_not_affect_lexical_user_path_resolution() {
        let roaming_root = PathBuf::from(r"C:\Users\Test\AppData\Roaming\com.localmindmap.desktop");
        let local_cache_alias = PathBuf::from(
            r"C:\Users\Test\AppData\Local\Packages\OpenAI.Codex_test\LocalCache\Roaming\com.localmindmap.desktop",
        );

        let node_types =
            resolve_user_relative_path(&roaming_root, "node-types/custom-node-types.json")
                .expect("Roaming path should be resolved lexically");
        let templates =
            resolve_user_relative_path(&roaming_root, "templates/custom-templates.json")
                .expect("template path should be resolved lexically");

        assert_eq!(
            node_types,
            roaming_root.join("node-types/custom-node-types.json")
        );
        assert_eq!(
            templates,
            roaming_root.join("templates/custom-templates.json")
        );
        assert!(!node_types.starts_with(&local_cache_alias));
    }

    #[test]
    fn rejects_path_traversal_and_absolute_paths() {
        let root = test_root("traversal");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");

        for unsafe_path in [
            "/node-types/custom-node-types.json",
            r"\node-types\custom-node-types.json",
            "../evil.json",
            "node-types/../../evil.json",
            r"C:\temp\evil.json",
        ] {
            let error = write_user_json_at(&root, unsafe_path, &Value::Null)
                .expect_err("unsafe user path should be rejected");
            assert!(error.contains(unsafe_path), "{error}");
        }

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn plugin_manifest_write_failure_removes_installation_artifacts() {
        let root = test_root("plugin-manifest-rollback");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let plugin_id = "localmindmap.test.manifest.rollback";
        let manifest = test_declarative_plugin(plugin_id);

        let error = install_plugin_to_user_dir_at_with_writer(
            &root,
            plugin_id,
            &manifest,
            false,
            |_root, relative_path, _value| {
                if relative_path.ends_with(MANIFEST_FILE_NAME) {
                    Err("simulated manifest write failure".to_string())
                } else {
                    unreachable!("registry should not be written after manifest failure")
                }
            },
        )
        .expect_err("manifest failure should abort installation");

        assert!(error.contains("插件 manifest 写入失败"));
        assert!(!root
            .join(format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}"))
            .exists());
        assert!(!root
            .join(format!(
                "{USER_PLUGIN_INSTALLED_DIR}/.{plugin_id}.installing"
            ))
            .exists());
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn plugin_registry_write_failure_rolls_back_installed_directory() {
        let root = test_root("plugin-registry-rollback");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let plugin_id = "localmindmap.test.registry.rollback";
        let manifest = test_declarative_plugin(plugin_id);

        let error = install_plugin_to_user_dir_at_with_writer(
            &root,
            plugin_id,
            &manifest,
            false,
            |writer_root, relative_path, value| {
                if relative_path == USER_PLUGIN_REGISTRY_PATH {
                    Err("simulated registry write failure".to_string())
                } else {
                    write_user_json_at(writer_root, relative_path, value)
                }
            },
        )
        .expect_err("registry failure should abort installation");

        assert!(error.contains("插件 registry 写入失败"));
        assert!(!root
            .join(format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}"))
            .exists());
        assert!(!root.join(USER_PLUGIN_REGISTRY_PATH).exists());
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn plugin_install_commits_manifest_before_registry() {
        let root = test_root("plugin-write-order");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let plugin_id = "localmindmap.test.write.order";
        let manifest = test_declarative_plugin(plugin_id);
        let mut writes = Vec::new();

        install_plugin_to_user_dir_at_with_writer(
            &root,
            plugin_id,
            &manifest,
            false,
            |writer_root, relative_path, value| {
                writes.push(relative_path.to_string());
                write_user_json_at(writer_root, relative_path, value)
            },
        )
        .expect("installation should succeed");

        assert_eq!(
            writes,
            vec![
                format!("{USER_PLUGIN_INSTALLED_DIR}/.{plugin_id}.installing/{MANIFEST_FILE_NAME}"),
                USER_PLUGIN_REGISTRY_PATH.to_string(),
            ]
        );
        assert!(root
            .join(format!(
                "{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}/{MANIFEST_FILE_NAME}"
            ))
            .is_file());
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn orphan_plugin_directory_is_cleaned_before_reinstall() {
        let root = test_root("plugin-orphan-reinstall");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let plugin_id = "localmindmap.test.orphan.reinstall";
        let manifest = test_declarative_plugin(plugin_id);
        let target_dir = root.join(format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}"));
        fs::create_dir_all(&target_dir).expect("orphan directory should be created");
        fs::write(target_dir.join("partial.tmp"), "partial")
            .expect("orphan marker should be written");

        install_plugin_to_user_dir_at(&root, plugin_id, &manifest, false)
            .expect("orphan directory should be cleaned and installation retried");

        assert!(target_dir.join(MANIFEST_FILE_NAME).is_file());
        assert!(!target_dir.join("partial.tmp").exists());
        let registry = read_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, Value::Array(vec![]))
            .expect("registry should be readable");
        assert!(plugin_registry_contains(&registry, plugin_id)
            .expect("registry should remain an array"));
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn retry_after_failed_plugin_install_succeeds_without_dead_state() {
        let root = test_root("plugin-retry");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let plugin_id = "localmindmap.test.retry";
        let manifest = test_declarative_plugin(plugin_id);

        install_plugin_to_user_dir_at_with_writer(
            &root,
            plugin_id,
            &manifest,
            false,
            |_root, _relative_path, _value| Err("simulated write failure".to_string()),
        )
        .expect_err("first installation should fail");
        install_plugin_to_user_dir_at(&root, plugin_id, &manifest, false)
            .expect("retry should succeed after rollback");

        assert!(root
            .join(format!(
                "{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}/{MANIFEST_FILE_NAME}"
            ))
            .is_file());
        let duplicate = install_plugin_to_user_dir_at(&root, plugin_id, &manifest, false)
            .expect_err("completed installation should report a real duplicate");
        assert_eq!(duplicate, format!("插件已安装：{plugin_id}"));
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn overwrite_install_updates_manifest_and_registry() {
        let root = test_root("plugin-overwrite");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let plugin_id = "localmindmap.test.update";
        let mut first = test_declarative_plugin(plugin_id);
        first["version"] = Value::String("1.0.0".to_string());
        first["name"] = Value::String("Old plugin".to_string());
        install_plugin_to_user_dir_at(&root, plugin_id, &first, false)
            .expect("initial install should succeed");

        let mut update = first.clone();
        update["version"] = Value::String("1.0.1".to_string());
        update["name"] = Value::String("Updated plugin".to_string());
        update["enabled"] = Value::Bool(false);
        install_plugin_to_user_dir_at(&root, plugin_id, &update, true)
            .expect("overwrite should succeed");

        let manifest = read_user_json_at(
            &root,
            &format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}/{MANIFEST_FILE_NAME}"),
            Value::Null,
        )
        .expect("updated manifest should be readable");
        let registry = read_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, Value::Array(vec![]))
            .expect("updated registry should be readable");
        assert_eq!(manifest["version"], "1.0.1");
        assert_eq!(manifest["name"], "Updated plugin");
        assert_eq!(manifest["enabled"], false);
        assert_eq!(registry[0]["version"], "1.0.1");
        assert_eq!(registry[0]["enabled"], false);
        let scanned = scan_installed_plugin_manifests_at(&root, &[])
            .expect("installed plugin scan should succeed");
        let installed = scanned
            .iter()
            .find(|entry| entry.plugin_id_hint == plugin_id)
            .expect("overwritten plugin should be scanned");
        assert!(root.join(&installed.manifest_path).is_file());
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn overwrite_registry_failure_restores_previous_installation() {
        let root = test_root("plugin-overwrite-rollback");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let plugin_id = "localmindmap.test.update.rollback";
        let mut first = test_declarative_plugin(plugin_id);
        first["version"] = Value::String("1.0.0".to_string());
        install_plugin_to_user_dir_at(&root, plugin_id, &first, false)
            .expect("initial install should succeed");

        let mut update = first.clone();
        update["version"] = Value::String("1.0.1".to_string());
        install_plugin_to_user_dir_at_with_writer(
            &root,
            plugin_id,
            &update,
            true,
            |writer_root, relative_path, value| {
                if relative_path == USER_PLUGIN_REGISTRY_PATH {
                    Err("simulated overwrite registry failure".to_string())
                } else {
                    write_user_json_at(writer_root, relative_path, value)
                }
            },
        )
        .expect_err("overwrite should fail");

        let manifest = read_user_json_at(
            &root,
            &format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}/{MANIFEST_FILE_NAME}"),
            Value::Null,
        )
        .expect("previous manifest should be restored");
        let registry = read_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, Value::Array(vec![]))
            .expect("previous registry should be restored");
        assert_eq!(manifest["version"], "1.0.0");
        assert_eq!(registry[0]["version"], "1.0.0");
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn scans_valid_missing_and_damaged_installed_manifests() {
        let root = test_root("plugin-diagnostics");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let valid_id = "localmindmap.test.valid";
        let valid_dir = root.join(format!("{USER_PLUGIN_INSTALLED_DIR}/{valid_id}"));
        fs::create_dir_all(&valid_dir).expect("valid plugin directory should be created");
        fs::write(
            valid_dir.join(MANIFEST_FILE_NAME),
            serde_json::to_string(&test_declarative_plugin(valid_id))
                .expect("manifest should serialize"),
        )
        .expect("valid manifest should be written");

        let missing_id = "localmindmap.test.missing";
        fs::create_dir_all(root.join(format!("{USER_PLUGIN_INSTALLED_DIR}/{missing_id}")))
            .expect("missing manifest directory should be created");

        let damaged_id = "localmindmap.test.damaged";
        let damaged_dir = root.join(format!("{USER_PLUGIN_INSTALLED_DIR}/{damaged_id}"));
        fs::create_dir_all(&damaged_dir).expect("damaged plugin directory should be created");
        fs::write(damaged_dir.join(MANIFEST_FILE_NAME), "{ broken")
            .expect("damaged manifest should be written");

        let absent_id = "localmindmap.test.absent".to_string();
        let entries = scan_installed_plugin_manifests_at(&root, &[absent_id.clone()])
            .expect("scan should complete");
        let valid = entries
            .iter()
            .find(|entry| entry.plugin_id_hint == valid_id)
            .expect("valid plugin should be listed");
        let missing = entries
            .iter()
            .find(|entry| entry.plugin_id_hint == missing_id)
            .expect("missing plugin should be listed");
        let damaged = entries
            .iter()
            .find(|entry| entry.plugin_id_hint == damaged_id)
            .expect("damaged plugin should be listed");
        let absent = entries
            .iter()
            .find(|entry| entry.plugin_id_hint == absent_id)
            .expect("registry plugin without a directory should be listed");
        assert!(valid.manifest.is_some());
        assert!(valid.error.is_none());
        assert!(missing
            .error
            .as_deref()
            .unwrap_or_default()
            .contains("缺失"));
        assert!(damaged
            .error
            .as_deref()
            .unwrap_or_default()
            .contains("损坏"));
        assert!(absent
            .error
            .as_deref()
            .unwrap_or_default()
            .contains("manifest.json 缺失"));
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn reload_snapshot_reports_deleted_registry_manifest_as_missing() {
        let root = test_root("plugin-reload-deleted-manifest");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let plugin_id = "localmindmap.test.reload.deleted";
        let manifest = test_declarative_plugin(plugin_id);
        install_plugin_to_user_dir_at(&root, plugin_id, &manifest, false)
            .expect("plugin installation should succeed");

        let manifest_path = root.join(format!(
            "{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}/{MANIFEST_FILE_NAME}"
        ));
        assert!(manifest_path.is_file());
        fs::remove_file(&manifest_path).expect("manifest should be deleted");

        let snapshot = reload_plugins_from_disk_at(&root).expect("reload snapshot should succeed");
        let entry = snapshot
            .installed_manifests
            .iter()
            .find(|entry| entry.plugin_id_hint == plugin_id)
            .expect("registry plugin should remain in the snapshot");
        assert!(entry.manifest.is_none());
        assert!(entry
            .error
            .as_deref()
            .unwrap_or_default()
            .contains("manifest.json 缺失"));

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn declarative_manifest_rejects_unsafe_fields_and_handlers() {
        let valid_manifest = json!({
            "manifestVersion": 1,
            "pluginId": "localmindmap.export.txt",
            "name": "TXT Export",
            "version": "1.0.0",
            "pluginType": "import-export",
            "capabilities": ["export"],
            "contributions": {
                "exporters": [{
                    "id": "exportText",
                    "label": "TXT",
                    "handler": "builtin.exportText"
                }],
                "menus": [{
                    "id": "exportTextMenu",
                    "label": "Export TXT",
                    "location": "plugins",
                    "command": "builtin.exportText",
                    "when": "hasMindmap"
                }]
            }
        });
        assert!(validate_declarative_manifest("localmindmap.export.txt", &valid_manifest).is_ok());

        let mut unsafe_manifest = valid_manifest.clone();
        unsafe_manifest["contributions"]["exporters"][0]["script"] =
            Value::String("alert(1)".to_string());
        assert!(
            validate_declarative_manifest("localmindmap.export.txt", &unsafe_manifest).is_err()
        );

        let mut unsafe_handler = valid_manifest;
        unsafe_handler["contributions"]["exporters"][0]["handler"] =
            Value::String("custom.execute".to_string());
        assert!(validate_declarative_manifest("localmindmap.export.txt", &unsafe_handler).is_err());

        let mut unsupported_version = test_declarative_plugin("localmindmap.test.version");
        unsupported_version["manifestVersion"] = json!(2);
        let version_error =
            validate_declarative_manifest("localmindmap.test.version", &unsupported_version)
                .expect_err("unsupported manifest version should fail");
        assert!(version_error.contains("当前仅支持 1"));
    }

    #[test]
    fn accepts_minimal_persistence_plugin_without_contributions() {
        let manifest = json!({
            "manifestVersion": 1,
            "pluginId": "localmindmap.test.persistence.theme",
            "name": "Persistence test theme plugin",
            "version": "1.0.0",
            "author": "Local Mindmap Test",
            "description": "Tests plugin persistence.",
            "pluginType": "theme-pack",
            "capabilities": ["themes"],
            "enabled": true
        });

        assert!(
            validate_declarative_manifest("localmindmap.test.persistence.theme", &manifest).is_ok()
        );
    }
}
