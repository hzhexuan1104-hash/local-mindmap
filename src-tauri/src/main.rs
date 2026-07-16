#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
use rfd::FileDialog;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::hash_map::DefaultHasher,
    collections::{BTreeMap, HashMap, HashSet},
    fs,
    hash::{Hash, Hasher},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

const REGISTRY_FILE_NAME: &str = "desktop-plugin-registry.json";
const MANIFEST_FILE_NAME: &str = "manifest.json";
const CONFIG_DIR_NAME: &str = "config";
const LEGACY_IDENTIFIER_DIR_NAME: &str = "com.localmindmap.app";
const IDENTIFIER_MIGRATION_FLAG_PATH: &str = "config/identifier-migration-v1.6.json";
const USER_PLUGIN_REGISTRY_PATH: &str = "plugins/plugin-registry.json";
const USER_PLUGIN_SETTINGS_PATH: &str = "config/plugin-settings.json";
const USER_PLUGIN_INSTALLED_DIR: &str = "plugins/installed";
const USER_PLUGIN_DEV_DIR: &str = "plugins/dev";
const USER_PLUGIN_QUARANTINE_DIR: &str = "plugins/quarantine";
const USER_PLUGIN_DIAGNOSTIC_BACKUP_DIR: &str = "plugins/backups/diagnostics";
const USER_PLUGIN_DIAGNOSTIC_REPORT_DIR: &str = "plugins/reports";
const FILE_BACKUP_DIR: &str = "backups/files";
const SAMPLE_PLUGIN_DIR_NAME: &str = "sample-json-plugin";
const SAMPLE_PLUGIN_ID: &str = "localmindmap.dev.sample-json-plugin";
const SAMPLE_PLUGIN_MANIFEST: &str =
    include_str!("../../docs/examples/sample-json-plugin/manifest.json");
const SAMPLE_PLUGIN_README: &str = include_str!("../../docs/examples/sample-json-plugin/README.md");
const SAMPLE_SCRIPT_PLUGIN_DIR_NAME: &str = "sample-script-plugin";
const SAMPLE_SCRIPT_PLUGIN_ID: &str = "localmindmap.dev.sample-script-plugin";
const SAMPLE_SCRIPT_PLUGIN_MANIFEST: &str =
    include_str!("../../docs/examples/sample-script-plugin/manifest.json");
const SAMPLE_SCRIPT_PLUGIN_MAIN: &str =
    include_str!("../../docs/examples/sample-script-plugin/main.js");
const SAMPLE_SCRIPT_PLUGIN_README: &str =
    include_str!("../../docs/examples/sample-script-plugin/README.md");
const SAMPLE_BATCH_SCRIPT_PLUGIN_DIR_NAME: &str = "sample-batch-script-plugin";
const SAMPLE_BATCH_SCRIPT_PLUGIN_ID: &str = "localmindmap.dev.sample-batch-script-plugin";
const SAMPLE_BATCH_SCRIPT_PLUGIN_MANIFEST: &str =
    include_str!("../../docs/examples/sample-batch-script-plugin/manifest.json");
const SAMPLE_BATCH_SCRIPT_PLUGIN_MAIN: &str =
    include_str!("../../docs/examples/sample-batch-script-plugin/main.js");
const SAMPLE_BATCH_SCRIPT_PLUGIN_README: &str =
    include_str!("../../docs/examples/sample-batch-script-plugin/README.md");
const SAMPLE_WORKFLOW_PLUGIN_DIR_NAME: &str = "sample-json-workflow-plugin";
const SAMPLE_WORKFLOW_PLUGIN_ID: &str = "localmindmap.workflow.meeting-outline";
const SAMPLE_WORKFLOW_PLUGIN_MANIFEST: &str =
    include_str!("../../docs/examples/sample-json-workflow-plugin/manifest.json");
const SAMPLE_WORKFLOW_PLUGIN_README: &str =
    include_str!("../../docs/examples/sample-json-workflow-plugin/README.md");
const SAMPLE_PYTHON_PLUGIN_DIR_NAME: &str = "sample-python-plugin";
const SAMPLE_PYTHON_PLUGIN_ID: &str = "localmindmap.dev.sample-python-plugin";
const SAMPLE_PYTHON_PLUGIN_MANIFEST: &str =
    include_str!("../../docs/examples/sample-python-plugin/manifest.json");
const SAMPLE_PYTHON_PLUGIN_MAIN: &str =
    include_str!("../../docs/examples/sample-python-plugin/main.py");
const SAMPLE_PYTHON_PLUGIN_README: &str =
    include_str!("../../docs/examples/sample-python-plugin/README.md");
const PLUGIN_GALLERY_CATALOG: &str =
    include_str!("../../docs/examples/plugin-gallery/catalog.json");
const PLUGIN_DEVELOPMENT_DOC: &str = include_str!("../../docs/plugin-development.md");
const PLUGIN_GALLERY_CACHE_DIR: &str = "plugins/gallery";
const PLUGIN_GALLERY_ASSETS: &[(&str, &str)] = &[
    (
        "text-export-plugin/manifest.json",
        include_str!("../../docs/examples/plugin-gallery/text-export-plugin/manifest.json"),
    ),
    (
        "text-export-plugin/README.md",
        include_str!("../../docs/examples/plugin-gallery/text-export-plugin/README.md"),
    ),
    (
        "meeting-workflow-plugin/manifest.json",
        include_str!("../../docs/examples/plugin-gallery/meeting-workflow-plugin/manifest.json"),
    ),
    (
        "meeting-workflow-plugin/README.md",
        include_str!("../../docs/examples/plugin-gallery/meeting-workflow-plugin/README.md"),
    ),
    (
        "script-batch-plugin/manifest.json",
        include_str!("../../docs/examples/plugin-gallery/script-batch-plugin/manifest.json"),
    ),
    (
        "script-batch-plugin/main.js",
        include_str!("../../docs/examples/plugin-gallery/script-batch-plugin/main.js"),
    ),
    (
        "script-batch-plugin/README.md",
        include_str!("../../docs/examples/plugin-gallery/script-batch-plugin/README.md"),
    ),
    (
        "python-keyword-plugin/manifest.json",
        include_str!("../../docs/examples/plugin-gallery/python-keyword-plugin/manifest.json"),
    ),
    (
        "python-keyword-plugin/main.py",
        include_str!("../../docs/examples/plugin-gallery/python-keyword-plugin/main.py"),
    ),
    (
        "python-keyword-plugin/README.md",
        include_str!("../../docs/examples/plugin-gallery/python-keyword-plugin/README.md"),
    ),
];
const EXTERNAL_STDOUT_LIMIT: usize = 1024 * 1024;
const EXTERNAL_STDERR_LIMIT: usize = 64 * 1024;
const EXTERNAL_DEFAULT_TIMEOUT_MS: u64 = 5000;
const EXTERNAL_MAX_TIMEOUT_MS: u64 = 30_000;
const PLUGIN_PACKAGE_MAX_ENTRIES: usize = 1_000;
const PLUGIN_PACKAGE_MAX_FILE_SIZE: u64 = 64 * 1024 * 1024;
const PLUGIN_PACKAGE_MAX_TOTAL_SIZE: u64 = 128 * 1024 * 1024;
const DEV_PLUGIN_TEMPLATE_TYPES: &[&str] = &[
    "import-export",
    "action-workflow",
    "script",
    "external-command-python",
    "external-command-executable",
    "theme-pack",
];
const DEV_PLUGIN_MENU_LOCATIONS: &[&str] = &["plugins", "node-context"];
const PLUGIN_COMMAND_WHITELIST: &[&str] = &[
    "builtin.openPluginManager",
    "builtin.reloadPlugins",
    "builtin.openPluginDirectory",
    "builtin.exportText",
    "builtin.exportJson",
    "builtin.applyTheme",
    "builtin.insertNodeType",
    "builtin.applyTemplate",
    "plugin.runScript",
    "plugin.runWorkflow",
    "plugin.runExternal",
];
const USER_DATA_DIRS: &[&str] = &[
    "mindmaps",
    "autosave",
    "autosaves",
    "versions",
    "node-types",
    "node-types/packs",
    "templates",
    "templates/packs",
    "plugins",
    USER_PLUGIN_INSTALLED_DIR,
    USER_PLUGIN_DEV_DIR,
    USER_PLUGIN_QUARANTINE_DIR,
    PLUGIN_GALLERY_CACHE_DIR,
    CONFIG_DIR_NAME,
    "backups",
    FILE_BACKUP_DIR,
    "plugins/backups",
    USER_PLUGIN_DIAGNOSTIC_BACKUP_DIR,
    USER_PLUGIN_DIAGNOSTIC_REPORT_DIR,
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
    "commandline",
    "args",
];
const DECLARATIVE_PLUGIN_TYPES: &[&str] = &[
    "theme-pack",
    "icon-pack",
    "import-export",
    "node-type-pack",
    "template-pack",
    "tool",
    "script",
    "action-workflow",
    "external-command",
];
const DECLARATIVE_PLUGIN_CAPABILITIES: &[&str] = &[
    "themes",
    "icons",
    "export",
    "nodeTypes",
    "templates",
    "tools",
    "script",
    "workflow",
    "external-command",
    "mindmap:read",
    "mindmap:write",
    "node:read",
    "node:write",
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

fn strip_utf8_bom(text: &str) -> &str {
    text.strip_prefix('\u{feff}').unwrap_or(text)
}

fn parse_json_without_bom<T>(text: &str) -> Result<T, serde_json::Error>
where
    T: serde::de::DeserializeOwned,
{
    serde_json::from_str(strip_utf8_bom(text))
}

fn manifest_has_top_level_key(manifest: &Value, field: &str) -> bool {
    manifest
        .as_object()
        .map(|object| object.contains_key(field))
        .unwrap_or(false)
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

    parse_json_without_bom(&raw_text)
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

fn read_user_text_at(root: &Path, relative_path: &str) -> Result<String, String> {
    let target = resolve_user_relative_path(root, relative_path)?;
    fs::read_to_string(&target)
        .map_err(|error| format!("Failed to read user text `{relative_path}`: {error}"))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveBackupOptions {
    enabled: bool,
    max_backups_per_file: Option<usize>,
    throttle_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalFileHealth {
    exists: bool,
    is_file: bool,
    size_bytes: Option<u64>,
    modified_at_ms: Option<u128>,
}

fn safe_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn short_hash(value: &str) -> String {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn backup_file_name(source_path: &Path, path_hash: &str) -> String {
    let stem = source_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("mindmap")
        .chars()
        .map(|character| {
            if matches!(character, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') {
                '-'
            } else {
                character
            }
        })
        .collect::<String>();
    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("lmind");
    format!(
        "{}-{}-{}.{}",
        stem,
        safe_timestamp(),
        &path_hash[..8.min(path_hash.len())],
        extension
    )
}

fn backup_dir_for_file(root: &Path, source_path: &Path) -> PathBuf {
    let path_hash = short_hash(&source_path.to_string_lossy());
    root.join(FILE_BACKUP_DIR).join(path_hash)
}

fn newest_backup_age_ms(backup_dir: &Path) -> Result<Option<u128>, String> {
    if !backup_dir.is_dir() {
        return Ok(None);
    }

    let mut newest: Option<std::time::SystemTime> = None;
    for entry in fs::read_dir(backup_dir)
        .map_err(|error| format!("Failed to inspect backup directory: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Failed to inspect backup entry: {error}"))?;
        let metadata = entry
            .metadata()
            .map_err(|error| format!("Failed to inspect backup metadata: {error}"))?;
        if !metadata.is_file() {
            continue;
        }
        let modified = metadata
            .modified()
            .map_err(|error| format!("Failed to inspect backup modified time: {error}"))?;
        if newest.map(|current| modified > current).unwrap_or(true) {
            newest = Some(modified);
        }
    }

    let Some(newest) = newest else {
        return Ok(None);
    };
    Ok(newest.elapsed().ok().map(|duration| duration.as_millis()))
}

fn prune_file_backups(backup_dir: &Path, max_backups: usize) -> Result<(), String> {
    if max_backups == 0 || !backup_dir.is_dir() {
        return Ok(());
    }

    let mut backups = Vec::new();
    for entry in fs::read_dir(backup_dir)
        .map_err(|error| format!("Failed to list backup directory: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Failed to read backup entry: {error}"))?;
        let metadata = entry
            .metadata()
            .map_err(|error| format!("Failed to read backup metadata: {error}"))?;
        if metadata.is_file() {
            backups.push((
                entry.path(),
                metadata
                    .modified()
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH),
            ));
        }
    }

    backups.sort_by_key(|(_, modified)| *modified);
    let remove_count = backups.len().saturating_sub(max_backups);
    for (path, _) in backups.into_iter().take(remove_count) {
        fs::remove_file(&path)
            .map_err(|error| format!("Failed to prune backup `{}`: {error}", path.display()))?;
    }
    Ok(())
}

fn create_file_backup_at(
    root: &Path,
    source_path: &Path,
    options: &SaveBackupOptions,
) -> Result<Option<PathBuf>, String> {
    if !options.enabled || !source_path.is_file() {
        return Ok(None);
    }

    let backup_dir = backup_dir_for_file(root, source_path);
    if let Some(throttle_ms) = options.throttle_ms {
        if newest_backup_age_ms(&backup_dir)?
            .map(|age| age < u128::from(throttle_ms))
            .unwrap_or(false)
        {
            return Ok(None);
        }
    }

    fs::create_dir_all(&backup_dir)
        .map_err(|error| format!("Failed to create backup directory: {error}"))?;
    let path_hash = short_hash(&source_path.to_string_lossy());
    let backup_path = backup_dir.join(backup_file_name(source_path, &path_hash));
    fs::copy(source_path, &backup_path).map_err(|error| {
        format!(
            "Failed to create backup for `{}`: {error}",
            source_path.display()
        )
    })?;
    prune_file_backups(
        &backup_dir,
        options.max_backups_per_file.unwrap_or(20).clamp(1, 200),
    )?;
    Ok(Some(backup_path))
}

fn atomic_write_file(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Selected file path has no parent directory.".to_string())?;
    if !parent.is_dir() {
        return Err(format!(
            "Selected file directory does not exist: {}",
            parent.display()
        ));
    }

    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("mindmap.lmind");
    let suffix = safe_timestamp();
    let temp_path = parent.join(format!(".{file_name}.{suffix}.tmp"));
    let restore_path = parent.join(format!(".{file_name}.{suffix}.restore"));

    {
        let mut file = fs::File::create(&temp_path).map_err(|error| {
            format!("Failed to create temporary file `{}`: {error}", temp_path.display())
        })?;
        file.write_all(bytes).map_err(|error| {
            format!("Failed to write temporary file `{}`: {error}", temp_path.display())
        })?;
        file.sync_all().map_err(|error| {
            format!("Failed to flush temporary file `{}`: {error}", temp_path.display())
        })?;
    }

    if path.is_file() {
        fs::copy(path, &restore_path).map_err(|error| {
            let _ = fs::remove_file(&temp_path);
            format!("Failed to prepare restore copy `{}`: {error}", restore_path.display())
        })?;
    }

    #[cfg(target_os = "windows")]
    {
        if path.exists() {
            fs::remove_file(path).map_err(|error| {
                let _ = fs::remove_file(&temp_path);
                let _ = fs::remove_file(&restore_path);
                format!("Failed to replace existing file `{}`: {error}", path.display())
            })?;
        }
    }

    if let Err(error) = fs::rename(&temp_path, path) {
        if restore_path.is_file() {
            let _ = fs::copy(&restore_path, path);
        }
        let _ = fs::remove_file(&temp_path);
        let _ = fs::remove_file(&restore_path);
        return Err(format!("Failed to atomically replace `{}`: {error}", path.display()));
    }

    let _ = fs::remove_file(&restore_path);
    Ok(())
}

fn write_local_file_reliable_at(
    root: Option<&Path>,
    path: &Path,
    bytes: &[u8],
    backup_options: Option<&SaveBackupOptions>,
) -> Result<String, String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Selected file path has no parent directory.".to_string())?;
    if !parent.is_dir() {
        return Err(format!(
            "Selected file directory does not exist: {}",
            parent.display()
        ));
    }

    if let (Some(root), Some(options)) = (root, backup_options) {
        create_file_backup_at(root, path, options)?;
    }

    atomic_write_file(path, bytes)?;
    Ok(path.to_string_lossy().to_string())
}

fn write_local_file_at(path: &Path, bytes: &[u8]) -> Result<String, String> {
    write_local_file_reliable_at(None, path, bytes, None)
}

fn local_file_health_at(path: &Path) -> LocalFileHealth {
    match fs::metadata(path) {
        Ok(metadata) => LocalFileHealth {
            exists: true,
            is_file: metadata.is_file(),
            size_bytes: Some(metadata.len()),
            modified_at_ms: metadata.modified().ok().and_then(|time| {
                time.duration_since(std::time::SystemTime::UNIX_EPOCH)
                    .ok()
                    .map(|duration| duration.as_millis())
            }),
        },
        Err(_) => LocalFileHealth {
            exists: false,
            is_file: false,
            size_bytes: None,
            modified_at_ms: None,
        },
    }
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

    if plugin_type == "script" {
        let entry = object
            .get("entry")
            .and_then(Value::as_str)
            .map(str::trim)
            .ok_or_else(|| "pluginType=script 时 entry 必填。".to_string())?;
        validate_script_entry_path(entry)?;
    } else if plugin_type == "external-command" {
        let runtime = object
            .get("runtime")
            .and_then(Value::as_str)
            .ok_or_else(|| "pluginType=external-command 时 runtime 必填。".to_string())?;
        if runtime != "python" && runtime != "executable" {
            return Err("runtime 仅允许 python 或 executable。".to_string());
        }
        let entry = object
            .get("entry")
            .and_then(Value::as_str)
            .map(str::trim)
            .ok_or_else(|| "pluginType=external-command 时 entry 必填。".to_string())?;
        validate_external_entry_path(entry, runtime)?;
    } else if plugin_type == "action-workflow" {
        if object.contains_key("entry") {
            return Err("action-workflow 插件不允许声明 entry。".to_string());
        }
        validate_action_workflow(object.get("workflow"))?;
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

    if let Some(permissions) = object.get("permissions") {
        let permissions = permissions
            .as_array()
            .ok_or_else(|| "permissions 必须是数组。".to_string())?;
        for permission in permissions {
            permission
                .as_str()
                .ok_or_else(|| "permissions 只能包含字符串。".to_string())?;
        }
    }

    if let Some(contributions) = object.get("contributions") {
        validate_builtin_handlers(contributions)?;
        validate_menu_command_shape(contributions)?;
        if plugin_type == "script" {
            validate_script_menu_commands(contributions)?;
        } else if plugin_type == "action-workflow" {
            validate_workflow_menu_commands(contributions)?;
        } else if plugin_type == "external-command" {
            validate_external_menu_commands(contributions)?;
        } else {
            validate_non_executable_menu_commands(contributions)?;
        }
    }

    Ok(())
}

fn validate_action_workflow(workflow: Option<&Value>) -> Result<(), String> {
    let workflow = workflow
        .and_then(Value::as_object)
        .ok_or_else(|| "pluginType=action-workflow 时 workflow 必须是对象。".to_string())?;
    if let Some(field) = find_workflow_execution_field(&Value::Object(workflow.clone())) {
        return Err(format!("workflow 不允许执行代码相关字段：{field}"));
    }
    let actions = workflow
        .get("actions")
        .and_then(Value::as_array)
        .ok_or_else(|| "workflow.actions 必须是数组。".to_string())?;
    if actions.is_empty() {
        return Err("workflow.actions 不能为空。".to_string());
    }
    if actions.len() > 20 {
        return Err("workflow.actions 最多 20 个 action。".to_string());
    }
    Ok(())
}

fn find_workflow_execution_field(value: &Value) -> Option<String> {
    match value {
        Value::Array(items) => items.iter().find_map(find_workflow_execution_field),
        Value::Object(object) => object.iter().find_map(|(key, child)| {
            let normalized = key.to_ascii_lowercase();
            if ["entry", "runtime", "commandline", "script", "code"].contains(&normalized.as_str())
            {
                Some(key.clone())
            } else {
                find_workflow_execution_field(child)
            }
        }),
        _ => None,
    }
}

fn validate_script_entry_path(entry: &str) -> Result<(), String> {
    if entry.trim().is_empty() {
        return Err("pluginType=script 时 entry 必填。".to_string());
    }
    let normalized = entry.replace('\\', "/");
    if normalized.starts_with('/')
        || normalized.starts_with("//")
        || normalized.as_bytes().get(1) == Some(&b':')
    {
        return Err("entry 只能是相对路径，不能是绝对路径。".to_string());
    }
    if normalized.split('/').any(|segment| {
        segment.is_empty()
            || segment == "."
            || segment == ".."
            || segment.contains(':')
            || segment.ends_with('.')
            || segment.ends_with(' ')
    }) {
        return Err("entry 不允许包含 ..、. 或空路径片段。".to_string());
    }
    if !normalized.to_ascii_lowercase().ends_with(".js") {
        return Err("entry 本批只支持 .js 文件。".to_string());
    }
    Ok(())
}

fn validate_safe_entry_path(entry: &str) -> Result<String, String> {
    if entry.trim().is_empty() {
        return Err("entry 必填。".to_string());
    }
    let normalized = entry.replace('\\', "/");
    let lower = normalized.to_ascii_lowercase();
    if normalized.starts_with('/')
        || normalized.starts_with("//")
        || normalized.as_bytes().get(1) == Some(&b':')
        || lower.contains("://")
    {
        return Err("entry 只能是插件目录内相对路径，不能是绝对路径或远程 URL。".to_string());
    }
    if normalized.split('/').any(|segment| {
        segment.is_empty()
            || segment == "."
            || segment == ".."
            || segment.contains(':')
            || segment.ends_with('.')
            || segment.ends_with(' ')
    }) {
        return Err("entry 不允许包含 ..、. 或空路径片段。".to_string());
    }
    Ok(normalized)
}

fn validate_external_entry_path(entry: &str, runtime: &str) -> Result<(), String> {
    let normalized = validate_safe_entry_path(entry)?;
    let lower = normalized.to_ascii_lowercase();
    if runtime == "python" && !lower.ends_with(".py") {
        return Err("runtime=python 时 entry 必须是 .py 文件。".to_string());
    }
    if runtime == "executable" {
        if let Some(error) = external_executable_entry_error_for_platform(&normalized, cfg!(target_os = "windows")) {
            return Err(error);
        }
    }
    Ok(())
}

fn external_executable_entry_error_for_platform(entry: &str, is_windows: bool) -> Option<String> {
    let lower = entry.to_ascii_lowercase();
    if lower.ends_with(".dll") {
        return Some("runtime=executable 不支持 DLL。".to_string());
    }
    if is_windows && !lower.ends_with(".exe") {
        return Some("Windows 下 runtime=executable 时 entry 必须是 .exe 文件。".to_string());
    }
    if !is_windows && lower.ends_with(".sh") {
        return Some("macOS/Linux 下 runtime=executable 暂不支持 Shell 脚本。".to_string());
    }
    None
}

fn validate_executable_entry_file(path: &Path) -> Result<(), String> {
    if !path.is_file() {
        return Err(format!("可执行插件入口不存在或不是普通文件：{}", path.display()));
    }
    let header = fs::read(path).map_err(|error| format!("无法读取可执行插件入口：{error}"))?;
    if header.len() < 4 {
        return Err("可执行插件入口文件过小。".to_string());
    }
    if cfg!(target_os = "windows") {
        if &header[..2] != b"MZ" {
            return Err("Windows 可执行插件入口必须是 PE 二进制文件。".to_string());
        }
        return Ok(());
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if fs::metadata(path)
            .map_err(|error| format!("无法读取可执行插件权限：{error}"))?
            .permissions()
            .mode()
            & 0o111
            == 0
        {
            return Err("macOS/Linux 可执行插件入口缺少执行权限。".to_string());
        }
    }

    let native_binary = matches!(
        &header[..4],
        b"\x7fELF"
            | [0xfe, 0xed, 0xfa, 0xce]
            | [0xce, 0xfa, 0xed, 0xfe]
            | [0xfe, 0xed, 0xfa, 0xcf]
            | [0xcf, 0xfa, 0xed, 0xfe]
            | [0xca, 0xfe, 0xba, 0xbe]
            | [0xbe, 0xba, 0xfe, 0xca]
    );
    if !native_binary {
        return Err("macOS/Linux 可执行插件入口必须是原生二进制文件。".to_string());
    }
    Ok(())
}

fn validate_plugin_package_entry_name(name: &str, is_dir: bool) -> Result<Option<String>, String> {
    if name.is_empty() || name.contains('\0') || name.contains('\\') {
        return Err(format!("插件包包含非法路径：{name}"));
    }
    let normalized = if is_dir {
        name.trim_end_matches('/')
    } else {
        name
    };
    if normalized.is_empty() {
        return Ok(None);
    }
    if normalized.starts_with('/')
        || normalized.starts_with("//")
        || normalized.as_bytes().get(1) == Some(&b':')
        || normalized.contains("://")
        || normalized.split('/').any(|segment| {
            segment.is_empty()
                || segment == "."
                || segment == ".."
                || segment.contains(':')
                || segment.ends_with('.')
                || segment.ends_with(' ')
        })
        || Path::new(normalized)
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(format!("插件包包含非法路径：{name}"));
    }
    Ok(Some(normalized.to_string()))
}

#[derive(Debug)]
struct InspectedPluginPackage {
    manifest: Value,
    files: HashSet<String>,
}

fn inspect_plugin_package(path: &Path) -> Result<InspectedPluginPackage, String> {
    let file =
        fs::File::open(path).map_err(|error| format!("插件包解压失败：无法读取文件：{error}"))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| format!("插件包解压失败：不是有效的 zip：{error}"))?;
    if archive.len() > PLUGIN_PACKAGE_MAX_ENTRIES {
        return Err(format!(
            "插件包解压失败：文件数量超过 {} 个限制。",
            PLUGIN_PACKAGE_MAX_ENTRIES
        ));
    }

    let mut files = HashSet::new();
    let mut manifest_text = None;
    let mut total_size = 0u64;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("插件包解压失败：无法读取压缩项：{error}"))?;
        let Some(name) = validate_plugin_package_entry_name(entry.name(), entry.is_dir())? else {
            continue;
        };
        if entry.is_dir() {
            continue;
        }
        if entry.size() > PLUGIN_PACKAGE_MAX_FILE_SIZE {
            return Err(format!("插件包解压失败：文件过大：{name}"));
        }
        total_size = total_size.saturating_add(entry.size());
        if total_size > PLUGIN_PACKAGE_MAX_TOTAL_SIZE {
            return Err("插件包解压失败：解压后总大小超过 128MB。".to_string());
        }
        if !files.insert(name.clone()) {
            return Err(format!("插件包包含重复路径：{name}"));
        }
        if name == MANIFEST_FILE_NAME {
            let mut text = String::new();
            entry
                .read_to_string(&mut text)
                .map_err(|error| format!("manifest JSON 无效：必须是 UTF-8 JSON：{error}"))?;
            manifest_text = Some(text);
        }
    }

    let manifest_text = manifest_text
        .ok_or_else(|| "缺少 manifest.json：插件包根目录必须包含 manifest.json。".to_string())?;
    let manifest: Value = parse_json_without_bom(&manifest_text)
        .map_err(|error| format!("manifest JSON 无效：{error}"))?;
    let plugin_id = manifest
        .get("pluginId")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let normalized_entry = manifest
        .get("entry")
        .and_then(Value::as_str)
        .map(|entry| {
            validate_safe_entry_path(entry).map_err(|error| format!("entry 路径非法：{error}"))
        })
        .transpose()?;
    validate_declarative_manifest(plugin_id, &manifest)
        .map_err(|error| format!("schema 校验失败：{error}"))?;

    if let Some(entry) = normalized_entry {
        if !files.contains(&entry) {
            return Err(format!("entry 文件不存在：{entry}"));
        }
    }

    Ok(InspectedPluginPackage { manifest, files })
}

fn extract_plugin_package(path: &Path, staging_dir: &Path) -> Result<(), String> {
    let inspected = inspect_plugin_package(path)?;
    let file =
        fs::File::open(path).map_err(|error| format!("插件包解压失败：无法读取文件：{error}"))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| format!("插件包解压失败：不是有效的 zip：{error}"))?;
    if archive.len() > PLUGIN_PACKAGE_MAX_ENTRIES {
        return Err(format!(
            "插件包解压失败：文件数量超过 {} 个限制。",
            PLUGIN_PACKAGE_MAX_ENTRIES
        ));
    }

    let mut total_size = 0u64;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("插件包解压失败：无法读取压缩项：{error}"))?;
        let Some(name) = validate_plugin_package_entry_name(entry.name(), entry.is_dir())? else {
            continue;
        };
        let target = staging_dir.join(Path::new(&name));
        if !target.starts_with(staging_dir) {
            return Err(format!("插件包包含非法路径：{name}"));
        }
        if entry.is_dir() {
            fs::create_dir_all(&target)
                .map_err(|error| format!("插件包解压失败：目录创建失败：{error}"))?;
            continue;
        }
        if entry.size() > PLUGIN_PACKAGE_MAX_FILE_SIZE {
            return Err(format!("插件包解压失败：文件过大：{name}"));
        }
        total_size = total_size.saturating_add(entry.size());
        if total_size > PLUGIN_PACKAGE_MAX_TOTAL_SIZE {
            return Err("插件包解压失败：解压后总大小超过 128MB。".to_string());
        }
        if name == MANIFEST_FILE_NAME {
            continue;
        }
        if !inspected.files.contains(&name) {
            return Err(format!("插件包解压失败：压缩项校验状态异常：{name}"));
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("插件包解压失败：目录创建失败：{error}"))?;
        }
        let mut output = fs::File::create(&target)
            .map_err(|error| format!("插件包解压失败：文件创建失败：{error}"))?;
        std::io::copy(&mut entry, &mut output)
            .map_err(|error| format!("插件包解压失败：文件写入失败：{error}"))?;
    }
    Ok(())
}

fn validate_script_menu_commands(contributions: &Value) -> Result<(), String> {
    let Some(menus) = contributions.get("menus") else {
        return Ok(());
    };
    let menus = menus
        .as_array()
        .ok_or_else(|| "contributions.menus must be an array.".to_string())?;
    for menu in menus {
        let Some(command) = menu.get("command").and_then(Value::as_str) else {
            continue;
        };
        if command != "plugin.runScript" {
            return Err("script 插件菜单 command 必须是 plugin.runScript。".to_string());
        }
    }
    Ok(())
}

fn validate_workflow_menu_commands(contributions: &Value) -> Result<(), String> {
    let Some(menus) = contributions.get("menus") else {
        return Ok(());
    };
    let menus = menus
        .as_array()
        .ok_or_else(|| "contributions.menus must be an array.".to_string())?;
    for menu in menus {
        let Some(command) = menu.get("command").and_then(Value::as_str) else {
            continue;
        };
        if command != "plugin.runWorkflow" {
            return Err("action-workflow 插件菜单 command 必须是 plugin.runWorkflow。".to_string());
        }
    }
    Ok(())
}

fn validate_external_menu_commands(contributions: &Value) -> Result<(), String> {
    let Some(menus) = contributions.get("menus") else {
        return Ok(());
    };
    let menus = menus
        .as_array()
        .ok_or_else(|| "contributions.menus must be an array.".to_string())?;
    for menu in menus {
        let Some(command) = menu.get("command").and_then(Value::as_str) else {
            continue;
        };
        if command != "plugin.runExternal" {
            return Err(
                "external-command 插件菜单 command 必须是 plugin.runExternal。".to_string(),
            );
        }
    }
    Ok(())
}

fn validate_non_executable_menu_commands(contributions: &Value) -> Result<(), String> {
    let Some(menus) = contributions.get("menus") else {
        return Ok(());
    };
    let menus = menus
        .as_array()
        .ok_or_else(|| "contributions.menus must be an array.".to_string())?;
    for menu in menus {
        let command = menu
            .get("command")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if command == "plugin.runScript"
            || command == "plugin.runWorkflow"
            || command == "plugin.runExternal"
        {
            return Err(format!("当前插件类型不能使用 {command}。"));
        }
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginGalleryCatalogItem {
    id: String,
    title: String,
    description: String,
    category: String,
    plugin_type: String,
    runtime: Option<String>,
    path: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    recommended: bool,
    risk_level: String,
}

#[derive(Debug, Deserialize)]
struct PluginGalleryCatalog {
    version: u64,
    items: Vec<PluginGalleryCatalogItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PluginGalleryItem {
    #[serde(flatten)]
    catalog: PluginGalleryCatalogItem,
    manifest: Option<Value>,
    readme: Option<String>,
    installable: bool,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PluginGalleryCatalogResult {
    version: u64,
    items: Vec<PluginGalleryItem>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PluginGalleryInstallResult {
    plugin_id: String,
    name: String,
    version: String,
    installed_dir: String,
}

fn validate_gallery_catalog_path(path: &str) -> Result<String, String> {
    if path.trim().is_empty() {
        return Err("catalog item path 不能为空。".to_string());
    }
    if path.contains('\\') {
        return Err("catalog item path 必须使用 `/` 分隔符。".to_string());
    }
    let lower = path.to_ascii_lowercase();
    if path.starts_with('/')
        || path.starts_with("//")
        || path.as_bytes().get(1) == Some(&b':')
        || lower.contains("://")
        || lower.starts_with("file:")
        || lower.starts_with("http:")
        || lower.starts_with("https:")
    {
        return Err("catalog item path 必须是本地相对路径，不能是绝对路径或 URL。".to_string());
    }
    if path.split('/').any(|segment| {
        segment.is_empty()
            || segment == "."
            || segment == ".."
            || segment.contains(':')
            || segment.ends_with('.')
            || segment.ends_with(' ')
    }) || Path::new(path)
        .components()
        .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err("catalog item path 不允许包含 `..`、`.`、ADS 或空路径片段。".to_string());
    }
    if Path::new(path).file_name().and_then(|name| name.to_str()) != Some(MANIFEST_FILE_NAME) {
        return Err("catalog item path 必须指向 manifest.json。".to_string());
    }
    Ok(path.to_string())
}

fn bundled_gallery_asset(path: &str) -> Option<&'static str> {
    PLUGIN_GALLERY_ASSETS
        .iter()
        .find_map(|(asset_path, content)| (*asset_path == path).then_some(*content))
}

fn gallery_plugin_asset_paths(manifest_path: &str) -> Result<Vec<&'static str>, String> {
    let directory = Path::new(manifest_path)
        .parent()
        .and_then(Path::to_str)
        .ok_or_else(|| "catalog item path 缺少插件目录。".to_string())?;
    let prefix = format!("{directory}/");
    Ok(PLUGIN_GALLERY_ASSETS
        .iter()
        .filter_map(|(path, _)| path.starts_with(&prefix).then_some(*path))
        .collect())
}

fn plugin_gallery_item(catalog: PluginGalleryCatalogItem) -> PluginGalleryItem {
    let result = (|| -> Result<(Value, Option<String>), String> {
        let manifest_path = validate_gallery_catalog_path(&catalog.path)?;
        let manifest_text = bundled_gallery_asset(&manifest_path)
            .ok_or_else(|| format!("catalog 指向的文件不存在：{manifest_path}"))?;
        let manifest: Value = parse_json_without_bom(manifest_text)
            .map_err(|error| format!("gallery manifest JSON 无效：{error}"))?;
        validate_declarative_manifest(&catalog.id, &manifest)
            .map_err(|error| format!("gallery manifest 校验失败：{error}"))?;
        if manifest.get("pluginType").and_then(Value::as_str) != Some(catalog.plugin_type.as_str())
        {
            return Err("catalog pluginType 与 manifest 不一致。".to_string());
        }
        if manifest.get("runtime").and_then(Value::as_str) != catalog.runtime.as_deref() {
            return Err("catalog runtime 与 manifest 不一致。".to_string());
        }
        if !["low", "medium", "high"].contains(&catalog.risk_level.as_str()) {
            return Err("catalog riskLevel 仅支持 low、medium 或 high。".to_string());
        }

        let directory = Path::new(&manifest_path)
            .parent()
            .and_then(Path::to_str)
            .ok_or_else(|| "catalog item path 缺少插件目录。".to_string())?;
        let readme_path = format!("{directory}/README.md");
        let readme = bundled_gallery_asset(&readme_path).map(str::to_string);
        if readme.is_none() {
            return Err(format!("gallery 示例缺少 README.md：{readme_path}"));
        }
        if let Some(entry) = manifest.get("entry").and_then(Value::as_str) {
            let entry = validate_safe_entry_path(entry)?;
            let entry_path = format!("{directory}/{entry}");
            if bundled_gallery_asset(&entry_path).is_none() {
                return Err(format!("gallery 插件入口文件不存在：{entry_path}"));
            }
        }
        Ok((manifest, readme))
    })();

    match result {
        Ok((manifest, readme)) => PluginGalleryItem {
            catalog,
            manifest: Some(manifest),
            readme,
            installable: true,
            error: None,
        },
        Err(error) => PluginGalleryItem {
            catalog,
            manifest: None,
            readme: None,
            installable: false,
            error: Some(error),
        },
    }
}

fn load_plugin_gallery_catalog_from_text(text: &str) -> PluginGalleryCatalogResult {
    let catalog = match parse_json_without_bom::<PluginGalleryCatalog>(text) {
        Ok(catalog) => catalog,
        Err(error) => {
            return PluginGalleryCatalogResult {
                version: 0,
                items: Vec::new(),
                error: Some(format!("本地插件中心 catalog.json 解析失败：{error}")),
            }
        }
    };
    if catalog.version != 1 {
        return PluginGalleryCatalogResult {
            version: catalog.version,
            items: Vec::new(),
            error: Some(format!(
                "本地插件中心 catalog 版本不受支持：{}。",
                catalog.version
            )),
        };
    }
    PluginGalleryCatalogResult {
        version: catalog.version,
        items: catalog.items.into_iter().map(plugin_gallery_item).collect(),
        error: None,
    }
}

fn manifest_without_registry_metadata(manifest: &Value) -> Value {
    let mut stored = manifest.clone();
    if let Some(object) = stored.as_object_mut() {
        for field in [
            "enabled",
            "trusted",
            "installedAt",
            "updatedAt",
            "builtIn",
            "source",
            "manifestValid",
            "manifestError",
            "validationErrors",
            "validationWarnings",
            "manifestPath",
            "installedDirPath",
        ] {
            object.remove(field);
        }
    }
    stored
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
    let installed_at = manifest.get("installedAt").cloned().unwrap_or(Value::Null);
    plugins.push(json!({
        "pluginId": plugin_id,
        "enabled": manifest
            .get("enabled")
            .and_then(Value::as_bool)
            .unwrap_or(true),
        "trusted": manifest
            .get("trusted")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        "installedAt": installed_at.clone(),
        "updatedAt": manifest
            .get("updatedAt")
            .cloned()
            .unwrap_or_else(|| installed_at.clone())
    }));
    Ok(Value::Array(plugins))
}

fn manifest_with_install_lifecycle(
    manifest: &Value,
    registry: &Value,
    plugin_id: &str,
    overwrite: bool,
) -> Value {
    let mut installed = manifest.clone();
    let Some(object) = installed.as_object_mut() else {
        return installed;
    };
    let existing = registry.as_array().and_then(|plugins| {
        plugins
            .iter()
            .find(|plugin| plugin.get("pluginId").and_then(Value::as_str) == Some(plugin_id))
    });
    if overwrite {
        if let Some(existing) = existing {
            for field in ["enabled", "trusted", "installedAt"] {
                if let Some(value) = existing.get(field) {
                    object.insert(field.to_string(), value.clone());
                }
            }
            return installed;
        }
    }
    object.insert("trusted".to_string(), Value::Bool(false));
    installed
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginInstallAsset {
    relative_path: String,
    source_path: Option<String>,
    text: Option<String>,
    #[serde(default)]
    optional: bool,
}

fn copy_plugin_install_assets(
    staging_dir: &Path,
    manifest_source_path: Option<&str>,
    assets: &[PluginInstallAsset],
) -> Result<(), String> {
    let manifest_parent = manifest_source_path
        .and_then(|path| Path::new(path).parent())
        .map(Path::to_path_buf);

    for asset in assets {
        validate_safe_entry_path(&asset.relative_path)?;
        let relative_path = normalized_user_relative_path(&asset.relative_path)?;
        let target_path = staging_dir.join(&relative_path);
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("脚本入口目录创建失败：{error}"))?;
        }

        if let Some(text) = &asset.text {
            fs::write(&target_path, text)
                .map_err(|error| format!("脚本入口文件写入失败：{error}"))?;
            continue;
        }

        let Some(source_path) = asset.source_path.as_deref() else {
            if asset.optional {
                continue;
            }
            return Err(format!(
                "导入失败：脚本入口文件不存在：{}。",
                asset.relative_path
            ));
        };
        let source_path = Path::new(source_path);
        if !source_path.is_file() {
            if asset.optional {
                continue;
            }
            return Err(format!(
                "导入失败：脚本入口文件不存在：{}。",
                asset.relative_path
            ));
        }
        if let Some(parent) = &manifest_parent {
            let expected = parent.join(&relative_path);
            if expected != source_path {
                return Err("脚本入口文件必须位于 manifest.json 同目录内。".to_string());
            }
        }
        fs::copy(source_path, &target_path)
            .map_err(|error| format!("脚本入口文件复制失败：{error}"))?;
    }

    Ok(())
}

fn install_plugin_to_user_dir_at_with_stager<F, W>(
    root: &Path,
    plugin_id: &str,
    manifest: &Value,
    overwrite: bool,
    stage_assets: F,
    mut write_json: W,
) -> Result<(), String>
where
    F: FnOnce(&Path) -> Result<(), String>,
    W: FnMut(&Path, &str, &Value) -> Result<(), String>,
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
    let installed_manifest =
        manifest_with_install_lifecycle(manifest, &original_registry, plugin_id, overwrite);
    let stored_manifest = manifest_without_registry_metadata(&installed_manifest);
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

    if let Err(error) = write_json(root, &relative_staging_manifest, &stored_manifest) {
        let cleanup_error = remove_path_if_exists(&staging_dir).err();
        return Err(format!(
            "插件 manifest 写入失败：{error}{}",
            cleanup_error
                .map(|cleanup| format!("；临时目录回滚失败：{cleanup}"))
                .unwrap_or_default()
        ));
    }
    if let Err(error) = stage_assets(&staging_dir) {
        let cleanup_error = remove_path_if_exists(&staging_dir).err();
        return Err(format!(
            "{error}{}",
            cleanup_error
                .map(|cleanup| format!("；临时目录回滚失败：{cleanup}"))
                .unwrap_or_default()
        ));
    }
    if let Some(entry) = stored_manifest.get("entry").and_then(Value::as_str) {
        let entry = validate_safe_entry_path(entry)?;
        if !staging_dir.join(Path::new(&entry)).is_file() {
            let cleanup_error = remove_path_if_exists(&staging_dir).err();
            return Err(format!(
                "导入失败：插件入口文件不存在：{entry}。{}",
                cleanup_error
                    .map(|cleanup| format!("临时目录回滚失败：{cleanup}"))
                    .unwrap_or_default()
            ));
        }
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

    let next_registry = upsert_plugin_registry(&original_registry, plugin_id, &installed_manifest)?;
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

fn install_plugin_to_user_dir_at_with_writer<W>(
    root: &Path,
    plugin_id: &str,
    manifest: &Value,
    overwrite: bool,
    manifest_source_path: Option<&str>,
    assets: &[PluginInstallAsset],
    write_json: W,
) -> Result<(), String>
where
    W: FnMut(&Path, &str, &Value) -> Result<(), String>,
{
    install_plugin_to_user_dir_at_with_stager(
        root,
        plugin_id,
        manifest,
        overwrite,
        |staging_dir| copy_plugin_install_assets(staging_dir, manifest_source_path, assets),
        write_json,
    )
}

#[cfg(test)]
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
        None,
        &[],
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
fn read_user_text(app: AppHandle, relative_path: String) -> Result<String, String> {
    let root = ensure_user_data_root(&app)?;
    read_user_text_at(&root, &relative_path)
}

#[tauri::command]
fn delete_user_file(app: AppHandle, relative_path: String) -> Result<bool, String> {
    let root = ensure_user_data_root(&app)?;
    let target = resolve_user_relative_path(&root, &relative_path)?;
    if !target.exists() {
        return Ok(false);
    }
    if !target.is_file() {
        return Err(format!("User path is not a file: {relative_path}"));
    }
    fs::remove_file(&target)
        .map_err(|error| format!("Failed to delete user file `{relative_path}`: {error}"))?;
    Ok(true)
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
    source_manifest_path: Option<String>,
    assets: Option<Vec<PluginInstallAsset>>,
) -> Result<(), String> {
    let root = ensure_user_data_root(&app)?;
    install_plugin_to_user_dir_at_with_writer(
        &root,
        &plugin_id,
        &manifest,
        overwrite,
        source_manifest_path.as_deref(),
        assets.as_deref().unwrap_or(&[]),
        write_user_json_at,
    )
}

fn install_gallery_plugin_at(
    root: &Path,
    catalog_text: &str,
    catalog_id: &str,
    overwrite: bool,
    installed_at: Option<&str>,
) -> Result<PluginGalleryInstallResult, String> {
    let catalog = load_plugin_gallery_catalog_from_text(catalog_text);
    if let Some(error) = catalog.error {
        return Err(error);
    }
    let item = catalog
        .items
        .into_iter()
        .find(|item| item.catalog.id == catalog_id)
        .ok_or_else(|| format!("本地插件中心不存在条目：{catalog_id}"))?;
    if !item.installable {
        return Err(item
            .error
            .unwrap_or_else(|| "该 gallery 插件当前不可安装。".to_string()));
    }
    let mut manifest = item
        .manifest
        .ok_or_else(|| "gallery 插件 manifest 不可用。".to_string())?;
    if let (Some(object), Some(installed_at)) = (manifest.as_object_mut(), installed_at) {
        object.insert(
            "installedAt".to_string(),
            Value::String(installed_at.to_string()),
        );
    }
    let manifest_path = item.catalog.path;
    let plugin_directory = Path::new(&manifest_path)
        .parent()
        .and_then(Path::to_str)
        .ok_or_else(|| "gallery 插件目录无效。".to_string())?
        .to_string();
    let plugin_assets = gallery_plugin_asset_paths(&manifest_path)?;
    let plugin_id = item.catalog.id;

    install_plugin_to_user_dir_at_with_stager(
        root,
        &plugin_id,
        &manifest,
        overwrite,
        |staging_dir| {
            for asset_path in plugin_assets {
                if asset_path == manifest_path {
                    continue;
                }
                let relative_path = asset_path
                    .strip_prefix(&format!("{plugin_directory}/"))
                    .ok_or_else(|| "gallery 资源路径越界。".to_string())?;
                let normalized = validate_safe_entry_path(relative_path)?;
                let target = staging_dir.join(&normalized);
                if let Some(parent) = target.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|error| format!("gallery 资源目录创建失败：{error}"))?;
                }
                let content = bundled_gallery_asset(asset_path)
                    .ok_or_else(|| format!("gallery 资源不存在：{asset_path}"))?;
                fs::write(&target, content)
                    .map_err(|error| format!("gallery 资源写入失败：{error}"))?;
            }
            Ok(())
        },
        write_user_json_at,
    )?;

    Ok(PluginGalleryInstallResult {
        plugin_id: plugin_id.clone(),
        name: manifest
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or(&plugin_id)
            .to_string(),
        version: manifest
            .get("version")
            .and_then(Value::as_str)
            .unwrap_or("未知")
            .to_string(),
        installed_dir: format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}"),
    })
}

fn materialize_gallery_plugin_at(
    root: &Path,
    catalog_text: &str,
    catalog_id: &str,
) -> Result<PathBuf, String> {
    let catalog = load_plugin_gallery_catalog_from_text(catalog_text);
    if let Some(error) = catalog.error {
        return Err(error);
    }
    let item = catalog
        .items
        .into_iter()
        .find(|item| item.catalog.id == catalog_id)
        .ok_or_else(|| format!("本地插件中心不存在条目：{catalog_id}"))?;
    if !item.installable {
        return Err(item
            .error
            .unwrap_or_else(|| "该 gallery 插件资源不可用。".to_string()));
    }
    let asset_paths = gallery_plugin_asset_paths(&item.catalog.path)?;
    let source_directory = Path::new(&item.catalog.path)
        .parent()
        .and_then(Path::to_str)
        .ok_or_else(|| "gallery 插件目录无效。".to_string())?
        .to_string();
    let relative_target = format!("{PLUGIN_GALLERY_CACHE_DIR}/{catalog_id}");
    let target = resolve_user_relative_path(root, &relative_target)?;
    fs::create_dir_all(&target).map_err(|error| format!("gallery 示例目录创建失败：{error}"))?;
    for asset_path in asset_paths {
        let relative_path = asset_path
            .strip_prefix(&format!("{source_directory}/"))
            .ok_or_else(|| "gallery 资源路径越界。".to_string())?;
        let normalized = validate_safe_entry_path(relative_path)?;
        let output = target.join(normalized);
        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("gallery 示例资源目录创建失败：{error}"))?;
        }
        let content = bundled_gallery_asset(asset_path)
            .ok_or_else(|| format!("gallery 资源不存在：{asset_path}"))?;
        fs::write(output, content).map_err(|error| format!("gallery 示例资源写入失败：{error}"))?;
    }
    Ok(target)
}

fn open_directory_path(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer");
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = Command::new("xdg-open");

    command
        .arg(path)
        .spawn()
        .map_err(|error| format!("打开目录失败：{error}"))?;
    Ok(())
}

fn open_document_path(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = Command::new("notepad");
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = Command::new("xdg-open");

    command
        .arg(path)
        .spawn()
        .map_err(|error| format!("打开文档失败：{error}"))?;
    Ok(())
}

#[tauri::command]
fn get_plugin_gallery_catalog() -> PluginGalleryCatalogResult {
    load_plugin_gallery_catalog_from_text(PLUGIN_GALLERY_CATALOG)
}

#[tauri::command]
fn install_gallery_plugin(
    app: AppHandle,
    catalog_id: String,
    overwrite: bool,
    installed_at: String,
) -> Result<PluginGalleryInstallResult, String> {
    let root = ensure_user_data_root(&app)?;
    install_gallery_plugin_at(
        &root,
        PLUGIN_GALLERY_CATALOG,
        &catalog_id,
        overwrite,
        Some(&installed_at),
    )
}

#[tauri::command]
fn open_gallery_plugin_dir(app: AppHandle, catalog_id: String) -> Result<(), String> {
    let root = ensure_user_data_root(&app)?;
    let directory = materialize_gallery_plugin_at(&root, PLUGIN_GALLERY_CATALOG, &catalog_id)?;
    open_directory_path(&directory)
}

#[tauri::command]
fn open_plugin_development_docs(app: AppHandle) -> Result<(), String> {
    let root = ensure_user_data_root(&app)?;
    let relative_path = format!("{PLUGIN_GALLERY_CACHE_DIR}/plugin-development.md");
    let path = resolve_user_relative_path(&root, &relative_path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("插件开发文档目录创建失败：{error}"))?;
    }
    fs::write(&path, PLUGIN_DEVELOPMENT_DOC)
        .map_err(|error| format!("插件开发文档写入失败：{error}"))?;
    open_document_path(&path)
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
    open_directory_path(&root)
}

#[tauri::command]
fn open_user_data_subdir(app: AppHandle, relative_dir: String) -> Result<(), String> {
    let root = ensure_user_data_root(&app)?;
    let directory = resolve_user_relative_path(&root, &relative_dir)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Failed to create user subdirectory `{relative_dir}`: {error}"))?;
    open_directory_path(&directory)
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DevPluginProjectRequest {
    name: String,
    plugin_id: String,
    version: String,
    author: String,
    description: String,
    template_type: String,
    menu_location: String,
    generate_readme: bool,
    generate_entry: bool,
    #[serde(default)]
    overwrite: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DevPluginProjectResult {
    created: bool,
    overwritten: bool,
    plugin_id: String,
    plugin_type: String,
    runtime: Option<String>,
    directory_path: String,
    manifest_path: String,
    readme_path: Option<String>,
    entry_path: Option<String>,
    files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct DevPluginValidationIssue {
    code: String,
    field: Option<String>,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DevPluginValidationResult {
    valid: bool,
    errors: Vec<DevPluginValidationIssue>,
    warnings: Vec<DevPluginValidationIssue>,
    plugin_id: Option<String>,
    plugin_type: Option<String>,
    runtime: Option<String>,
    entry: Option<String>,
    permissions: Vec<String>,
    contribution_summary: BTreeMap<String, usize>,
    can_package: bool,
    project_dir: String,
    manifest_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DevPluginPackageResult {
    plugin_id: String,
    package_path: String,
    file_count: usize,
    files: Vec<String>,
    validation: DevPluginValidationResult,
}

struct DevPluginTemplate {
    manifest: Value,
    entry_name: Option<&'static str>,
    entry_content: Option<String>,
    readme: String,
}

fn validate_dev_plugin_id(plugin_id: &str) -> Result<(), String> {
    let plugin_id = plugin_id.trim();
    if plugin_id.is_empty() {
        return Err("pluginId 不能为空。".to_string());
    }
    if plugin_id.len() > 128 {
        return Err("pluginId 不能超过 128 个字符。".to_string());
    }
    if !is_safe_plugin_id(plugin_id)
        || plugin_id == "."
        || plugin_id == ".."
        || plugin_id.contains("..")
        || plugin_id.starts_with('.')
        || plugin_id.ends_with('.')
    {
        return Err(
            "pluginId 只能包含字母、数字、点、下划线和短横线，且不能包含路径、`..`、Windows ADS 或首尾点号。"
                .to_string(),
        );
    }
    let upper = plugin_id.to_ascii_uppercase();
    let base = upper.split('.').next().unwrap_or_default();
    let reserved = matches!(
        base,
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    );
    if reserved {
        return Err("pluginId 不能使用 Windows 保留设备名。".to_string());
    }
    Ok(())
}

fn dev_menu(id: &str, label: &str, location: &str, command: &str, when: &str) -> Value {
    json!({
        "id": id,
        "label": label,
        "location": location,
        "command": command,
        "when": when,
    })
}

fn create_dev_plugin_template(
    request: &DevPluginProjectRequest,
) -> Result<DevPluginTemplate, String> {
    validate_dev_plugin_id(&request.plugin_id)?;
    if request.name.trim().is_empty() {
        return Err("插件名称不能为空。".to_string());
    }
    if request.version.trim().is_empty() {
        return Err("version 不能为空。".to_string());
    }
    if request.author.trim().is_empty() {
        return Err("author 不能为空。".to_string());
    }
    if !DEV_PLUGIN_TEMPLATE_TYPES.contains(&request.template_type.as_str()) {
        return Err(format!(
            "不支持的插件模板：{}。支持：{}",
            request.template_type,
            DEV_PLUGIN_TEMPLATE_TYPES.join(", ")
        ));
    }
    if !DEV_PLUGIN_MENU_LOCATIONS.contains(&request.menu_location.as_str()) {
        return Err("菜单位置仅允许 plugins 或 node-context。".to_string());
    }

    let name = request.name.trim();
    let plugin_id = request.plugin_id.trim();
    let version = request.version.trim();
    let author = request.author.trim();
    let description = request.description.trim();
    let location = request.menu_location.as_str();
    let when = if location == "node-context" {
        "hasSelectedNode"
    } else {
        "hasMindmap"
    };
    let base = json!({
        "manifestVersion": 1,
        "pluginId": plugin_id,
        "name": name,
        "version": version,
        "author": author,
        "description": description,
    });
    let mut object = base
        .as_object()
        .cloned()
        .ok_or_else(|| "无法生成 manifest。".to_string())?;

    let (
        plugin_type,
        runtime,
        entry_name,
        entry_content,
        capabilities,
        permissions,
        contributions,
        workflow,
    ) = match request.template_type.as_str() {
        "import-export" => (
            "import-export",
            None,
            None,
            None,
            json!(["export"]),
            None,
            json!({
                "exporters": [{
                    "id": "exportText",
                    "label": format!("{name}：导出 TXT"),
                    "fileName": "mindmap.txt",
                    "handler": "builtin.exportText"
                }],
                "menus": [dev_menu(
                    "exportText",
                    &format!("{name}：导出 TXT"),
                    location,
                    "builtin.exportText",
                    when,
                )]
            }),
            None,
        ),
        "action-workflow" => (
            "action-workflow",
            None,
            None,
            None,
            json!([
                "workflow",
                "mindmap:read",
                "mindmap:write",
                "node:read",
                "node:write"
            ]),
            Some(json!([
                "mindmap:read",
                "mindmap:write",
                "node:read",
                "node:write"
            ])),
            json!({
                "menus": [dev_menu(
                    "runWorkflow",
                    &format!("运行 {name}"),
                    location,
                    "plugin.runWorkflow",
                    "hasSelectedNode",
                )]
            }),
            Some(json!({
                "name": format!("{name} Workflow"),
                "description": "展示受控 actions 与变量占位符。",
                "actions": [
                    {
                        "type": "showMessage",
                        "level": "info",
                        "message": "正在处理 $mindmap.title / $selectedNode.text（$date.today）"
                    },
                    {
                        "type": "addChildNodes",
                        "parentId": "$selectedNode.id",
                        "nodes": [
                            {"text": "$selectedNode.text - 子节点 1", "remark": "来自 $mindmap.title"},
                            {"text": "$selectedNode.text - 子节点 2", "remark": "创建日期：$date.today"},
                            {"text": "$selectedNode.text - 子节点 3", "remark": "本地 Workflow 生成"}
                        ]
                    },
                    {
                        "type": "setNodeRemark",
                        "nodeId": "$selectedNode.id",
                        "remark": "已由 Workflow 更新：$date.today"
                    }
                ]
            })),
        ),
        "script" => (
            "script",
            None,
            Some("main.js"),
            request.generate_entry.then(|| {
                r#"async function run(context) {
  const node = context.selectedNode;
  if (!node) {
    return [{
      type: "showMessage",
      level: "warning",
      message: "请先选择一个节点。"
    }];
  }

  return [
    {
      type: "addChildNodes",
      parentId: node.id,
      nodes: [
        { text: "示例子节点 1", remark: "由本地 Web Worker 插件生成" },
        { text: "示例子节点 2", remark: "不访问 DOM / window / fetch" },
        { text: "示例子节点 3", remark: "宿主会校验全部 actions" }
      ]
    },
    {
      type: "showMessage",
      level: "info",
      message: "已生成 3 个子节点。"
    }
  ];
}
"#
                .to_string()
            }),
            json!([
                "script",
                "mindmap:read",
                "mindmap:write",
                "node:read",
                "node:write"
            ]),
            Some(json!([
                "mindmap:read",
                "mindmap:write",
                "node:read",
                "node:write"
            ])),
            json!({
                "menus": [dev_menu(
                    "runScript",
                    &format!("运行 {name}"),
                    location,
                    "plugin.runScript",
                    "hasSelectedNode",
                )]
            }),
            None,
        ),
        "external-command-python" => (
            "external-command",
            Some("python"),
            Some("main.py"),
            request.generate_entry.then(|| {
                r#"import json
import sys

try:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


def main():
    context = json.load(sys.stdin)
    node = context.get("selectedNode")
    if not node:
        result = {"actions": [{
            "type": "showMessage",
            "level": "warning",
            "message": "请先选择一个节点。"
        }]}
    else:
        result = {"actions": [
            {
                "type": "addChildNodes",
                "parentId": node["id"],
                "nodes": [
                    {"text": "Python 子节点 1", "remark": "UTF-8 示例"},
                    {"text": "Python 子节点 2", "remark": "纯本地处理"},
                    {"text": "Python 子节点 3", "remark": "actions JSON"}
                ]
            },
            {
                "type": "showMessage",
                "level": "info",
                "message": "Python 插件执行完成。"
            }
        ]}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
"#
                .to_string()
            }),
            json!([
                "external-command",
                "mindmap:read",
                "mindmap:write",
                "node:read",
                "node:write"
            ]),
            Some(json!([
                "external-command",
                "mindmap:read",
                "mindmap:write",
                "node:read",
                "node:write"
            ])),
            json!({
                "menus": [dev_menu(
                    "runExternal",
                    &format!("运行 {name}"),
                    location,
                    "plugin.runExternal",
                    "hasSelectedNode",
                )]
            }),
            None,
        ),
        "external-command-executable" => (
            "external-command",
            Some("executable"),
            Some(default_executable_plugin_entry_name()),
            None,
            json!([
                "external-command",
                "mindmap:read",
                "mindmap:write",
                "node:read",
                "node:write"
            ]),
            Some(json!([
                "external-command",
                "mindmap:read",
                "mindmap:write",
                "node:read",
                "node:write"
            ])),
            json!({
                "menus": [dev_menu(
                    "runExternal",
                    &format!("运行 {name}"),
                    location,
                    "plugin.runExternal",
                    "hasSelectedNode",
                )]
            }),
            None,
        ),
        "theme-pack" => (
            "theme-pack",
            None,
            None,
            None,
            json!(["themes"]),
            None,
            json!({
                "themes": [{
                    "id": format!("{}.theme", plugin_id),
                    "name": format!("{name} 主题"),
                    "canvasBackground": "#f7f9fc",
                    "gridColor": "#d8e1ee",
                    "nodeBackground": "#eef5ff",
                    "nodeBorder": "#3973c6",
                    "nodeText": "#17365d",
                    "lineColor": "#7ca5d8"
                }]
            }),
            None,
        ),
        _ => unreachable!(),
    };

    object.insert("pluginType".to_string(), json!(plugin_type));
    if let Some(runtime) = runtime {
        object.insert("runtime".to_string(), json!(runtime));
    }
    if let Some(entry_name) = entry_name {
        object.insert("entry".to_string(), json!(entry_name));
    }
    object.insert("capabilities".to_string(), capabilities);
    if let Some(permissions) = permissions {
        object.insert("permissions".to_string(), permissions);
    }
    object.insert("contributions".to_string(), contributions);
    if let Some(workflow) = workflow {
        object.insert("workflow".to_string(), workflow);
    }
    let manifest = Value::Object(object);
    validate_declarative_manifest(plugin_id, &manifest)
        .map_err(|error| format!("生成的模板未通过 schema 校验：{error}"))?;

    let executable_note = if request.template_type == "external-command-executable" {
        format!("\n## executable 准备\n\n本向导不会生成真实原生二进制。请自行编译 `{}` 并放在本目录后再校验和打包。宿主不会通过 Shell 启动程序。\n", default_executable_plugin_entry_name())
    } else {
        String::new()
    };
    let readme = format!(
        "# {name}\n\n{description}\n\n- pluginId: `{plugin_id}`\n- pluginType: `{plugin_type}`\n{}\n## 本地安全边界\n\n项目位于本机用户数据目录；打包和安装均不联网。运行型插件只有在安装后、用户显式开启对应 runner 并授予信任时才能执行。\n{executable_note}",
        runtime
            .map(|value| format!("- runtime: `{value}`"))
            .unwrap_or_default()
    );

    Ok(DevPluginTemplate {
        manifest,
        entry_name,
        entry_content,
        readme,
    })
}

fn default_executable_plugin_entry_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "plugin.exe"
    } else {
        "plugin"
    }
}

fn dev_project_dir_at(root: &Path, plugin_id: &str) -> Result<PathBuf, String> {
    validate_dev_plugin_id(plugin_id)?;
    resolve_user_relative_path(root, &format!("{USER_PLUGIN_DEV_DIR}/{plugin_id}"))
}

fn create_dev_plugin_project_at(
    root: &Path,
    request: &DevPluginProjectRequest,
) -> Result<DevPluginProjectResult, String> {
    let template = create_dev_plugin_template(request)?;
    let plugin_id = request.plugin_id.trim();
    let dev_dir = plugin_dev_dir_at(root)?;
    fs::create_dir_all(&dev_dir).map_err(|error| format!("创建插件开发目录失败：{error}"))?;
    let target_dir = dev_project_dir_at(root, plugin_id)?;
    let existed = target_dir.exists();
    if existed && !request.overwrite {
        return Err(format!(
            "插件项目已存在：{}。未覆盖任何文件；确认覆盖后才能继续。",
            target_dir.display()
        ));
    }

    let staging_dir = dev_dir.join(format!(".{plugin_id}.creating"));
    let backup_dir = dev_dir.join(format!(".{plugin_id}.backup"));
    remove_path_if_exists(&staging_dir)?;
    remove_path_if_exists(&backup_dir)?;
    fs::create_dir(&staging_dir).map_err(|error| format!("创建插件项目临时目录失败：{error}"))?;

    let write_result = (|| -> Result<Vec<String>, String> {
        let manifest_text = serde_json::to_string_pretty(&template.manifest)
            .map_err(|error| format!("manifest 序列化失败：{error}"))?;
        fs::write(staging_dir.join(MANIFEST_FILE_NAME), manifest_text)
            .map_err(|error| format!("写入 manifest.json 失败：{error}"))?;
        let mut files = vec![MANIFEST_FILE_NAME.to_string()];

        if request.generate_readme {
            fs::write(staging_dir.join("README.md"), &template.readme)
                .map_err(|error| format!("写入 README.md 失败：{error}"))?;
            files.push("README.md".to_string());
        }
        if let (Some(entry_name), Some(entry_content)) =
            (template.entry_name, template.entry_content.as_deref())
        {
            fs::write(staging_dir.join(entry_name), entry_content)
                .map_err(|error| format!("写入示例 entry `{entry_name}` 失败：{error}"))?;
            files.push(entry_name.to_string());
        }

        if existed {
            fs::rename(&target_dir, &backup_dir)
                .map_err(|error| format!("备份已有插件项目失败：{error}"))?;
        }
        if let Err(error) = fs::rename(&staging_dir, &target_dir) {
            if existed && backup_dir.exists() {
                let _ = fs::rename(&backup_dir, &target_dir);
            }
            return Err(format!("提交插件项目失败：{error}"));
        }
        if backup_dir.exists() {
            remove_path_if_exists(&backup_dir)
                .map_err(|error| format!("清理旧插件项目备份失败：{error}"))?;
        }
        files.sort();
        Ok(files)
    })();

    let files = match write_result {
        Ok(files) => files,
        Err(error) => {
            let _ = remove_path_if_exists(&staging_dir);
            if existed && backup_dir.exists() && !target_dir.exists() {
                let _ = fs::rename(&backup_dir, &target_dir);
            }
            return Err(error);
        }
    };
    let plugin_type = template
        .manifest
        .get("pluginType")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let runtime = template
        .manifest
        .get("runtime")
        .and_then(Value::as_str)
        .map(str::to_string);
    let entry_path = template.entry_name.and_then(|entry_name| {
        target_dir
            .join(entry_name)
            .is_file()
            .then(|| target_dir.join(entry_name).to_string_lossy().to_string())
    });

    Ok(DevPluginProjectResult {
        created: true,
        overwritten: existed,
        plugin_id: plugin_id.to_string(),
        plugin_type,
        runtime,
        directory_path: target_dir.to_string_lossy().to_string(),
        manifest_path: target_dir
            .join(MANIFEST_FILE_NAME)
            .to_string_lossy()
            .to_string(),
        readme_path: target_dir
            .join("README.md")
            .is_file()
            .then(|| target_dir.join("README.md").to_string_lossy().to_string()),
        entry_path,
        files,
    })
}

fn validation_issue(
    code: &str,
    field: Option<&str>,
    message: impl Into<String>,
) -> DevPluginValidationIssue {
    DevPluginValidationIssue {
        code: code.to_string(),
        field: field.map(str::to_string),
        message: message.into(),
    }
}

fn push_unique_issue(issues: &mut Vec<DevPluginValidationIssue>, issue: DevPluginValidationIssue) {
    if !issues
        .iter()
        .any(|current| current.message == issue.message)
    {
        issues.push(issue);
    }
}

fn manifest_string_array(manifest: &Value, field: &str) -> Vec<String> {
    manifest
        .get(field)
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

fn contribution_summary(manifest: &Value) -> BTreeMap<String, usize> {
    let mut summary = BTreeMap::new();
    let contributions = manifest.get("contributions").and_then(Value::as_object);
    for key in [
        "exporters",
        "exportFormats",
        "menus",
        "themes",
        "icons",
        "nodeTypes",
        "nodeTypePacks",
        "templatePacks",
        "tools",
    ] {
        let count = contributions
            .and_then(|value| value.get(key))
            .and_then(Value::as_array)
            .map(Vec::len)
            .unwrap_or(0);
        summary.insert(key.to_string(), count);
    }
    summary
}

fn validate_dev_contribution_commands(
    manifest: &Value,
    errors: &mut Vec<DevPluginValidationIssue>,
) {
    let Some(contributions) = manifest.get("contributions").and_then(Value::as_object) else {
        return;
    };
    for group in ["menus", "tools"] {
        let Some(items) = contributions.get(group).and_then(Value::as_array) else {
            continue;
        };
        for (index, item) in items.iter().enumerate() {
            for field in ["command", "handler"] {
                let Some(command) = item.get(field).and_then(Value::as_str) else {
                    continue;
                };
                if !PLUGIN_COMMAND_WHITELIST.contains(&command) {
                    push_unique_issue(
                        errors,
                        validation_issue(
                            "command-not-allowed",
                            Some(&format!("contributions.{group}[{index}].{field}")),
                            format!("command 不在白名单：{command}"),
                        ),
                    );
                }
            }
        }
    }
    if let Some(exporters) = contributions.get("exporters").and_then(Value::as_array) {
        for (index, exporter) in exporters.iter().enumerate() {
            let handler = exporter
                .get("handler")
                .or_else(|| exporter.get("handlerId"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            if handler != "builtin.exportText" {
                push_unique_issue(
                    errors,
                    validation_issue(
                        "command-not-allowed",
                        Some(&format!("contributions.exporters[{index}].handler")),
                        format!("导出 handler 不在白名单：{handler}"),
                    ),
                );
            }
        }
    }
}

fn validate_dev_permissions(
    plugin_type: &str,
    permissions: &[String],
    errors: &mut Vec<DevPluginValidationIssue>,
    warnings: &mut Vec<DevPluginValidationIssue>,
) {
    let has = |permission: &str| permissions.iter().any(|value| value == permission);
    match plugin_type {
        "script" => {
            if has("external-command") {
                errors.push(validation_issue(
                    "permission-type-mismatch",
                    Some("permissions"),
                    "script 插件不能声明 external-command 权限。",
                ));
            }
            for permission in ["mindmap:read", "mindmap:write", "node:read", "node:write"] {
                if !has(permission) {
                    warnings.push(validation_issue(
                        "permission-missing",
                        Some("permissions"),
                        format!("script 模板建议声明 {permission}。"),
                    ));
                }
            }
        }
        "action-workflow" => {
            for permission in ["script", "external-command"] {
                if has(permission) {
                    errors.push(validation_issue(
                        "permission-type-mismatch",
                        Some("permissions"),
                        format!("action-workflow 插件不能声明 {permission} 权限。"),
                    ));
                }
            }
        }
        "external-command" => {
            if !has("external-command") {
                errors.push(validation_issue(
                    "permission-missing",
                    Some("permissions"),
                    "external-command 插件必须声明 external-command 权限。",
                ));
            }
            if has("script") {
                errors.push(validation_issue(
                    "permission-type-mismatch",
                    Some("permissions"),
                    "external-command 插件不能声明 script 权限。",
                ));
            }
        }
        _ => {
            if !permissions.is_empty() {
                errors.push(validation_issue(
                    "permission-type-mismatch",
                    Some("permissions"),
                    format!("{plugin_type} 声明式插件不应请求运行型权限。"),
                ));
            }
        }
    }
}

fn validate_dev_plugin_project_at(root: &Path, plugin_id: &str) -> DevPluginValidationResult {
    let project_dir = root.join(USER_PLUGIN_DEV_DIR).join(plugin_id);
    let manifest_path = project_dir.join(MANIFEST_FILE_NAME);
    let mut result = DevPluginValidationResult {
        valid: false,
        errors: vec![],
        warnings: vec![],
        plugin_id: None,
        plugin_type: None,
        runtime: None,
        entry: None,
        permissions: vec![],
        contribution_summary: BTreeMap::new(),
        can_package: false,
        project_dir: project_dir.to_string_lossy().to_string(),
        manifest_path: manifest_path.to_string_lossy().to_string(),
    };

    if let Err(error) = validate_dev_plugin_id(plugin_id) {
        result.errors.push(validation_issue(
            "invalid-plugin-id",
            Some("pluginId"),
            error,
        ));
        return result;
    }
    let project_dir = match dev_project_dir_at(root, plugin_id) {
        Ok(path) => path,
        Err(error) => {
            result
                .errors
                .push(validation_issue("invalid-project-path", None, error));
            return result;
        }
    };
    if !project_dir.is_dir() {
        result.errors.push(validation_issue(
            "project-missing",
            None,
            format!("插件项目目录不存在：{}", project_dir.display()),
        ));
        return result;
    }
    if !manifest_path.is_file() {
        result.errors.push(validation_issue(
            "manifest-missing",
            Some("manifest.json"),
            "manifest.json 不存在。",
        ));
        return result;
    }

    let manifest_text = match fs::read_to_string(&manifest_path) {
        Ok(text) => text,
        Err(error) => {
            result.errors.push(validation_issue(
                "manifest-read-failed",
                Some("manifest.json"),
                format!("manifest.json 不是有效 UTF-8 或无法读取：{error}"),
            ));
            return result;
        }
    };
    let manifest: Value = match parse_json_without_bom(&manifest_text) {
        Ok(value) => value,
        Err(error) => {
            result.errors.push(validation_issue(
                "manifest-json-invalid",
                Some("manifest.json"),
                format!("manifest JSON 无效：{error}"),
            ));
            return result;
        }
    };
    let Some(object) = manifest.as_object() else {
        result.errors.push(validation_issue(
            "manifest-schema-invalid",
            Some("manifest.json"),
            "manifest 必须是 JSON 对象。",
        ));
        return result;
    };

    result.plugin_id = object
        .get("pluginId")
        .and_then(Value::as_str)
        .map(str::to_string);
    result.plugin_type = object
        .get("pluginType")
        .and_then(Value::as_str)
        .map(str::to_string);
    result.runtime = object
        .get("runtime")
        .and_then(Value::as_str)
        .map(str::to_string);
    result.entry = object
        .get("entry")
        .and_then(Value::as_str)
        .map(str::to_string);
    result.permissions = manifest_string_array(&manifest, "permissions");
    result.contribution_summary = contribution_summary(&manifest);

    if result.plugin_id.as_deref() != Some(plugin_id) {
        result.errors.push(validation_issue(
            "plugin-id-mismatch",
            Some("pluginId"),
            format!(
                "manifest pluginId 必须与项目目录一致：期望 {plugin_id}，实际 {}。",
                result.plugin_id.as_deref().unwrap_or("未声明")
            ),
        ));
    }
    if let Some(manifest_plugin_id) = result.plugin_id.as_deref() {
        if let Err(error) = validate_dev_plugin_id(manifest_plugin_id) {
            result.errors.push(validation_issue(
                "invalid-plugin-id",
                Some("pluginId"),
                error,
            ));
        }
    }
    if let Err(error) = validate_declarative_manifest(plugin_id, &manifest) {
        result.errors.push(validation_issue(
            "manifest-schema-invalid",
            Some("manifest.json"),
            error,
        ));
    }
    validate_dev_contribution_commands(&manifest, &mut result.errors);

    let plugin_type = result.plugin_type.as_deref().unwrap_or_default();
    validate_dev_permissions(
        plugin_type,
        &result.permissions,
        &mut result.errors,
        &mut result.warnings,
    );
    if let Some(entry) = result.entry.as_deref() {
        match validate_safe_entry_path(entry) {
            Ok(normalized_entry) => {
                if plugin_type == "script" && normalized_entry != "main.js" {
                    result.errors.push(validation_issue(
                        "script-entry-invalid",
                        Some("entry"),
                        "开发者工作台的 script 模板 entry 必须是 main.js。",
                    ));
                }
                if plugin_type == "external-command"
                    && result.runtime.as_deref() == Some("python")
                    && normalized_entry != "main.py"
                {
                    result.errors.push(validation_issue(
                        "python-entry-invalid",
                        Some("entry"),
                        "开发者工作台的 Python 模板 entry 必须是 main.py。",
                    ));
                }
                if plugin_type == "external-command"
                    && result.runtime.as_deref() == Some("executable")
                    && external_executable_entry_error_for_platform(&normalized_entry, cfg!(target_os = "windows")).is_some()
                {
                    result.errors.push(validation_issue(
                        "executable-entry-invalid",
                        Some("entry"),
                        external_executable_entry_error_for_platform(&normalized_entry, cfg!(target_os = "windows"))
                            .expect("executable entry error should be present"),
                    ));
                }
                let entry_path = project_dir.join(Path::new(&normalized_entry));
                if !entry_path.is_file() {
                    result.errors.push(validation_issue(
                        "entry-missing",
                        Some("entry"),
                        format!("待补充 entry 文件：{normalized_entry}。entry 缺失时不可打包。"),
                    ));
                }
            }
            Err(error) => {
                result
                    .errors
                    .push(validation_issue("entry-path-invalid", Some("entry"), error))
            }
        }
    } else if plugin_type == "script" || plugin_type == "external-command" {
        result.errors.push(validation_issue(
            "entry-missing",
            Some("entry"),
            "运行型插件必须声明 entry。",
        ));
    }

    if !project_dir.join("README.md").is_file() {
        result.warnings.push(validation_issue(
            "readme-missing",
            Some("README.md"),
            "README.md 不存在；这不会阻止打包。",
        ));
    }
    for field in ["trusted", "installedAt", "updatedAt", "enabled"] {
        if object.contains_key(field) {
            result.warnings.push(validation_issue(
                "registry-metadata-present",
                Some(field),
                format!("{field} 属于安装/registry 元数据，打包时会移除。"),
            ));
        }
    }
    let (risk, risk_message) = match (plugin_type, result.runtime.as_deref()) {
        ("external-command", Some("executable")) => (
            "high",
            "风险等级：高。executable 在安装并启用 runner 后可能访问本机资源。",
        ),
        ("external-command", _) => (
            "high",
            "风险等级：高。Python 外部进程在安装并启用 runner 后可能访问本机资源。",
        ),
        ("script", _) => (
            "medium",
            "风险等级：中。script 仅在 Web Worker 中运行并返回受控 actions。",
        ),
        ("action-workflow", _) => (
            "medium",
            "风险等级：中。Workflow 不执行代码，但可返回写入 actions。",
        ),
        _ => ("low", "风险等级：低。该模板不执行插件代码。"),
    };
    result.warnings.push(validation_issue(
        &format!("plugin-risk-{risk}"),
        Some("pluginType"),
        risk_message,
    ));

    result.valid = result.errors.is_empty();
    result.can_package = result.valid;
    result
}

fn should_exclude_dev_package_path(relative_path: &str, is_dir: bool) -> bool {
    let lower = relative_path.to_ascii_lowercase();
    let segments = lower.split('/').collect::<Vec<_>>();
    if segments
        .iter()
        .any(|segment| matches!(*segment, "node_modules" | ".git" | "logs"))
    {
        return true;
    }
    if is_dir {
        return false;
    }
    let file_name = segments.last().copied().unwrap_or_default();
    matches!(
        file_name,
        "plugin-registry.json"
            | "desktop-plugin-registry.json"
            | ".ds_store"
            | "thumbs.db"
            | "trusted"
    ) || file_name.ends_with(".tmp")
        || file_name.ends_with(".temp")
        || file_name.ends_with(".log")
        || file_name.ends_with(".lmplugin")
        || file_name.ends_with('~')
}

fn collect_dev_package_files(
    project_dir: &Path,
    current_dir: &Path,
    files: &mut Vec<(String, PathBuf)>,
    total_size: &mut u64,
) -> Result<(), String> {
    let mut entries = fs::read_dir(current_dir)
        .map_err(|error| format!("打包失败：读取项目目录失败：{error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("打包失败：读取项目目录项失败：{error}"))?;
    entries.sort_by_key(|entry| entry.file_name());

    for entry in entries {
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| format!("打包失败：读取资源元数据失败：{error}"))?;
        if metadata_is_link_like(&metadata) {
            return Err(format!(
                "打包失败：项目内不允许符号链接或重解析点：{}",
                path.display()
            ));
        }
        let relative = path
            .strip_prefix(project_dir)
            .map_err(|_| "打包失败：项目资源越过项目目录。".to_string())?;
        let relative_name = relative
            .components()
            .map(|component| match component {
                Component::Normal(value) => Ok(value.to_string_lossy().to_string()),
                _ => Err("打包失败：资源路径包含非法组件。".to_string()),
            })
            .collect::<Result<Vec<_>, _>>()?
            .join("/");
        validate_plugin_package_entry_name(&relative_name, metadata.is_dir())
            .map_err(|error| format!("打包失败：{error}"))?;
        if should_exclude_dev_package_path(&relative_name, metadata.is_dir()) {
            continue;
        }
        if metadata.is_dir() {
            collect_dev_package_files(project_dir, &path, files, total_size)?;
            continue;
        }
        if !metadata.is_file() {
            return Err(format!("打包失败：不支持的资源类型：{relative_name}"));
        }
        if relative_name == MANIFEST_FILE_NAME {
            continue;
        }
        if metadata.len() > PLUGIN_PACKAGE_MAX_FILE_SIZE {
            return Err(format!("打包失败：文件过大：{relative_name}"));
        }
        *total_size = total_size.saturating_add(metadata.len());
        if *total_size > PLUGIN_PACKAGE_MAX_TOTAL_SIZE {
            return Err("打包失败：项目文件总大小超过 128MB。".to_string());
        }
        files.push((relative_name, path));
        if files.len() + 1 > PLUGIN_PACKAGE_MAX_ENTRIES {
            return Err(format!(
                "打包失败：文件数量超过 {} 个限制。",
                PLUGIN_PACKAGE_MAX_ENTRIES
            ));
        }
    }
    Ok(())
}

fn build_dev_plugin_package_at(
    root: &Path,
    plugin_id: &str,
    output_path: &Path,
) -> Result<DevPluginPackageResult, String> {
    let validation = validate_dev_plugin_project_at(root, plugin_id);
    if !validation.can_package {
        let details = validation
            .errors
            .iter()
            .map(|issue| issue.message.as_str())
            .collect::<Vec<_>>()
            .join("；");
        return Err(format!("项目校验未通过，禁止打包：{details}"));
    }
    let project_dir = dev_project_dir_at(root, plugin_id)?;
    let manifest_text = fs::read_to_string(project_dir.join(MANIFEST_FILE_NAME))
        .map_err(|error| format!("打包失败：manifest.json 读取失败：{error}"))?;
    let manifest: Value = parse_json_without_bom(&manifest_text)
        .map_err(|error| format!("打包失败：manifest JSON 无效：{error}"))?;
    let package_manifest = manifest_without_registry_metadata(&manifest);

    let mut project_files = vec![];
    let mut total_size = 0u64;
    collect_dev_package_files(
        &project_dir,
        &project_dir,
        &mut project_files,
        &mut total_size,
    )?;
    project_files.sort_by(|left, right| left.0.cmp(&right.0));

    let temporary_path = output_path.with_extension("lmplugin.tmp");
    let backup_path = output_path.with_extension("lmplugin.backup");
    if backup_path.exists() {
        if output_path.exists() {
            remove_path_if_exists(&backup_path)?;
        } else {
            fs::rename(&backup_path, output_path)
                .map_err(|error| format!("打包失败：恢复上次输出备份失败：{error}"))?;
        }
    }
    remove_path_if_exists(&temporary_path)?;
    let write_result = (|| -> Result<(), String> {
        let file = fs::File::create(&temporary_path)
            .map_err(|error| format!("打包失败：无法创建临时插件包：{error}"))?;
        let mut writer = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        writer
            .start_file(MANIFEST_FILE_NAME, options)
            .map_err(|error| format!("打包失败：无法写入 manifest.json：{error}"))?;
        writer
            .write_all(
                serde_json::to_string_pretty(&package_manifest)
                    .map_err(|error| format!("打包失败：manifest 序列化失败：{error}"))?
                    .as_bytes(),
            )
            .map_err(|error| format!("打包失败：manifest 写入失败：{error}"))?;

        for (relative_name, source_path) in &project_files {
            writer
                .start_file(relative_name, options)
                .map_err(|error| format!("打包失败：资源 `{relative_name}` 写入失败：{error}"))?;
            let mut source = fs::File::open(source_path)
                .map_err(|error| format!("打包失败：资源 `{relative_name}` 读取失败：{error}"))?;
            std::io::copy(&mut source, &mut writer)
                .map_err(|error| format!("打包失败：资源 `{relative_name}` 写入失败：{error}"))?;
        }
        writer
            .finish()
            .map_err(|error| format!("打包失败：插件包收尾失败：{error}"))?;
        Ok(())
    })();
    if let Err(error) = write_result {
        let _ = remove_path_if_exists(&temporary_path);
        return Err(error);
    }

    if let Err(error) = inspect_plugin_package(&temporary_path) {
        let _ = remove_path_if_exists(&temporary_path);
        return Err(format!("打包结果无法通过现有导入校验：{error}"));
    }
    let output_existed = output_path.exists();
    if output_existed {
        fs::rename(output_path, &backup_path)
            .map_err(|error| format!("打包失败：无法备份已有目标文件：{error}"))?;
    }
    if let Err(error) = fs::rename(&temporary_path, output_path) {
        let _ = remove_path_if_exists(&temporary_path);
        if output_existed && backup_path.exists() {
            let _ = fs::rename(&backup_path, output_path);
        }
        return Err(format!("打包失败：无法提交插件包：{error}"));
    }
    if backup_path.exists() {
        let _ = remove_path_if_exists(&backup_path);
    }
    let mut files = vec![MANIFEST_FILE_NAME.to_string()];
    files.extend(project_files.into_iter().map(|(name, _)| name));

    Ok(DevPluginPackageResult {
        plugin_id: plugin_id.to_string(),
        package_path: output_path.to_string_lossy().to_string(),
        file_count: files.len(),
        files,
        validation,
    })
}

fn desktop_directory() -> Option<PathBuf> {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)?;
    let desktop = home.join("Desktop");
    desktop.is_dir().then_some(desktop)
}

#[tauri::command]
fn create_dev_plugin_project(
    app: AppHandle,
    request: DevPluginProjectRequest,
) -> Result<DevPluginProjectResult, String> {
    let root = ensure_user_data_root(&app)?;
    create_dev_plugin_project_at(&root, &request)
}

#[tauri::command]
fn validate_dev_plugin_project(
    app: AppHandle,
    plugin_id: String,
) -> Result<DevPluginValidationResult, String> {
    let root = ensure_user_data_root(&app)?;
    Ok(validate_dev_plugin_project_at(&root, plugin_id.trim()))
}

#[tauri::command]
fn build_dev_plugin_package(
    app: AppHandle,
    plugin_id: String,
) -> Result<Option<DevPluginPackageResult>, String> {
    validate_dev_plugin_id(&plugin_id)?;
    let mut dialog = FileDialog::new()
        .set_title("打包开发插件")
        .set_file_name(format!("{plugin_id}.lmplugin"))
        .add_filter("Local Mindmap plugin", &["lmplugin"]);
    if let Some(desktop) = desktop_directory() {
        dialog = dialog.set_directory(desktop);
    }
    let Some(mut path) = dialog.save_file() else {
        return Ok(None);
    };
    if !path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("lmplugin"))
    {
        path.set_extension("lmplugin");
    }
    let root = ensure_user_data_root(&app)?;
    build_dev_plugin_package_at(&root, &plugin_id, &path).map(Some)
}

#[tauri::command]
fn open_dev_plugin_project_dir(app: AppHandle, plugin_id: String) -> Result<(), String> {
    let root = ensure_user_data_root(&app)?;
    let project_dir = dev_project_dir_at(&root, &plugin_id)?;
    if !project_dir.is_dir() {
        return Err(format!("插件项目目录不存在：{}", project_dir.display()));
    }
    open_directory_path(&project_dir)
}

#[tauri::command]
fn open_plugin_examples_dir(app: AppHandle) -> Result<(), String> {
    let root = ensure_user_data_root(&app)?;
    let catalog = load_plugin_gallery_catalog_from_text(PLUGIN_GALLERY_CATALOG);
    if let Some(error) = catalog.error {
        return Err(format!("示例插件 catalog 无效：{error}"));
    }
    for item in catalog.items {
        materialize_gallery_plugin_at(&root, PLUGIN_GALLERY_CATALOG, &item.catalog.id)?;
    }
    let gallery_dir = resolve_user_relative_path(&root, PLUGIN_GALLERY_CACHE_DIR)?;
    open_directory_path(&gallery_dir)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SamplePluginCreationResult {
    created: bool,
    directory_path: String,
    manifest_path: String,
    readme_path: String,
    main_path: Option<String>,
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
        main_path: None,
    }
}

fn sample_script_plugin_creation_result(root: &Path, created: bool) -> SamplePluginCreationResult {
    let directory = root
        .join(USER_PLUGIN_DEV_DIR)
        .join(SAMPLE_SCRIPT_PLUGIN_DIR_NAME);
    SamplePluginCreationResult {
        created,
        directory_path: directory.to_string_lossy().to_string(),
        manifest_path: directory
            .join(MANIFEST_FILE_NAME)
            .to_string_lossy()
            .to_string(),
        readme_path: directory.join("README.md").to_string_lossy().to_string(),
        main_path: Some(directory.join("main.js").to_string_lossy().to_string()),
    }
}

fn sample_batch_script_plugin_creation_result(
    root: &Path,
    created: bool,
) -> SamplePluginCreationResult {
    let directory = root
        .join(USER_PLUGIN_DEV_DIR)
        .join(SAMPLE_BATCH_SCRIPT_PLUGIN_DIR_NAME);
    SamplePluginCreationResult {
        created,
        directory_path: directory.to_string_lossy().to_string(),
        manifest_path: directory
            .join(MANIFEST_FILE_NAME)
            .to_string_lossy()
            .to_string(),
        readme_path: directory.join("README.md").to_string_lossy().to_string(),
        main_path: Some(directory.join("main.js").to_string_lossy().to_string()),
    }
}

fn sample_workflow_plugin_creation_result(
    root: &Path,
    created: bool,
) -> SamplePluginCreationResult {
    let directory = root
        .join(USER_PLUGIN_DEV_DIR)
        .join(SAMPLE_WORKFLOW_PLUGIN_DIR_NAME);
    SamplePluginCreationResult {
        created,
        directory_path: directory.to_string_lossy().to_string(),
        manifest_path: directory
            .join(MANIFEST_FILE_NAME)
            .to_string_lossy()
            .to_string(),
        readme_path: directory.join("README.md").to_string_lossy().to_string(),
        main_path: None,
    }
}

fn sample_python_plugin_creation_result(root: &Path, created: bool) -> SamplePluginCreationResult {
    let directory = root
        .join(USER_PLUGIN_DEV_DIR)
        .join(SAMPLE_PYTHON_PLUGIN_DIR_NAME);
    SamplePluginCreationResult {
        created,
        directory_path: directory.to_string_lossy().to_string(),
        manifest_path: directory
            .join(MANIFEST_FILE_NAME)
            .to_string_lossy()
            .to_string(),
        readme_path: directory.join("README.md").to_string_lossy().to_string(),
        main_path: Some(directory.join("main.py").to_string_lossy().to_string()),
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

fn create_sample_script_plugin_at(root: &Path) -> Result<SamplePluginCreationResult, String> {
    let manifest: Value = serde_json::from_str(SAMPLE_SCRIPT_PLUGIN_MANIFEST)
        .map_err(|error| format!("Bundled sample script plugin manifest is invalid: {error}"))?;
    validate_declarative_manifest(SAMPLE_SCRIPT_PLUGIN_ID, &manifest)
        .map_err(|error| format!("Bundled sample script plugin validation failed: {error}"))?;

    let dev_dir = plugin_dev_dir_at(root)?;
    fs::create_dir_all(&dev_dir)
        .map_err(|error| format!("Failed to create plugin development directory: {error}"))?;
    let target_dir = dev_dir.join(SAMPLE_SCRIPT_PLUGIN_DIR_NAME);
    if target_dir.exists() {
        return Ok(sample_script_plugin_creation_result(root, false));
    }

    let staging_dir = dev_dir.join(format!(".{SAMPLE_SCRIPT_PLUGIN_DIR_NAME}.creating"));
    remove_path_if_exists(&staging_dir)?;
    fs::create_dir_all(&staging_dir).map_err(|error| {
        format!("Failed to create sample script plugin staging directory: {error}")
    })?;

    let write_result = (|| {
        fs::write(
            staging_dir.join(MANIFEST_FILE_NAME),
            SAMPLE_SCRIPT_PLUGIN_MANIFEST,
        )
        .map_err(|error| format!("Failed to write sample script plugin manifest: {error}"))?;
        fs::write(staging_dir.join("main.js"), SAMPLE_SCRIPT_PLUGIN_MAIN)
            .map_err(|error| format!("Failed to write sample script plugin main.js: {error}"))?;
        fs::write(staging_dir.join("README.md"), SAMPLE_SCRIPT_PLUGIN_README)
            .map_err(|error| format!("Failed to write sample script plugin README: {error}"))?;
        fs::rename(&staging_dir, &target_dir)
            .map_err(|error| format!("Failed to commit sample script plugin directory: {error}"))
    })();

    if let Err(error) = write_result {
        let _ = remove_path_if_exists(&staging_dir);
        return Err(error);
    }

    Ok(sample_script_plugin_creation_result(root, true))
}

fn create_sample_batch_script_plugin_at(root: &Path) -> Result<SamplePluginCreationResult, String> {
    let manifest: Value = serde_json::from_str(SAMPLE_BATCH_SCRIPT_PLUGIN_MANIFEST)
        .map_err(|error| format!("Bundled batch script manifest is invalid: {error}"))?;
    validate_declarative_manifest(SAMPLE_BATCH_SCRIPT_PLUGIN_ID, &manifest)
        .map_err(|error| format!("Bundled batch script validation failed: {error}"))?;

    let dev_dir = plugin_dev_dir_at(root)?;
    fs::create_dir_all(&dev_dir)
        .map_err(|error| format!("Failed to create plugin development directory: {error}"))?;
    let target_dir = dev_dir.join(SAMPLE_BATCH_SCRIPT_PLUGIN_DIR_NAME);
    if target_dir.exists() {
        return Ok(sample_batch_script_plugin_creation_result(root, false));
    }

    let staging_dir = dev_dir.join(format!(".{SAMPLE_BATCH_SCRIPT_PLUGIN_DIR_NAME}.creating"));
    remove_path_if_exists(&staging_dir)?;
    fs::create_dir_all(&staging_dir)
        .map_err(|error| format!("Failed to create batch script staging directory: {error}"))?;

    let write_result = (|| {
        fs::write(
            staging_dir.join(MANIFEST_FILE_NAME),
            SAMPLE_BATCH_SCRIPT_PLUGIN_MANIFEST,
        )
        .map_err(|error| format!("Failed to write batch script manifest: {error}"))?;
        fs::write(staging_dir.join("main.js"), SAMPLE_BATCH_SCRIPT_PLUGIN_MAIN)
            .map_err(|error| format!("Failed to write batch script main.js: {error}"))?;
        fs::write(
            staging_dir.join("README.md"),
            SAMPLE_BATCH_SCRIPT_PLUGIN_README,
        )
        .map_err(|error| format!("Failed to write batch script README: {error}"))?;
        fs::rename(&staging_dir, &target_dir)
            .map_err(|error| format!("Failed to commit batch script directory: {error}"))
    })();

    if let Err(error) = write_result {
        let _ = remove_path_if_exists(&staging_dir);
        return Err(error);
    }

    Ok(sample_batch_script_plugin_creation_result(root, true))
}

fn create_sample_workflow_plugin_at(root: &Path) -> Result<SamplePluginCreationResult, String> {
    let manifest: Value = serde_json::from_str(SAMPLE_WORKFLOW_PLUGIN_MANIFEST)
        .map_err(|error| format!("Bundled workflow manifest is invalid: {error}"))?;
    validate_declarative_manifest(SAMPLE_WORKFLOW_PLUGIN_ID, &manifest)
        .map_err(|error| format!("Bundled workflow validation failed: {error}"))?;

    let dev_dir = plugin_dev_dir_at(root)?;
    fs::create_dir_all(&dev_dir)
        .map_err(|error| format!("Failed to create plugin development directory: {error}"))?;
    let target_dir = dev_dir.join(SAMPLE_WORKFLOW_PLUGIN_DIR_NAME);
    if target_dir.exists() {
        return Ok(sample_workflow_plugin_creation_result(root, false));
    }

    let staging_dir = dev_dir.join(format!(".{SAMPLE_WORKFLOW_PLUGIN_DIR_NAME}.creating"));
    remove_path_if_exists(&staging_dir)?;
    fs::create_dir_all(&staging_dir)
        .map_err(|error| format!("Failed to create workflow staging directory: {error}"))?;

    let write_result = (|| {
        fs::write(
            staging_dir.join(MANIFEST_FILE_NAME),
            SAMPLE_WORKFLOW_PLUGIN_MANIFEST,
        )
        .map_err(|error| format!("Failed to write workflow manifest: {error}"))?;
        fs::write(staging_dir.join("README.md"), SAMPLE_WORKFLOW_PLUGIN_README)
            .map_err(|error| format!("Failed to write workflow README: {error}"))?;
        fs::rename(&staging_dir, &target_dir)
            .map_err(|error| format!("Failed to commit workflow directory: {error}"))
    })();

    if let Err(error) = write_result {
        let _ = remove_path_if_exists(&staging_dir);
        return Err(error);
    }

    Ok(sample_workflow_plugin_creation_result(root, true))
}

fn create_sample_python_plugin_at(root: &Path) -> Result<SamplePluginCreationResult, String> {
    let manifest: Value = serde_json::from_str(SAMPLE_PYTHON_PLUGIN_MANIFEST)
        .map_err(|error| format!("Bundled Python plugin manifest is invalid: {error}"))?;
    validate_declarative_manifest(SAMPLE_PYTHON_PLUGIN_ID, &manifest)
        .map_err(|error| format!("Bundled Python plugin validation failed: {error}"))?;

    let dev_dir = plugin_dev_dir_at(root)?;
    fs::create_dir_all(&dev_dir)
        .map_err(|error| format!("Failed to create plugin development directory: {error}"))?;
    let target_dir = dev_dir.join(SAMPLE_PYTHON_PLUGIN_DIR_NAME);
    if target_dir.exists() {
        return Ok(sample_python_plugin_creation_result(root, false));
    }

    let staging_dir = dev_dir.join(format!(".{SAMPLE_PYTHON_PLUGIN_DIR_NAME}.creating"));
    remove_path_if_exists(&staging_dir)?;
    fs::create_dir_all(&staging_dir)
        .map_err(|error| format!("Failed to create Python plugin staging directory: {error}"))?;

    let write_result = (|| {
        fs::write(
            staging_dir.join(MANIFEST_FILE_NAME),
            SAMPLE_PYTHON_PLUGIN_MANIFEST,
        )
        .map_err(|error| format!("Failed to write Python plugin manifest: {error}"))?;
        fs::write(staging_dir.join("main.py"), SAMPLE_PYTHON_PLUGIN_MAIN)
            .map_err(|error| format!("Failed to write Python plugin main.py: {error}"))?;
        fs::write(staging_dir.join("README.md"), SAMPLE_PYTHON_PLUGIN_README)
            .map_err(|error| format!("Failed to write Python plugin README: {error}"))?;
        fs::rename(&staging_dir, &target_dir)
            .map_err(|error| format!("Failed to commit Python plugin directory: {error}"))
    })();

    if let Err(error) = write_result {
        let _ = remove_path_if_exists(&staging_dir);
        return Err(error);
    }

    Ok(sample_python_plugin_creation_result(root, true))
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

#[tauri::command]
fn create_sample_script_plugin(app: AppHandle) -> Result<SamplePluginCreationResult, String> {
    let root = ensure_user_data_root(&app)?;
    create_sample_script_plugin_at(&root)
}

#[tauri::command]
fn create_sample_batch_script_plugin(app: AppHandle) -> Result<SamplePluginCreationResult, String> {
    let root = ensure_user_data_root(&app)?;
    create_sample_batch_script_plugin_at(&root)
}

#[tauri::command]
fn create_sample_workflow_plugin(app: AppHandle) -> Result<SamplePluginCreationResult, String> {
    let root = ensure_user_data_root(&app)?;
    create_sample_workflow_plugin_at(&root)
}

#[tauri::command]
fn create_sample_python_plugin(app: AppHandle) -> Result<SamplePluginCreationResult, String> {
    let root = ensure_user_data_root(&app)?;
    create_sample_python_plugin_at(&root)
}

#[tauri::command]
fn open_sample_script_plugin_dir(app: AppHandle) -> Result<(), String> {
    let root = ensure_user_data_root(&app)?;
    let target_dir = root
        .join(USER_PLUGIN_DEV_DIR)
        .join(SAMPLE_SCRIPT_PLUGIN_DIR_NAME);
    fs::create_dir_all(&target_dir)
        .map_err(|error| format!("Failed to create sample script plugin directory: {error}"))?;

    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer");
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = Command::new("xdg-open");

    command
        .arg(&target_dir)
        .spawn()
        .map_err(|error| format!("Failed to open sample script plugin directory: {error}"))?;
    Ok(())
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
        match parse_json_without_bom::<Value>(&raw_manifest) {
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum PluginDiagnosticSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum PluginDiagnosticStatus {
    Passed,
    Failed,
    Fixable,
    Fixed,
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
enum PluginDiagnosticCategory {
    Registry,
    Installed,
    Manifest,
    Entry,
    Security,
    Dev,
    Gallery,
    Package,
    Runtime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginDiagnosticItem {
    id: String,
    severity: PluginDiagnosticSeverity,
    status: PluginDiagnosticStatus,
    category: PluginDiagnosticCategory,
    plugin_id: Option<String>,
    title: String,
    message: String,
    path: Option<String>,
    fix_action: Option<String>,
    fixable: bool,
    created_at: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginDiagnosticSummary {
    total: usize,
    passed: usize,
    warning: usize,
    error: usize,
    critical: usize,
    info: usize,
    fixable: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginDiagnosticCounts {
    total_plugins: usize,
    installed_plugins: usize,
    registry_records: usize,
    dev_projects: usize,
    gallery_examples: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginDiagnosticFixResult {
    action: String,
    plugin_id: Option<String>,
    status: String,
    message: String,
    backup_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginDiagnosticReport {
    scan_id: String,
    scanned_at: String,
    app_version: String,
    user_data_dir: String,
    summary: PluginDiagnosticSummary,
    counts: PluginDiagnosticCounts,
    items: Vec<PluginDiagnosticItem>,
    fix_results: Vec<PluginDiagnosticFixResult>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginDiagnosticFixRequest {
    fix_actions: Option<Vec<String>>,
}

fn diagnostic_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("{millis}")
}

fn diagnostic_iso_like_time() -> String {
    format!("{}Z", diagnostic_timestamp())
}

fn diagnostic_id(prefix: &str, path_or_plugin: &str) -> String {
    let safe = path_or_plugin
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>();
    format!("{prefix}-{safe}")
}

fn push_diagnostic_item(
    items: &mut Vec<PluginDiagnosticItem>,
    severity: PluginDiagnosticSeverity,
    status: PluginDiagnosticStatus,
    category: PluginDiagnosticCategory,
    plugin_id: Option<String>,
    title: impl Into<String>,
    message: impl Into<String>,
    path: Option<String>,
    fix_action: Option<String>,
) {
    let fixable = matches!(status, PluginDiagnosticStatus::Fixable) && fix_action.is_some();
    let title = title.into();
    let id_source = plugin_id
        .as_deref()
        .or(path.as_deref())
        .unwrap_or(title.as_str());
    items.push(PluginDiagnosticItem {
        id: diagnostic_id(
            match category {
                PluginDiagnosticCategory::Registry => "registry",
                PluginDiagnosticCategory::Installed => "installed",
                PluginDiagnosticCategory::Manifest => "manifest",
                PluginDiagnosticCategory::Entry => "entry",
                PluginDiagnosticCategory::Security => "security",
                PluginDiagnosticCategory::Dev => "dev",
                PluginDiagnosticCategory::Gallery => "gallery",
                PluginDiagnosticCategory::Package => "package",
                PluginDiagnosticCategory::Runtime => "runtime",
            },
            &format!("{}-{}", title, id_source),
        ),
        severity,
        status,
        category,
        plugin_id,
        title,
        message: message.into(),
        path,
        fix_action,
        fixable,
        created_at: diagnostic_iso_like_time(),
    });
}

fn summarize_diagnostics(items: &[PluginDiagnosticItem]) -> PluginDiagnosticSummary {
    let mut summary = PluginDiagnosticSummary {
        total: items.len(),
        ..PluginDiagnosticSummary::default()
    };
    for item in items {
        match item.status {
            PluginDiagnosticStatus::Passed => summary.passed += 1,
            _ => {}
        }
        match item.severity {
            PluginDiagnosticSeverity::Info => summary.info += 1,
            PluginDiagnosticSeverity::Warning => summary.warning += 1,
            PluginDiagnosticSeverity::Error => summary.error += 1,
            PluginDiagnosticSeverity::Critical => summary.critical += 1,
        }
        if item.fixable {
            summary.fixable += 1;
        }
    }
    summary
}

fn registry_sort_key(value: &Value) -> String {
    for field in ["updatedAt", "installedAt"] {
        if let Some(value) = value.get(field).and_then(Value::as_str) {
            return value.to_string();
        }
    }
    String::new()
}

fn is_url_like(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("://") || lower.starts_with("http:") || lower.starts_with("https:") || lower.starts_with("file:")
}

fn entry_security_problem(entry: &str) -> Option<(&'static str, PluginDiagnosticSeverity)> {
    let normalized = entry.replace('\\', "/");
    let lower = normalized.to_ascii_lowercase();
    if is_url_like(&normalized) {
        return Some(("entry URL is not allowed.", PluginDiagnosticSeverity::Critical));
    }
    if normalized.starts_with('/') || normalized.starts_with("//") || normalized.as_bytes().get(1) == Some(&b':') {
        return Some(("entry absolute path is not allowed.", PluginDiagnosticSeverity::Critical));
    }
    if normalized.split('/').any(|segment| segment == "..") {
        return Some(("entry parent traversal is not allowed.", PluginDiagnosticSeverity::Critical));
    }
    if normalized.split('/').any(|segment| segment.contains(':')) {
        return Some(("entry alternate data stream or drive separator is not allowed.", PluginDiagnosticSeverity::Critical));
    }
    if lower.ends_with(".dll") {
        return Some(("DLL entries are not supported.", PluginDiagnosticSeverity::Critical));
    }
    None
}

fn registry_entries_from_value(registry: &Value) -> Option<&Vec<Value>> {
    registry.as_array()
}

fn read_registry_for_diagnostics(root: &Path) -> (Option<Value>, Vec<PluginDiagnosticItem>) {
    let mut items = Vec::new();
    let registry_path = root.join(USER_PLUGIN_REGISTRY_PATH);
    if !registry_path.exists() {
        push_diagnostic_item(
            &mut items,
            PluginDiagnosticSeverity::Warning,
            PluginDiagnosticStatus::Fixable,
            PluginDiagnosticCategory::Registry,
            None,
            "Registry missing",
            "plugins/plugin-registry.json does not exist.",
            Some(USER_PLUGIN_REGISTRY_PATH.to_string()),
            Some("create-registry".to_string()),
        );
        return (None, items);
    }
    let raw = match fs::read_to_string(&registry_path) {
        Ok(raw) => raw,
        Err(error) => {
            push_diagnostic_item(
                &mut items,
                PluginDiagnosticSeverity::Critical,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Registry,
                None,
                "Registry unreadable",
                format!("plugin-registry.json cannot be read: {error}"),
                Some(USER_PLUGIN_REGISTRY_PATH.to_string()),
                None,
            );
            return (None, items);
        }
    };
    match parse_json_without_bom::<Value>(&raw) {
        Ok(value) => {
            if value.as_array().is_none() {
                push_diagnostic_item(
                    &mut items,
                    PluginDiagnosticSeverity::Error,
                    PluginDiagnosticStatus::Failed,
                    PluginDiagnosticCategory::Registry,
                    None,
                    "Registry is not an array",
                    "plugin-registry.json must be a JSON array. Automatic conversion is intentionally disabled.",
                    Some(USER_PLUGIN_REGISTRY_PATH.to_string()),
                    None,
                );
            }
            (Some(value), items)
        }
        Err(error) => {
            push_diagnostic_item(
                &mut items,
                PluginDiagnosticSeverity::Critical,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Registry,
                None,
                "Registry JSON damaged",
                format!("plugin-registry.json has invalid JSON: {error}"),
                Some(USER_PLUGIN_REGISTRY_PATH.to_string()),
                None,
            );
            (None, items)
        }
    }
}

fn list_directories(path: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(path) else {
        return vec![];
    };
    let mut names = entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            entry
                .file_type()
                .ok()
                .filter(|file_type| file_type.is_dir())
                .map(|_| entry.file_name().to_string_lossy().to_string())
        })
        .filter(|name| !name.starts_with('.'))
        .collect::<Vec<_>>();
    names.sort();
    names
}

fn scan_registry_diagnostics(
    items: &mut Vec<PluginDiagnosticItem>,
    registry: Option<&Value>,
    installed_dirs: &[String],
) {
    let Some(registry) = registry else {
        return;
    };
    let Some(entries) = registry_entries_from_value(registry) else {
        return;
    };
    let installed_set = installed_dirs.iter().cloned().collect::<HashSet<_>>();
    let mut seen: HashMap<String, Vec<(usize, &Value)>> = HashMap::new();
    for (index, entry) in entries.iter().enumerate() {
        let plugin_id = entry.get("pluginId").and_then(Value::as_str).unwrap_or_default();
        let path = Some(format!("{USER_PLUGIN_REGISTRY_PATH}#{index}"));
        if plugin_id.trim().is_empty() {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Error,
                PluginDiagnosticStatus::Fixable,
                PluginDiagnosticCategory::Registry,
                None,
                "Registry item missing pluginId",
                "Registry item has no pluginId and can be removed safely.",
                path,
                Some(format!("remove-registry-item:{index}")),
            );
            continue;
        }
        if !is_safe_plugin_id(plugin_id) {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Error,
                PluginDiagnosticStatus::Fixable,
                PluginDiagnosticCategory::Registry,
                Some(plugin_id.to_string()),
                "Registry item has invalid pluginId",
                "Registry item pluginId is unsafe and can be removed.",
                path,
                Some(format!("remove-registry-plugin:{plugin_id}")),
            );
            continue;
        }
        seen.entry(plugin_id.to_string()).or_default().push((index, entry));
        if entry.get("enabled").and_then(Value::as_bool).is_none() {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Warning,
                PluginDiagnosticStatus::Fixable,
                PluginDiagnosticCategory::Registry,
                Some(plugin_id.to_string()),
                "Registry enabled missing",
                "Registry item has no enabled state. The default fix sets enabled=true.",
                path.clone(),
                Some(format!("set-registry-enabled:{plugin_id}")),
            );
        }
        if entry.get("trusted").and_then(Value::as_bool).is_none() {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Warning,
                PluginDiagnosticStatus::Fixable,
                PluginDiagnosticCategory::Registry,
                Some(plugin_id.to_string()),
                "Registry trusted missing",
                "Registry item has no trusted state. The default fix sets trusted=false.",
                path.clone(),
                Some(format!("set-registry-trusted:{plugin_id}")),
            );
        }
        if !entry.get("builtIn").and_then(Value::as_bool).unwrap_or(false)
            && !installed_set.contains(plugin_id)
        {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Warning,
                PluginDiagnosticStatus::Fixable,
                PluginDiagnosticCategory::Registry,
                Some(plugin_id.to_string()),
                "Registry orphan record",
                "Registry item points to an installed plugin directory that does not exist.",
                path.clone(),
                Some(format!("remove-registry-orphan:{plugin_id}")),
            );
        }
        if entry.get("trusted").and_then(Value::as_bool).unwrap_or(false)
            && !installed_set.contains(plugin_id)
        {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Warning,
                PluginDiagnosticStatus::Fixable,
                PluginDiagnosticCategory::Registry,
                Some(plugin_id.to_string()),
                "Trusted registry item has no manifest",
                "The safer fix removes the orphan registry item instead of preserving trusted=true.",
                path,
                Some(format!("remove-registry-orphan:{plugin_id}")),
            );
        }
    }
    for (plugin_id, entries) in seen {
        if entries.len() > 1 {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Warning,
                PluginDiagnosticStatus::Fixable,
                PluginDiagnosticCategory::Registry,
                Some(plugin_id.clone()),
                "Duplicate registry pluginId",
                "Registry contains duplicate pluginId records. The fix keeps the newest updatedAt/installedAt record.",
                Some(USER_PLUGIN_REGISTRY_PATH.to_string()),
                Some(format!("dedupe-registry:{plugin_id}")),
            );
        }
    }
}

fn scan_installed_diagnostics(
    root: &Path,
    items: &mut Vec<PluginDiagnosticItem>,
    registry: Option<&Value>,
    installed_dirs: &[String],
) {
    let registry_ids = registry
        .and_then(registry_entries_from_value)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| entry.get("pluginId").and_then(Value::as_str))
                .map(str::to_string)
                .collect::<HashSet<_>>()
        })
        .unwrap_or_default();
    let installed_root = root.join(USER_PLUGIN_INSTALLED_DIR);
    for plugin_dir_name in installed_dirs {
        let plugin_dir = installed_root.join(plugin_dir_name);
        let plugin_path = format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_dir_name}");
        if !is_safe_plugin_id(plugin_dir_name) {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Error,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Installed,
                Some(plugin_dir_name.clone()),
                "Installed directory name invalid",
                "Directory name is not a safe pluginId. It is not deleted automatically.",
                Some(plugin_path.clone()),
                None,
            );
        }
        let manifest_path = plugin_dir.join(MANIFEST_FILE_NAME);
        let relative_manifest_path = format!("{plugin_path}/{MANIFEST_FILE_NAME}");
        if !manifest_path.is_file() {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Error,
                PluginDiagnosticStatus::Fixable,
                PluginDiagnosticCategory::Manifest,
                Some(plugin_dir_name.clone()),
                "Installed manifest missing",
                "manifest.json is missing. The safe fix moves this directory to plugins/quarantine.",
                Some(relative_manifest_path),
                Some(format!("quarantine-installed:{plugin_dir_name}")),
            );
            if !registry_ids.contains(plugin_dir_name) {
                push_diagnostic_item(
                    items,
                    PluginDiagnosticSeverity::Warning,
                    PluginDiagnosticStatus::Fixable,
                    PluginDiagnosticCategory::Installed,
                    Some(plugin_dir_name.clone()),
                    "Installed orphan directory",
                    "Installed plugin directory has no registry item.",
                    Some(plugin_path),
                    Some(format!("add-registry:{plugin_dir_name}")),
                );
            }
            continue;
        }
        let raw_manifest = match fs::read_to_string(&manifest_path) {
            Ok(text) => text,
            Err(error) => {
                push_diagnostic_item(
                    items,
                    PluginDiagnosticSeverity::Error,
                    PluginDiagnosticStatus::Fixable,
                    PluginDiagnosticCategory::Manifest,
                    Some(plugin_dir_name.clone()),
                    "Installed manifest unreadable",
                    format!("manifest.json cannot be read: {error}. The safe fix moves the directory to quarantine."),
                    Some(relative_manifest_path),
                    Some(format!("quarantine-installed:{plugin_dir_name}")),
                );
                continue;
            }
        };
        let manifest: Value = match parse_json_without_bom(&raw_manifest) {
            Ok(manifest) => manifest,
            Err(error) => {
                push_diagnostic_item(
                    items,
                    PluginDiagnosticSeverity::Error,
                    PluginDiagnosticStatus::Fixable,
                    PluginDiagnosticCategory::Manifest,
                    Some(plugin_dir_name.clone()),
                    "Installed manifest JSON damaged",
                    format!("manifest.json is invalid JSON: {error}. The safe fix moves the directory to quarantine."),
                    Some(relative_manifest_path),
                    Some(format!("quarantine-installed:{plugin_dir_name}")),
                );
                continue;
            }
        };
        let manifest_plugin_id = manifest
            .get("pluginId")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        if manifest_plugin_id != *plugin_dir_name {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Warning,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Manifest,
                Some(if manifest_plugin_id.is_empty() { plugin_dir_name.clone() } else { manifest_plugin_id.clone() }),
                "Manifest pluginId differs from directory",
                format!("manifest pluginId `{manifest_plugin_id}` differs from installed directory `{plugin_dir_name}`."),
                Some(relative_manifest_path.clone()),
                None,
            );
        }
        if let Err(error) = validate_declarative_manifest(
            if manifest_plugin_id.is_empty() { plugin_dir_name } else { &manifest_plugin_id },
            &manifest,
        ) {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Error,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Manifest,
                Some(if manifest_plugin_id.is_empty() { plugin_dir_name.clone() } else { manifest_plugin_id.clone() }),
                "Manifest schema errors",
                error,
                Some(relative_manifest_path.clone()),
                None,
            );
        }
        for field in ["trusted", "installedAt", "updatedAt"] {
            if manifest_has_top_level_key(&manifest, field) {
                push_diagnostic_item(
                    items,
                    PluginDiagnosticSeverity::Warning,
                    PluginDiagnosticStatus::Fixable,
                    PluginDiagnosticCategory::Manifest,
                    Some(if manifest_plugin_id.is_empty() { plugin_dir_name.clone() } else { manifest_plugin_id.clone() }),
                    "Manifest contains lifecycle field",
                    format!("manifest.json contains `{field}`. Lifecycle state belongs in plugin-registry.json."),
                    Some(relative_manifest_path.clone()),
                    Some(format!("strip-manifest-lifecycle:{plugin_dir_name}")),
                );
            }
        }
        if let Some(field) = contains_forbidden_declarative_field(&manifest) {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Critical,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Security,
                Some(if manifest_plugin_id.is_empty() { plugin_dir_name.clone() } else { manifest_plugin_id.clone() }),
                "Dangerous manifest field",
                format!("manifest.json contains dangerous field `{field}`. Automatic repair is disabled."),
                Some(relative_manifest_path.clone()),
                None,
            );
        }
        let plugin_type = manifest.get("pluginType").and_then(Value::as_str).unwrap_or_default();
        let runtime = manifest.get("runtime").and_then(Value::as_str).unwrap_or_default();
        if !DECLARATIVE_PLUGIN_TYPES.contains(&plugin_type) {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Error,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Runtime,
                Some(if manifest_plugin_id.is_empty() { plugin_dir_name.clone() } else { manifest_plugin_id.clone() }),
                "Unknown pluginType",
                format!("pluginType `{plugin_type}` is not supported."),
                Some(relative_manifest_path.clone()),
                None,
            );
        }
        if let Some(entry) = manifest.get("entry").and_then(Value::as_str) {
            if let Some((message, severity)) = entry_security_problem(entry) {
                push_diagnostic_item(
                    items,
                    severity,
                    PluginDiagnosticStatus::Failed,
                    PluginDiagnosticCategory::Entry,
                    Some(if manifest_plugin_id.is_empty() { plugin_dir_name.clone() } else { manifest_plugin_id.clone() }),
                    "Entry path is unsafe",
                    message,
                    Some(relative_manifest_path.clone()),
                    None,
                );
            } else {
                let entry_path = plugin_dir.join(entry.replace('\\', "/"));
                if !entry_path.is_file() {
                    push_diagnostic_item(
                        items,
                        PluginDiagnosticSeverity::Error,
                        PluginDiagnosticStatus::Failed,
                        PluginDiagnosticCategory::Entry,
                        Some(if manifest_plugin_id.is_empty() { plugin_dir_name.clone() } else { manifest_plugin_id.clone() }),
                        "Entry file missing",
                        format!("Entry file `{entry}` does not exist."),
                        Some(format!("{plugin_path}/{entry}")),
                        None,
                    );
                }
                if plugin_type == "external-command" && runtime == "executable" {
                    if let Some(error) = external_executable_entry_error_for_platform(entry, cfg!(target_os = "windows")) {
                        push_diagnostic_item(
                            items,
                            PluginDiagnosticSeverity::Error,
                            PluginDiagnosticStatus::Failed,
                            PluginDiagnosticCategory::Runtime,
                            Some(if manifest_plugin_id.is_empty() { plugin_dir_name.clone() } else { manifest_plugin_id.clone() }),
                            if cfg!(target_os = "windows") { "Executable entry is not .exe" } else { "Executable entry is unsupported" },
                            error,
                            Some(relative_manifest_path.clone()),
                            None,
                        );
                    } else if entry_path.is_file() {
                        if let Err(error) = validate_executable_entry_file(&entry_path) {
                            push_diagnostic_item(
                                items,
                                PluginDiagnosticSeverity::Error,
                                PluginDiagnosticStatus::Failed,
                                PluginDiagnosticCategory::Runtime,
                                Some(if manifest_plugin_id.is_empty() { plugin_dir_name.clone() } else { manifest_plugin_id.clone() }),
                                "Executable entry is unsafe",
                                error,
                                Some(relative_manifest_path.clone()),
                                None,
                            );
                        }
                    }
                }
            }
        } else if plugin_type == "script" || plugin_type == "external-command" {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Error,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Entry,
                Some(if manifest_plugin_id.is_empty() { plugin_dir_name.clone() } else { manifest_plugin_id.clone() }),
                "Entry missing",
                "Executable plugin types must declare an entry file.",
                Some(relative_manifest_path.clone()),
                None,
            );
        }
        if plugin_type != "external-command" && !runtime.is_empty() {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Warning,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Runtime,
                Some(if manifest_plugin_id.is_empty() { plugin_dir_name.clone() } else { manifest_plugin_id.clone() }),
                "runtime/pluginType mismatch",
                "runtime should only be declared for pluginType=external-command.",
                Some(relative_manifest_path.clone()),
                None,
            );
        }
        if !plugin_dir.join("README.md").is_file() {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Info,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Manifest,
                Some(if manifest_plugin_id.is_empty() { plugin_dir_name.clone() } else { manifest_plugin_id.clone() }),
                "README missing",
                "README.md is recommended for installed plugins.",
                Some(format!("{plugin_path}/README.md")),
                None,
            );
        }
        if !registry_ids.contains(plugin_dir_name) {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Warning,
                PluginDiagnosticStatus::Fixable,
                PluginDiagnosticCategory::Installed,
                Some(if manifest_plugin_id.is_empty() { plugin_dir_name.clone() } else { manifest_plugin_id }),
                "Installed orphan directory",
                "Installed plugin directory has no registry item. The fix adds enabled=true and trusted=false.",
                Some(plugin_path),
                Some(format!("add-registry:{plugin_dir_name}")),
            );
        }
    }
}

fn scan_dev_diagnostics(root: &Path, items: &mut Vec<PluginDiagnosticItem>) -> usize {
    let dev_root = root.join(USER_PLUGIN_DEV_DIR);
    let dev_dirs = list_directories(&dev_root);
    for plugin_id in &dev_dirs {
        let relative_path = format!("{USER_PLUGIN_DEV_DIR}/{plugin_id}");
        if !is_safe_plugin_id(plugin_id) {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Error,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Dev,
                Some(plugin_id.clone()),
                "Dev project directory name invalid",
                "Developer project directory name is not a safe pluginId.",
                Some(relative_path.clone()),
                None,
            );
            continue;
        }
        let validation = validate_dev_plugin_project_at(root, plugin_id);
        for error in &validation.errors {
            let severity = if error.code == "manifest-missing" {
                PluginDiagnosticSeverity::Warning
            } else {
                PluginDiagnosticSeverity::Error
            };
            push_diagnostic_item(
                items,
                severity,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Dev,
                Some(plugin_id.clone()),
                format!("Dev {}", error.code),
                error.message.clone(),
                error.field.clone().map(|field| format!("{relative_path}/{field}")).or(Some(relative_path.clone())),
                None,
            );
        }
        for warning in &validation.warnings {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Warning,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Dev,
                Some(plugin_id.clone()),
                format!("Dev {}", warning.code),
                warning.message.clone(),
                warning.field.clone().map(|field| format!("{relative_path}/{field}")).or(Some(relative_path.clone())),
                None,
            );
        }
        push_diagnostic_item(
            items,
            PluginDiagnosticSeverity::Info,
            PluginDiagnosticStatus::Passed,
            PluginDiagnosticCategory::Dev,
            Some(plugin_id.clone()),
            if validation.can_package { "Dev project packageable" } else { "Dev project not packageable" },
            if validation.can_package {
                "Developer project can be packaged."
            } else {
                "Developer project cannot be packaged until validation errors are fixed."
            },
            Some(relative_path),
            None,
        );
    }
    dev_dirs.len()
}

fn scan_gallery_diagnostics(items: &mut Vec<PluginDiagnosticItem>) -> usize {
    let catalog: Result<PluginGalleryCatalog, _> = parse_json_without_bom(PLUGIN_GALLERY_CATALOG);
    let catalog = match catalog {
        Ok(catalog) => catalog,
        Err(error) => {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Error,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Gallery,
                None,
                "Gallery catalog JSON damaged",
                format!("docs/examples/plugin-gallery/catalog.json is invalid: {error}"),
                Some("docs/examples/plugin-gallery/catalog.json".to_string()),
                None,
            );
            return 0;
        }
    };
    let mut seen = HashSet::new();
    for item in &catalog.items {
        if !seen.insert(item.id.clone()) {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Warning,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Gallery,
                Some(item.id.clone()),
                "Duplicate gallery catalog id",
                "catalog.json contains a duplicate item id.",
                Some("docs/examples/plugin-gallery/catalog.json".to_string()),
                None,
            );
        }
        if item.risk_level.trim().is_empty() {
            push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Warning,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Gallery,
                Some(item.id.clone()),
                "Gallery riskLevel missing",
                "Gallery catalog item should declare riskLevel.",
                Some("docs/examples/plugin-gallery/catalog.json".to_string()),
                None,
            );
        }
        match validate_gallery_catalog_path(&item.path) {
            Ok(path) => {
                let manifest_text = bundled_gallery_asset(&path);
                let Some(manifest_text) = manifest_text else {
                    push_diagnostic_item(
                        items,
                        PluginDiagnosticSeverity::Error,
                        PluginDiagnosticStatus::Failed,
                        PluginDiagnosticCategory::Gallery,
                        Some(item.id.clone()),
                        "Gallery manifest missing",
                        "Catalog item points to a manifest that is not bundled.",
                        Some(format!("docs/examples/plugin-gallery/{path}")),
                        None,
                    );
                    continue;
                };
                match parse_json_without_bom::<Value>(manifest_text) {
                    Ok(manifest) => {
                        if let Err(error) = validate_declarative_manifest(&item.id, &manifest) {
                            push_diagnostic_item(
                                items,
                                PluginDiagnosticSeverity::Error,
                                PluginDiagnosticStatus::Failed,
                                PluginDiagnosticCategory::Gallery,
                                Some(item.id.clone()),
                                "Gallery manifest schema errors",
                                error,
                                Some(format!("docs/examples/plugin-gallery/{path}")),
                                None,
                            );
                        }
                        if manifest.get("pluginType").and_then(Value::as_str) != Some(item.plugin_type.as_str()) {
                            push_diagnostic_item(
                                items,
                                PluginDiagnosticSeverity::Warning,
                                PluginDiagnosticStatus::Failed,
                                PluginDiagnosticCategory::Gallery,
                                Some(item.id.clone()),
                                "Gallery pluginType mismatch",
                                "Catalog pluginType differs from manifest pluginType.",
                                Some(format!("docs/examples/plugin-gallery/{path}")),
                                None,
                            );
                        }
                        if let Some(entry) = manifest.get("entry").and_then(Value::as_str) {
                            if let Ok(entry) = validate_safe_entry_path(entry) {
                                let directory = Path::new(&path).parent().and_then(Path::to_str).unwrap_or_default();
                                let entry_path = format!("{directory}/{entry}");
                                if bundled_gallery_asset(&entry_path).is_none() {
                                    push_diagnostic_item(
                                        items,
                                        PluginDiagnosticSeverity::Error,
                                        PluginDiagnosticStatus::Failed,
                                        PluginDiagnosticCategory::Gallery,
                                        Some(item.id.clone()),
                                        "Gallery entry missing",
                                        "Gallery sample entry file is not bundled.",
                                        Some(format!("docs/examples/plugin-gallery/{entry_path}")),
                                        None,
                                    );
                                }
                            }
                        }
                        let directory = Path::new(&path).parent().and_then(Path::to_str).unwrap_or_default();
                        let readme_path = format!("{directory}/README.md");
                        if bundled_gallery_asset(&readme_path).is_none() {
                            push_diagnostic_item(
                                items,
                                PluginDiagnosticSeverity::Warning,
                                PluginDiagnosticStatus::Failed,
                                PluginDiagnosticCategory::Gallery,
                                Some(item.id.clone()),
                                "Gallery README missing",
                                "Gallery sample should include README.md.",
                                Some(format!("docs/examples/plugin-gallery/{readme_path}")),
                                None,
                            );
                        }
                    }
                    Err(error) => push_diagnostic_item(
                        items,
                        PluginDiagnosticSeverity::Error,
                        PluginDiagnosticStatus::Failed,
                        PluginDiagnosticCategory::Gallery,
                        Some(item.id.clone()),
                        "Gallery manifest JSON damaged",
                        format!("Gallery manifest JSON is invalid: {error}"),
                        Some(format!("docs/examples/plugin-gallery/{path}")),
                        None,
                    ),
                }
            }
            Err(error) => push_diagnostic_item(
                items,
                PluginDiagnosticSeverity::Error,
                PluginDiagnosticStatus::Failed,
                PluginDiagnosticCategory::Gallery,
                Some(item.id.clone()),
                "Gallery catalog path invalid",
                error,
                Some("docs/examples/plugin-gallery/catalog.json".to_string()),
                None,
            ),
        }
    }
    catalog.items.len()
}

fn scan_package_diagnostics(root: &Path, items: &mut Vec<PluginDiagnosticItem>) {
    if root.join(USER_PLUGIN_INSTALLED_DIR).is_dir() {
        push_diagnostic_item(
            items,
            PluginDiagnosticSeverity::Info,
            PluginDiagnosticStatus::Passed,
            PluginDiagnosticCategory::Package,
            None,
            ".lmplugin import/export capability available",
            "Desktop package import/export commands are registered and local-only.",
            Some(USER_PLUGIN_INSTALLED_DIR.to_string()),
            None,
        );
    }
}

fn scan_plugin_diagnostics_at(root: &Path, scope: Option<&str>, fix_results: Vec<PluginDiagnosticFixResult>) -> Result<PluginDiagnosticReport, String> {
    let scanned_at = diagnostic_iso_like_time();
    let mut items = Vec::new();
    let installed_root = root.join(USER_PLUGIN_INSTALLED_DIR);
    fs::create_dir_all(&installed_root).map_err(|error| format!("Failed to create installed plugin directory: {error}"))?;
    fs::create_dir_all(root.join(USER_PLUGIN_DEV_DIR)).map_err(|error| format!("Failed to create dev plugin directory: {error}"))?;
    fs::create_dir_all(root.join(USER_PLUGIN_QUARANTINE_DIR)).map_err(|error| format!("Failed to create quarantine directory: {error}"))?;
    let installed_dirs = list_directories(&installed_root);
    let (registry_value, registry_read_items) = read_registry_for_diagnostics(root);
    items.extend(registry_read_items);
    let should_scan = |name: &str| scope.is_none_or(|scope| scope == "all" || scope == name);
    if should_scan("registry") {
        scan_registry_diagnostics(&mut items, registry_value.as_ref(), &installed_dirs);
    }
    if should_scan("installed") {
        scan_installed_diagnostics(root, &mut items, registry_value.as_ref(), &installed_dirs);
    }
    let dev_projects = if should_scan("dev") {
        scan_dev_diagnostics(root, &mut items)
    } else {
        list_directories(&root.join(USER_PLUGIN_DEV_DIR)).len()
    };
    let gallery_examples = if should_scan("gallery") {
        scan_gallery_diagnostics(&mut items)
    } else {
        load_plugin_gallery_catalog_from_text(PLUGIN_GALLERY_CATALOG).items.len()
    };
    if should_scan("package") {
        scan_package_diagnostics(root, &mut items);
    }
    if items.is_empty() {
        push_diagnostic_item(
            &mut items,
            PluginDiagnosticSeverity::Info,
            PluginDiagnosticStatus::Passed,
            PluginDiagnosticCategory::Runtime,
            None,
            "Plugin ecosystem healthy",
            "No plugin diagnostics were found for the selected scope.",
            None,
            None,
        );
    }
    let registry_records = registry_value
        .as_ref()
        .and_then(registry_entries_from_value)
        .map(Vec::len)
        .unwrap_or(0);
    let summary = summarize_diagnostics(&items);
    Ok(PluginDiagnosticReport {
        scan_id: format!("plugin-diagnostics-{}", diagnostic_timestamp()),
        scanned_at,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        user_data_dir: root.to_string_lossy().to_string(),
        summary,
        counts: PluginDiagnosticCounts {
            total_plugins: installed_dirs.len() + registry_records,
            installed_plugins: installed_dirs.len(),
            registry_records,
            dev_projects,
            gallery_examples,
        },
        items,
        fix_results,
    })
}

#[tauri::command]
fn scan_plugin_diagnostics(app: AppHandle, scope: Option<String>) -> Result<PluginDiagnosticReport, String> {
    let root = ensure_user_data_root(&app)?;
    scan_plugin_diagnostics_at(&root, scope.as_deref(), vec![])
}

fn backup_diagnostics_targets(root: &Path, actions: &[String]) -> Result<String, String> {
    let timestamp = diagnostic_timestamp();
    let backup_rel = format!("{USER_PLUGIN_DIAGNOSTIC_BACKUP_DIR}/{timestamp}");
    let backup_dir = root.join(&backup_rel);
    fs::create_dir_all(&backup_dir).map_err(|error| format!("Failed to create diagnostics backup: {error}"))?;
    let registry_path = root.join(USER_PLUGIN_REGISTRY_PATH);
    if registry_path.exists() {
        fs::copy(&registry_path, backup_dir.join("plugin-registry.json"))
            .map_err(|error| format!("Failed to back up plugin registry: {error}"))?;
    }
    let mut move_log = Vec::new();
    for action in actions {
        if let Some(plugin_id) = action.strip_prefix("strip-manifest-lifecycle:")
            .or_else(|| action.strip_prefix("quarantine-installed:"))
            .or_else(|| action.strip_prefix("add-registry:"))
        {
            if is_safe_plugin_id(plugin_id) {
                let manifest_path = root.join(USER_PLUGIN_INSTALLED_DIR).join(plugin_id).join(MANIFEST_FILE_NAME);
                if manifest_path.is_file() {
                    let manifest_backup_dir = backup_dir.join("installed").join(plugin_id);
                    fs::create_dir_all(&manifest_backup_dir)
                        .map_err(|error| format!("Failed to create manifest backup dir: {error}"))?;
                    fs::copy(&manifest_path, manifest_backup_dir.join(MANIFEST_FILE_NAME))
                        .map_err(|error| format!("Failed to back up manifest: {error}"))?;
                }
                if action.starts_with("quarantine-installed:") {
                    move_log.push(format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id} -> {USER_PLUGIN_QUARANTINE_DIR}/{plugin_id}-{timestamp}"));
                }
            }
        }
    }
    if !move_log.is_empty() {
        fs::write(backup_dir.join("moves.txt"), move_log.join("\n"))
            .map_err(|error| format!("Failed to write diagnostics move log: {error}"))?;
    }
    Ok(backup_rel)
}

fn read_registry_array_for_fix(root: &Path) -> Result<Vec<Value>, String> {
    let value = read_user_json_at(root, USER_PLUGIN_REGISTRY_PATH, json!([]))?;
    if let Some(entries) = value.as_array() {
        Ok(entries.clone())
    } else {
        Err("plugin-registry.json is not an array; automatic repair skipped.".to_string())
    }
}

fn write_registry_array_for_fix(root: &Path, entries: Vec<Value>) -> Result<(), String> {
    write_user_json_at(root, USER_PLUGIN_REGISTRY_PATH, &Value::Array(entries))
}

fn manifest_plugin_id_at(root: &Path, plugin_id: &str) -> Option<String> {
    let manifest_path = root.join(USER_PLUGIN_INSTALLED_DIR).join(plugin_id).join(MANIFEST_FILE_NAME);
    let raw = fs::read_to_string(manifest_path).ok()?;
    let manifest: Value = parse_json_without_bom(&raw).ok()?;
    manifest.get("pluginId").and_then(Value::as_str).map(str::to_string)
}

fn fix_plugin_diagnostics_at(root: &Path, actions: &[String]) -> Result<Vec<PluginDiagnosticFixResult>, String> {
    let backup_path = backup_diagnostics_targets(root, actions)?;
    let mut results = Vec::new();
    for action in actions {
        let mut result = PluginDiagnosticFixResult {
            action: action.clone(),
            plugin_id: action.split(':').nth(1).map(str::to_string),
            status: "fixed".to_string(),
            message: "Fixed.".to_string(),
            backup_path: Some(backup_path.clone()),
        };
        let apply_result = (|| -> Result<String, String> {
            if action == "create-registry" {
                let path = root.join(USER_PLUGIN_REGISTRY_PATH);
                if !path.exists() {
                    write_user_json_at(root, USER_PLUGIN_REGISTRY_PATH, &json!([]))?;
                }
                return Ok("Created empty plugin-registry.json.".to_string());
            }
            if let Some(plugin_id) = action.strip_prefix("remove-registry-orphan:")
                .or_else(|| action.strip_prefix("remove-registry-plugin:"))
            {
                let entries = read_registry_array_for_fix(root)?;
                let next = entries
                    .into_iter()
                    .filter(|entry| entry.get("pluginId").and_then(Value::as_str) != Some(plugin_id))
                    .collect::<Vec<_>>();
                write_registry_array_for_fix(root, next)?;
                return Ok(format!("Removed registry item `{plugin_id}`."));
            }
            if let Some(index_text) = action.strip_prefix("remove-registry-item:") {
                let index = index_text.parse::<usize>().map_err(|error| format!("Invalid registry item index: {error}"))?;
                let mut entries = read_registry_array_for_fix(root)?;
                if index < entries.len() {
                    entries.remove(index);
                    write_registry_array_for_fix(root, entries)?;
                }
                return Ok(format!("Removed registry item at index {index}."));
            }
            if let Some(plugin_id) = action.strip_prefix("set-registry-enabled:") {
                let mut entries = read_registry_array_for_fix(root)?;
                for entry in &mut entries {
                    if entry.get("pluginId").and_then(Value::as_str) == Some(plugin_id) {
                        if let Some(object) = entry.as_object_mut() {
                            object.entry("enabled").or_insert(Value::Bool(true));
                        }
                    }
                }
                write_registry_array_for_fix(root, entries)?;
                return Ok(format!("Set enabled=true for `{plugin_id}` where missing."));
            }
            if let Some(plugin_id) = action.strip_prefix("set-registry-trusted:") {
                let mut entries = read_registry_array_for_fix(root)?;
                for entry in &mut entries {
                    if entry.get("pluginId").and_then(Value::as_str) == Some(plugin_id) {
                        if let Some(object) = entry.as_object_mut() {
                            object.entry("trusted").or_insert(Value::Bool(false));
                        }
                    }
                }
                write_registry_array_for_fix(root, entries)?;
                return Ok(format!("Set trusted=false for `{plugin_id}` where missing."));
            }
            if let Some(plugin_id) = action.strip_prefix("dedupe-registry:") {
                let entries = read_registry_array_for_fix(root)?;
                let mut best: Option<Value> = None;
                let mut next = Vec::new();
                for entry in entries {
                    if entry.get("pluginId").and_then(Value::as_str) == Some(plugin_id) {
                        if best.as_ref().is_none_or(|current| registry_sort_key(&entry) >= registry_sort_key(current)) {
                            best = Some(entry);
                        }
                    } else {
                        next.push(entry);
                    }
                }
                if let Some(best) = best {
                    next.push(best);
                }
                write_registry_array_for_fix(root, next)?;
                return Ok(format!("Deduplicated registry records for `{plugin_id}`."));
            }
            if let Some(plugin_dir_name) = action.strip_prefix("add-registry:") {
                if !is_safe_plugin_id(plugin_dir_name) {
                    return Err("Unsafe pluginId; registry item not added.".to_string());
                }
                let manifest_id = manifest_plugin_id_at(root, plugin_dir_name)
                    .ok_or_else(|| "Cannot add registry item because manifest is missing or invalid.".to_string())?;
                let mut entries = read_registry_array_for_fix(root)?;
                if !entries.iter().any(|entry| entry.get("pluginId").and_then(Value::as_str) == Some(manifest_id.as_str())) {
                    entries.push(json!({
                        "pluginId": manifest_id,
                        "enabled": true,
                        "trusted": false,
                        "installedAt": diagnostic_iso_like_time(),
                        "updatedAt": diagnostic_iso_like_time()
                    }));
                    write_registry_array_for_fix(root, entries)?;
                }
                return Ok(format!("Added registry item for `{plugin_dir_name}`."));
            }
            if let Some(plugin_id) = action.strip_prefix("strip-manifest-lifecycle:") {
                if !is_safe_plugin_id(plugin_id) {
                    return Err("Unsafe pluginId; manifest not changed.".to_string());
                }
                let manifest_path = root.join(USER_PLUGIN_INSTALLED_DIR).join(plugin_id).join(MANIFEST_FILE_NAME);
                let raw = fs::read_to_string(&manifest_path).map_err(|error| format!("Failed to read manifest: {error}"))?;
                let mut manifest: Value = parse_json_without_bom(&raw).map_err(|error| format!("Manifest JSON invalid: {error}"))?;
                if let Some(object) = manifest.as_object_mut() {
                    object.remove("trusted");
                    object.remove("installedAt");
                    object.remove("updatedAt");
                }
                let raw = serde_json::to_string_pretty(&manifest).map_err(|error| format!("Failed to serialize manifest: {error}"))?;
                fs::write(&manifest_path, raw).map_err(|error| format!("Failed to write manifest: {error}"))?;
                return Ok(format!("Removed lifecycle fields from `{plugin_id}` manifest."));
            }
            if let Some(plugin_id) = action.strip_prefix("quarantine-installed:") {
                if !is_safe_plugin_id(plugin_id) {
                    return Err("Unsafe pluginId; directory not quarantined.".to_string());
                }
                let source = root.join(USER_PLUGIN_INSTALLED_DIR).join(plugin_id);
                if !source.exists() {
                    return Ok("Installed directory already absent.".to_string());
                }
                let target_name = format!("{}-{}", plugin_id, diagnostic_timestamp());
                let target = root.join(USER_PLUGIN_QUARANTINE_DIR).join(&target_name);
                fs::create_dir_all(root.join(USER_PLUGIN_QUARANTINE_DIR))
                    .map_err(|error| format!("Failed to create quarantine directory: {error}"))?;
                fs::rename(&source, &target).map_err(|error| format!("Failed to move plugin to quarantine: {error}"))?;
                let entries = read_registry_array_for_fix(root).unwrap_or_default();
                let next = entries
                    .into_iter()
                    .filter(|entry| entry.get("pluginId").and_then(Value::as_str) != Some(plugin_id))
                    .collect::<Vec<_>>();
                let _ = write_registry_array_for_fix(root, next);
                return Ok(format!("Moved plugin directory to {USER_PLUGIN_QUARANTINE_DIR}/{target_name}."));
            }
            Err("Unsupported or unsafe diagnostic fix action.".to_string())
        })();
        match apply_result {
            Ok(message) => result.message = message,
            Err(error) => {
                result.status = "failed".to_string();
                result.message = error;
            }
        }
        results.push(result);
    }
    Ok(results)
}

#[tauri::command]
fn fix_plugin_diagnostics(
    app: AppHandle,
    request: PluginDiagnosticFixRequest,
) -> Result<PluginDiagnosticReport, String> {
    let root = ensure_user_data_root(&app)?;
    let actions = request.fix_actions.unwrap_or_default();
    let results = fix_plugin_diagnostics_at(&root, &actions)?;
    scan_plugin_diagnostics_at(&root, Some("all"), results)
}

fn sanitized_diagnostic_report_markdown(report: &PluginDiagnosticReport) -> String {
    let user_data_dir = report.user_data_dir.replace('\\', "/");
    let scrub = |value: &str| value.replace(&user_data_dir, "<USER_DATA_DIR>");
    let mut output = String::new();
    output.push_str("# Plugin Diagnostics Report\n\n");
    output.push_str(&format!("Scan ID: `{}`\n\n", report.scan_id));
    output.push_str(&format!("Scanned at: `{}`\n\n", report.scanned_at));
    output.push_str("| Metric | Count |\n|---|---:|\n");
    output.push_str(&format!("| Total | {} |\n", report.summary.total));
    output.push_str(&format!("| Passed | {} |\n", report.summary.passed));
    output.push_str(&format!("| Critical | {} |\n", report.summary.critical));
    output.push_str(&format!("| Error | {} |\n", report.summary.error));
    output.push_str(&format!("| Warning | {} |\n", report.summary.warning));
    output.push_str(&format!("| Info | {} |\n", report.summary.info));
    output.push_str(&format!("| Fixable | {} |\n\n", report.summary.fixable));
    for severity in [
        PluginDiagnosticSeverity::Critical,
        PluginDiagnosticSeverity::Error,
        PluginDiagnosticSeverity::Warning,
        PluginDiagnosticSeverity::Info,
    ] {
        let title = match severity {
            PluginDiagnosticSeverity::Critical => "Critical",
            PluginDiagnosticSeverity::Error => "Error",
            PluginDiagnosticSeverity::Warning => "Warning",
            PluginDiagnosticSeverity::Info => "Info",
        };
        output.push_str(&format!("## {title}\n\n"));
        let mut found = false;
        for item in report.items.iter().filter(|item| item.severity == severity) {
            found = true;
            output.push_str(&format!(
                "- **{}** `{}` pluginId: `{}` category: `{:?}` path: `{}` fixable: `{}`\n  {}\n",
                item.title,
                item.id,
                item.plugin_id.as_deref().unwrap_or("-"),
                item.category,
                item.path.as_deref().map(&scrub).unwrap_or_else(|| "-".to_string()),
                item.fixable,
                scrub(&item.message)
            ));
            if let Some(action) = &item.fix_action {
                output.push_str(&format!("  Suggested fix: `{action}`\n"));
            }
        }
        if !found {
            output.push_str("- None\n");
        }
        output.push('\n');
    }
    if !report.fix_results.is_empty() {
        output.push_str("## Fix Results\n\n");
        for result in &report.fix_results {
            output.push_str(&format!(
                "- `{}` {}: {}\n",
                result.action,
                result.status,
                scrub(&result.message)
            ));
        }
    }
    output
}

#[tauri::command]
fn export_plugin_diagnostics_report(
    app: AppHandle,
    report: PluginDiagnosticReport,
    format: String,
) -> Result<String, String> {
    let root = ensure_user_data_root(&app)?;
    fs::create_dir_all(root.join(USER_PLUGIN_DIAGNOSTIC_REPORT_DIR))
        .map_err(|error| format!("Failed to create diagnostics report directory: {error}"))?;
    let timestamp = diagnostic_timestamp();
    match format.as_str() {
        "json" => {
            let path = root.join(USER_PLUGIN_DIAGNOSTIC_REPORT_DIR).join(format!("diagnostics-report-{timestamp}.json"));
            let mut report = report.clone();
            report.user_data_dir = "<USER_DATA_DIR>".to_string();
            let raw = serde_json::to_string_pretty(&report).map_err(|error| format!("Failed to serialize JSON report: {error}"))?;
            fs::write(&path, raw).map_err(|error| format!("Failed to write JSON report: {error}"))?;
            Ok(path.to_string_lossy().to_string())
        }
        "markdown" | "md" => {
            let path = root.join(USER_PLUGIN_DIAGNOSTIC_REPORT_DIR).join(format!("diagnostics-report-{timestamp}.md"));
            fs::write(&path, sanitized_diagnostic_report_markdown(&report))
                .map_err(|error| format!("Failed to write Markdown report: {error}"))?;
            Ok(path.to_string_lossy().to_string())
        }
        _ => Err("Unsupported diagnostics report format.".to_string()),
    }
}

#[tauri::command]
fn open_plugin_registry_dir(app: AppHandle) -> Result<(), String> {
    let root = ensure_user_data_root(&app)?;
    open_directory_path(&root.join("plugins"))
}

#[tauri::command]
fn open_plugin_quarantine_dir(app: AppHandle) -> Result<(), String> {
    let root = ensure_user_data_root(&app)?;
    fs::create_dir_all(root.join(USER_PLUGIN_QUARANTINE_DIR))
        .map_err(|error| format!("Failed to create quarantine directory: {error}"))?;
    open_directory_path(&root.join(USER_PLUGIN_QUARANTINE_DIR))
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenedPluginImport {
    path: String,
    file_name: String,
    kind: String,
    manifest: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PluginImportKind {
    Manifest,
    Package,
}

fn normalized_picker_value(value: &str) -> String {
    let trimmed = value.trim();
    let unquoted = trimmed
        .strip_prefix('"')
        .and_then(|value| value.strip_suffix('"'))
        .or_else(|| {
            trimmed
                .strip_prefix('\'')
                .and_then(|value| value.strip_suffix('\''))
        })
        .unwrap_or(trimmed)
        .trim();
    unquoted
        .split(['?', '#'])
        .next()
        .unwrap_or(unquoted)
        .trim()
        .trim_matches(['"', '\''])
        .trim()
        .to_ascii_lowercase()
}

fn classify_plugin_import(path: &str, file_name: &str) -> Result<PluginImportKind, String> {
    let candidates = [
        normalized_picker_value(path),
        normalized_picker_value(file_name),
    ];
    if candidates
        .iter()
        .any(|candidate| candidate.ends_with(".lmplugin"))
    {
        return Ok(PluginImportKind::Package);
    }
    if candidates
        .iter()
        .any(|candidate| candidate.ends_with(".json"))
    {
        return Ok(PluginImportKind::Manifest);
    }
    Err("不支持的插件文件类型：请选择 .json 或 .lmplugin 文件。".to_string())
}

fn usable_picker_path(path: &Path) -> PathBuf {
    if path.is_file() {
        return path.to_path_buf();
    }
    let raw = path.to_string_lossy();
    let trimmed = raw.trim();
    let unquoted = trimmed
        .strip_prefix('"')
        .and_then(|value| value.strip_suffix('"'))
        .or_else(|| {
            trimmed
                .strip_prefix('\'')
                .and_then(|value| value.strip_suffix('\''))
        })
        .unwrap_or(trimmed)
        .trim();
    PathBuf::from(
        unquoted
            .split(['?', '#'])
            .next()
            .unwrap_or(unquoted)
            .trim()
            .trim_matches(['"', '\''])
            .trim(),
    )
}

fn read_plugin_import_at(path: &Path, file_name: &str) -> Result<OpenedPluginImport, String> {
    let usable_path = usable_picker_path(path);
    let kind = classify_plugin_import(&path.to_string_lossy(), file_name)?;
    let manifest = match kind {
        PluginImportKind::Package => {
            inspect_plugin_package(&usable_path)
                .map_err(|error| {
                    if error.contains("缺少 manifest.json") {
                        error
                    } else {
                        format!("插件包无效 / 无法解压：{error}")
                    }
                })?
                .manifest
        }
        PluginImportKind::Manifest => {
            let text = fs::read_to_string(&usable_path)
                .map_err(|error| format!("manifest JSON 无效：无法读取 UTF-8 JSON：{error}"))?;
            parse_json_without_bom(&text).map_err(|error| format!("manifest JSON 无效：{error}"))?
        }
    };
    Ok(OpenedPluginImport {
        path: usable_path.to_string_lossy().to_string(),
        file_name: file_name.to_string(),
        kind: match kind {
            PluginImportKind::Package => "lmplugin",
            PluginImportKind::Manifest => "manifest",
        }
        .to_string(),
        manifest,
    })
}

#[tauri::command]
fn open_plugin_import_with_dialog() -> Result<Option<OpenedPluginImport>, String> {
    let Some(path) = FileDialog::new()
        .set_title("导入本地插件")
        .add_filter("Local Mindmap plugin", &["json", "lmplugin"])
        .pick_file()
    else {
        return Ok(None);
    };
    let file_name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());
    read_plugin_import_at(&path, &file_name).map(Some)
}

#[tauri::command]
fn install_plugin_package(
    app: AppHandle,
    package_path: String,
    manifest: Value,
    overwrite: bool,
) -> Result<(), String> {
    let package_path = PathBuf::from(&package_path);
    let inspected = inspect_plugin_package(&package_path)?;
    let package_plugin_id = inspected
        .manifest
        .get("pluginId")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let plugin_id = manifest
        .get("pluginId")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if package_plugin_id != plugin_id {
        return Err(
            "schema 校验失败：插件包 manifest 与待安装 manifest 的 pluginId 不一致。".to_string(),
        );
    }
    validate_declarative_manifest(plugin_id, &manifest)
        .map_err(|error| format!("schema 校验失败：{error}"))?;
    let mut package_manifest = inspected.manifest;
    if let (Some(object), Some(installed_at)) = (
        package_manifest.as_object_mut(),
        manifest.get("installedAt"),
    ) {
        object.insert("installedAt".to_string(), installed_at.clone());
    }
    let root = ensure_user_data_root(&app)?;
    install_plugin_to_user_dir_at_with_stager(
        &root,
        plugin_id,
        &package_manifest,
        overwrite,
        |staging_dir| extract_plugin_package(&package_path, staging_dir),
        write_user_json_at,
    )
}

fn exportable_plugin_manifest(manifest: &Value) -> Value {
    let mut exported = manifest.clone();
    if let Some(object) = exported.as_object_mut() {
        for field in [
            "trusted",
            "installedAt",
            "updatedAt",
            "builtIn",
            "category",
            "source",
            "manifestValid",
            "manifestError",
            "validationErrors",
            "validationWarnings",
            "manifestPath",
            "installedDirPath",
            "config",
        ] {
            object.remove(field);
        }
    }
    exported
}

fn export_plugin_package_at(
    root: &Path,
    plugin_id: &str,
    output_path: &Path,
) -> Result<(), String> {
    if !is_safe_plugin_id(plugin_id) {
        return Err("Invalid pluginId.".to_string());
    }
    let registry = read_user_json_at(root, USER_PLUGIN_REGISTRY_PATH, Value::Array(vec![]))?;
    if !plugin_registry_contains(&registry, plugin_id)? {
        return Err(format!("插件未安装或为不可导出的内置插件：{plugin_id}"));
    }
    let plugin_dir =
        resolve_user_relative_path(root, &format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}"))?;
    let manifest_path = plugin_dir.join(MANIFEST_FILE_NAME);
    let manifest_text = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("导出失败：manifest.json 读取失败：{error}"))?;
    let manifest: Value = parse_json_without_bom(&manifest_text)
        .map_err(|error| format!("导出失败：manifest JSON 无效：{error}"))?;
    validate_declarative_manifest(plugin_id, &manifest)
        .map_err(|error| format!("导出失败：schema 校验失败：{error}"))?;
    let exported_manifest = exportable_plugin_manifest(&manifest);

    let temporary_path = output_path.with_extension("lmplugin.tmp");
    remove_path_if_exists(&temporary_path)?;
    let result = (|| {
        let file = fs::File::create(&temporary_path)
            .map_err(|error| format!("导出失败：无法创建插件包：{error}"))?;
        let mut writer = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        writer
            .start_file(MANIFEST_FILE_NAME, options)
            .map_err(|error| format!("导出失败：无法写入 manifest.json：{error}"))?;
        writer
            .write_all(
                serde_json::to_string_pretty(&exported_manifest)
                    .map_err(|error| format!("导出失败：manifest 序列化失败：{error}"))?
                    .as_bytes(),
            )
            .map_err(|error| format!("导出失败：manifest 写入失败：{error}"))?;

        if let Some(entry) = manifest.get("entry").and_then(Value::as_str) {
            let entry = validate_safe_entry_path(entry)
                .map_err(|error| format!("导出失败：entry 路径非法：{error}"))?;
            let entry_path = plugin_dir.join(Path::new(&entry));
            if !entry_path.is_file() {
                return Err(format!("导出失败：entry 文件不存在：{entry}"));
            }
            writer
                .start_file(&entry, options)
                .map_err(|error| format!("导出失败：entry 写入失败：{error}"))?;
            let mut source = fs::File::open(&entry_path)
                .map_err(|error| format!("导出失败：entry 读取失败：{error}"))?;
            std::io::copy(&mut source, &mut writer)
                .map_err(|error| format!("导出失败：entry 写入失败：{error}"))?;
        }

        let readme_path = plugin_dir.join("README.md");
        if readme_path.is_file() {
            writer
                .start_file("README.md", options)
                .map_err(|error| format!("导出失败：README.md 写入失败：{error}"))?;
            let mut source = fs::File::open(&readme_path)
                .map_err(|error| format!("导出失败：README.md 读取失败：{error}"))?;
            std::io::copy(&mut source, &mut writer)
                .map_err(|error| format!("导出失败：README.md 写入失败：{error}"))?;
        }
        writer
            .finish()
            .map_err(|error| format!("导出失败：插件包收尾失败：{error}"))?;
        Ok(())
    })();
    if let Err(error) = result {
        let _ = remove_path_if_exists(&temporary_path);
        return Err(error);
    }
    if output_path.exists() {
        fs::remove_file(output_path)
            .map_err(|error| format!("导出失败：无法覆盖目标文件：{error}"))?;
    }
    fs::rename(&temporary_path, output_path)
        .map_err(|error| format!("导出失败：无法提交插件包：{error}"))
}

#[tauri::command]
fn export_plugin_package(app: AppHandle, plugin_id: String) -> Result<Option<String>, String> {
    let Some(mut path) = FileDialog::new()
        .set_title("导出插件包")
        .set_file_name(format!("{plugin_id}.lmplugin"))
        .add_filter("Local Mindmap plugin", &["lmplugin"])
        .save_file()
    else {
        return Ok(None);
    };
    if !path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("lmplugin"))
    {
        path.set_extension("lmplugin");
    }
    let root = ensure_user_data_root(&app)?;
    export_plugin_package_at(&root, &plugin_id, &path)?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
fn save_local_file_with_dialog(
    app: AppHandle,
    default_file_name: String,
    filter_name: String,
    extensions: Vec<String>,
    bytes: Vec<u8>,
    backup_options: Option<SaveBackupOptions>,
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
    let root = ensure_user_data_root(&app)?;
    write_local_file_reliable_at(Some(&root), &path, &bytes, backup_options.as_ref()).map(Some)
}

#[tauri::command]
fn write_local_file(
    app: AppHandle,
    path: String,
    bytes: Vec<u8>,
    backup_options: Option<SaveBackupOptions>,
) -> Result<String, String> {
    let root = ensure_user_data_root(&app)?;
    write_local_file_reliable_at(
        Some(&root),
        Path::new(&path),
        &bytes,
        backup_options.as_ref(),
    )
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

#[tauri::command]
fn check_local_file_health(path: String) -> Result<LocalFileHealth, String> {
    Ok(local_file_health_at(Path::new(&path)))
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

    parse_json_without_bom(&raw_text).unwrap_or_default()
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
    let value: Value = parse_json_without_bom(raw_manifest)
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExternalProcessResult {
    status: String,
    stdout: String,
    stderr: String,
    stdout_size: usize,
    stderr_size: usize,
    exit_code: Option<i32>,
    duration_ms: u128,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PythonTestResult {
    ok: bool,
    command: Option<String>,
    version: Option<String>,
    exit_code: Option<i32>,
    duration_ms: u128,
    error: Option<String>,
}

struct CapturedOutput {
    bytes: Vec<u8>,
    size: usize,
    exceeded: bool,
}

fn read_output_limited<R: Read>(
    mut reader: R,
    limit: usize,
    exceeded_flag: Arc<AtomicBool>,
) -> CapturedOutput {
    let mut bytes = Vec::with_capacity(limit.min(16 * 1024));
    let mut size = 0usize;
    let mut buffer = [0u8; 8192];
    loop {
        match reader.read(&mut buffer) {
            Ok(0) | Err(_) => break,
            Ok(count) => {
                size = size.saturating_add(count);
                let remaining = limit.saturating_sub(bytes.len());
                bytes.extend_from_slice(&buffer[..count.min(remaining)]);
                if size > limit {
                    exceeded_flag.store(true, Ordering::Relaxed);
                }
            }
        }
    }
    CapturedOutput {
        bytes,
        size,
        exceeded: size > limit,
    }
}

#[cfg(target_os = "windows")]
fn hide_child_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(target_os = "windows"))]
fn hide_child_window(_command: &mut Command) {}

fn configure_python_utf8(command: &mut Command) {
    command
        .env("PYTHONIOENCODING", "utf-8")
        .env("PYTHONUTF8", "1");
}

fn serialize_context_utf8(context: &Value) -> Result<Vec<u8>, String> {
    serde_json::to_string(context)
        .map(String::into_bytes)
        .map_err(|error| format!("context JSON UTF-8 序列化失败：{error}"))
}

fn run_managed_process(
    command: &mut Command,
    stdin_bytes: &[u8],
    timeout_ms: u64,
    stdout_limit: usize,
    stderr_limit: usize,
) -> Result<ExternalProcessResult, String> {
    hide_child_window(command);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let started = Instant::now();
    let mut child = command
        .spawn()
        .map_err(|error| format!("外部进程启动失败：{error}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "无法读取外部进程 stdout。".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "无法读取外部进程 stderr。".to_string())?;
    let stdout_exceeded = Arc::new(AtomicBool::new(false));
    let stderr_exceeded = Arc::new(AtomicBool::new(false));
    let stdout_thread = {
        let flag = Arc::clone(&stdout_exceeded);
        thread::spawn(move || read_output_limited(stdout, stdout_limit, flag))
    };
    let stderr_thread = {
        let flag = Arc::clone(&stderr_exceeded);
        thread::spawn(move || read_output_limited(stderr, stderr_limit, flag))
    };

    let stdin_error = child.stdin.take().and_then(|mut stdin| {
        stdin
            .write_all(stdin_bytes)
            .and_then(|_| stdin.flush())
            .err()
            .map(|error| format!("context 写入 stdin 失败：{error}"))
    });

    let mut timed_out = false;
    let mut output_limited = false;
    let exit_status = loop {
        if stdout_exceeded.load(Ordering::Relaxed) {
            output_limited = true;
            let _ = child.kill();
            break child
                .wait()
                .map_err(|error| format!("等待外部进程退出失败：{error}"))?;
        }
        if started.elapsed() >= Duration::from_millis(timeout_ms) {
            timed_out = true;
            let _ = child.kill();
            break child
                .wait()
                .map_err(|error| format!("等待超时进程退出失败：{error}"))?;
        }
        match child
            .try_wait()
            .map_err(|error| format!("读取外部进程状态失败：{error}"))?
        {
            Some(status) => break status,
            None => thread::sleep(Duration::from_millis(10)),
        }
    };

    let captured_stdout = stdout_thread
        .join()
        .map_err(|_| "stdout 读取线程异常退出。".to_string())?;
    let captured_stderr = stderr_thread
        .join()
        .map_err(|_| "stderr 读取线程异常退出。".to_string())?;
    output_limited |= captured_stdout.exceeded;

    let (stdout, invalid_stdout_utf8) = match String::from_utf8(captured_stdout.bytes) {
        Ok(value) => (value, false),
        Err(error) => (String::from_utf8_lossy(error.as_bytes()).to_string(), true),
    };
    let stderr = match String::from_utf8(captured_stderr.bytes) {
        Ok(value) => value,
        Err(error) => format!(
            "stderr 非合法 UTF-8，已使用安全替换预览。\n{}",
            String::from_utf8_lossy(error.as_bytes())
        ),
    };
    let exit_code = exit_status.code();
    let (status, error) = if timed_out {
        (
            "timeout",
            Some(format!("外部进程执行超时（{timeout_ms}ms），已终止。")),
        )
    } else if output_limited {
        (
            "output_limit",
            Some(format!(
                "stdout 超过最大限制 {} 字节，进程已终止。",
                stdout_limit
            )),
        )
    } else if invalid_stdout_utf8 {
        (
            "failed",
            Some("stdout 不是合法 UTF-8，请确保外部程序输出 UTF-8 JSON。".to_string()),
        )
    } else if let Some(error) = stdin_error {
        ("failed", Some(error))
    } else if !exit_status.success() {
        (
            "failed",
            Some(format!(
                "外部进程退出码非 0：{}。",
                exit_code
                    .map(|code| code.to_string())
                    .unwrap_or_else(|| "unknown".to_string())
            )),
        )
    } else {
        ("success", None)
    };

    Ok(ExternalProcessResult {
        status: status.to_string(),
        stdout,
        stderr,
        stdout_size: captured_stdout.size,
        stderr_size: captured_stderr.size,
        exit_code,
        duration_ms: started.elapsed().as_millis(),
        error,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct PythonInvocation {
    program: PathBuf,
    args: Vec<String>,
    display: String,
}

fn python_candidate_specs_for_platform(is_windows: bool) -> Vec<(&'static str, Vec<&'static str>)> {
    if is_windows {
        vec![("py", vec!["-3"]), ("python", vec![]), ("python3", vec![])]
    } else {
        vec![("python3", vec![]), ("python", vec![])]
    }
}

fn python_invocation_from_setting(python_path: &str) -> Result<PythonInvocation, String> {
    let trimmed = python_path.trim();
    if trimmed.is_empty() || trimmed.contains('\0') {
        return Err("Python 路径不能为空。".to_string());
    }
    if trimmed == "py" {
        return Ok(PythonInvocation {
            program: PathBuf::from("py"),
            args: vec!["-3".to_string()],
            display: "py -3".to_string(),
        });
    }
    if ["python", "python3", "python.exe"].contains(&trimmed) {
        return Ok(PythonInvocation {
            program: PathBuf::from(trimmed),
            args: vec![],
            display: trimmed.to_string(),
        });
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err(
            "Python 设置只允许 auto、py、python、python3、python.exe 或受控的可执行文件绝对路径。"
                .to_string(),
        );
    }
    if !path.is_file() {
        return Err(format!("Python 可执行文件不存在：{}", path.display()));
    }
    #[cfg(target_os = "windows")]
    if !path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"))
    {
        return Err("Windows 下 Python 路径必须指向 .exe 文件。".to_string());
    }
    Ok(PythonInvocation {
        program: path.clone(),
        args: vec![],
        display: path.to_string_lossy().to_string(),
    })
}

fn python_candidate_invocations(python_path: &str) -> Result<Vec<PythonInvocation>, String> {
    if python_path.trim().is_empty() || python_path.trim().eq_ignore_ascii_case("auto") {
        return Ok(python_candidate_specs_for_platform(cfg!(target_os = "windows"))
            .into_iter()
            .map(|(program, args)| PythonInvocation {
                program: PathBuf::from(program),
                args: args.iter().map(|arg| (*arg).to_string()).collect(),
                display: if args.is_empty() { program.to_string() } else { format!("{program} {}", args.join(" ")) },
            })
            .collect());
    }
    Ok(vec![python_invocation_from_setting(python_path)?])
}

fn probe_python_runtime(invocation: &PythonInvocation) -> Result<ExternalProcessResult, String> {
    let mut command = Command::new(&invocation.program);
    command.args(&invocation.args).arg("--version");
    configure_python_utf8(&mut command);
    run_managed_process(
        &mut command,
        &[],
        EXTERNAL_DEFAULT_TIMEOUT_MS,
        64 * 1024,
        64 * 1024,
    )
}

fn resolve_python_runtime(python_path: &str) -> Result<(PythonInvocation, ExternalProcessResult), String> {
    let candidates = python_candidate_invocations(python_path)?;
    for candidate in candidates {
        if let Ok(result) = probe_python_runtime(&candidate) {
            if result.status == "success" && (!result.stdout.trim().is_empty() || !result.stderr.trim().is_empty()) {
                return Ok((candidate, result));
            }
        }
    }
    Err("未检测到可用的 Python 3 解释器。请安装 Python 3，或在设置中填写受控解释器路径。".to_string())
}

fn external_settings_at(root: &Path) -> Result<(bool, String), String> {
    let settings = read_user_json_at(root, USER_PLUGIN_SETTINGS_PATH, json!({}))?;
    let enabled = settings
        .get("externalRunnerEnabled")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let python_path = settings
        .get("pythonPath")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("auto")
        .to_string();
    Ok((enabled, python_path))
}

fn registry_plugin_enabled(root: &Path, plugin_id: &str) -> Result<bool, String> {
    let registry = read_user_json_at(root, USER_PLUGIN_REGISTRY_PATH, json!([]))?;
    Ok(registry.as_array().is_some_and(|plugins| {
        plugins.iter().any(|plugin| {
            plugin.get("pluginId").and_then(Value::as_str) == Some(plugin_id)
                && plugin
                    .get("enabled")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
        })
    }))
}

fn run_external_command_at(
    root: &Path,
    plugin_id: &str,
    context: &Value,
    requested_python_path: &str,
    timeout_ms: u64,
) -> Result<ExternalProcessResult, String> {
    if !is_safe_plugin_id(plugin_id) {
        return Err("Invalid pluginId.".to_string());
    }
    let (runner_enabled, configured_python_path) = external_settings_at(root)?;
    if !runner_enabled {
        return Err("外部命令插件运行器未启用。".to_string());
    }
    if !registry_plugin_enabled(root, plugin_id)? {
        return Err(format!("插件已禁用或未安装：{plugin_id}"));
    }
    if context.get("contextVersion").and_then(Value::as_u64) != Some(1) {
        return Err("外部命令 contextVersion 必须是 1。".to_string());
    }
    let stdin = serialize_context_utf8(context)?;
    if stdin.len() > 8 * 1024 * 1024 {
        return Err("context JSON 超过 8MB 限制。".to_string());
    }

    let relative_manifest = format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}/{MANIFEST_FILE_NAME}");
    let manifest = read_user_json_at(root, &relative_manifest, Value::Null)?;
    validate_declarative_manifest(plugin_id, &manifest)
        .map_err(|error| format!("installed manifest 无效：{error}"))?;
    if manifest.get("pluginType").and_then(Value::as_str) != Some("external-command") {
        return Err("插件不是 external-command 类型。".to_string());
    }
    let runtime = manifest
        .get("runtime")
        .and_then(Value::as_str)
        .ok_or_else(|| "external-command manifest 缺少 runtime。".to_string())?;
    let entry = manifest
        .get("entry")
        .and_then(Value::as_str)
        .ok_or_else(|| "external-command manifest 缺少 entry。".to_string())?;
    validate_external_entry_path(entry, runtime)?;

    let relative_plugin_dir = format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}");
    let plugin_dir = resolve_user_relative_path(root, &relative_plugin_dir)?;
    let entry_path = resolve_user_relative_path(
        root,
        &format!("{relative_plugin_dir}/{}", entry.replace('\\', "/")),
    )?;
    if !entry_path.is_file() {
        return Err(format!("插件入口文件不存在：{}", entry_path.display()));
    }
    if runtime == "executable" {
        validate_executable_entry_file(&entry_path)?;
    }

    let mut command = if runtime == "python" {
        if requested_python_path.trim() != configured_python_path {
            return Err("Python 路径与已保存配置不一致，请重新加载设置。".to_string());
        }
        let (python, _) = resolve_python_runtime(&configured_python_path)?;
        let mut command = Command::new(python.program);
        command.args(python.args);
        command.arg(&entry_path);
        configure_python_utf8(&mut command);
        command
    } else {
        Command::new(&entry_path)
    };
    command.current_dir(&plugin_dir);
    run_managed_process(
        &mut command,
        &stdin,
        timeout_ms.clamp(1, EXTERNAL_MAX_TIMEOUT_MS),
        EXTERNAL_STDOUT_LIMIT,
        EXTERNAL_STDERR_LIMIT,
    )
}

#[tauri::command]
async fn run_external_command_plugin(
    app: AppHandle,
    plugin_id: String,
    context: Value,
    python_path: String,
    timeout_ms: Option<u64>,
) -> Result<ExternalProcessResult, String> {
    let root = ensure_user_data_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        run_external_command_at(
            &root,
            &plugin_id,
            &context,
            &python_path,
            timeout_ms.unwrap_or(EXTERNAL_DEFAULT_TIMEOUT_MS),
        )
    })
    .await
    .map_err(|error| format!("外部进程任务异常：{error}"))?
}

fn test_python_runtime_at(python_path: &str) -> Result<PythonTestResult, String> {
    let (invocation, result) = resolve_python_runtime(python_path)?;
    let version = if result.stdout.trim().is_empty() {
        result.stderr.trim().to_string()
    } else {
        result.stdout.trim().to_string()
    };
    Ok(PythonTestResult {
        ok: result.status == "success" && !version.is_empty(),
        command: Some(invocation.display),
        version: (!version.is_empty()).then_some(version),
        exit_code: result.exit_code,
        duration_ms: result.duration_ms,
        error: result.error,
    })
}

#[tauri::command]
async fn test_python_runtime(python_path: String) -> Result<PythonTestResult, String> {
    tauri::async_runtime::spawn_blocking(move || test_python_runtime_at(&python_path))
        .await
        .map_err(|error| format!("Python 测试任务异常：{error}"))?
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_user_data_dir,
            ensure_user_data_dirs,
            read_user_json,
            write_user_json,
            read_user_text,
            delete_user_file,
            list_user_files,
            install_plugin_to_user_dir,
            get_plugin_gallery_catalog,
            install_gallery_plugin,
            open_gallery_plugin_dir,
            open_plugin_development_docs,
            uninstall_plugin_from_user_dir,
            open_user_data_dir,
            open_plugin_dir,
            open_plugin_dev_dir,
            create_dev_plugin_project,
            validate_dev_plugin_project,
            build_dev_plugin_package,
            open_dev_plugin_project_dir,
            open_plugin_examples_dir,
            create_sample_plugin,
            create_sample_script_plugin,
            create_sample_batch_script_plugin,
            create_sample_workflow_plugin,
            create_sample_python_plugin,
            open_sample_script_plugin_dir,
            open_plugin_manifest_dir,
            scan_installed_plugin_manifests,
            reload_plugins_from_disk,
            scan_plugin_diagnostics,
            fix_plugin_diagnostics,
            export_plugin_diagnostics_report,
            open_plugin_registry_dir,
            open_plugin_quarantine_dir,
            open_plugin_import_with_dialog,
            install_plugin_package,
            export_plugin_package,
            save_local_file_with_dialog,
            write_local_file,
            read_local_file,
            open_local_file_with_dialog,
            open_file_location,
            check_local_file_health,
            open_user_data_subdir,
            get_desktop_config_dir,
            ensure_desktop_config_dir,
            get_desktop_plugin_dir,
            list_desktop_plugins,
            install_desktop_plugin_manifest,
            set_desktop_plugin_enabled,
            uninstall_desktop_plugin,
            run_external_command_plugin,
            test_python_runtime
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

    #[test]
    fn python_candidate_order_is_platform_specific() {
        assert_eq!(
            python_candidate_specs_for_platform(true),
            vec![("py", vec!["-3"]), ("python", vec![]), ("python3", vec![])]
        );
        assert_eq!(
            python_candidate_specs_for_platform(false),
            vec![("python3", vec![]), ("python", vec![])]
        );
    }

    #[test]
    fn executable_entry_rules_cover_windows_and_unix_security_boundaries() {
        assert!(external_executable_entry_error_for_platform("plugin.bin", true).is_some());
        assert!(external_executable_entry_error_for_platform("plugin.exe", true).is_none());
        assert!(external_executable_entry_error_for_platform("plugin", false).is_none());
        assert!(external_executable_entry_error_for_platform("plugin.sh", false).is_some());
        assert!(external_executable_entry_error_for_platform("plugin.dll", false).is_some());
    }

    fn write_test_plugin_package(path: &Path, entries: &[(&str, &[u8])]) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("package parent should be created");
        }
        let file = fs::File::create(path).expect("package should be created");
        let mut writer = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);
        for (name, bytes) in entries {
            writer
                .start_file(*name, options)
                .expect("test package entry should start");
            writer
                .write_all(bytes)
                .expect("test package entry should be written");
        }
        writer.finish().expect("test package should finish");
    }

    fn install_test_plugin_package(
        root: &Path,
        package_path: &Path,
        manifest: &Value,
        overwrite: bool,
    ) -> Result<(), String> {
        let plugin_id = manifest
            .get("pluginId")
            .and_then(Value::as_str)
            .unwrap_or_default();
        install_plugin_to_user_dir_at_with_stager(
            root,
            plugin_id,
            manifest,
            overwrite,
            |staging_dir| extract_plugin_package(package_path, staging_dir),
            write_user_json_at,
        )
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

    fn test_script_plugin(plugin_id: &str) -> Value {
        json!({
            "manifestVersion": 1,
            "pluginId": plugin_id,
            "name": "Script test plugin",
            "version": "1.0.0",
            "author": "Local Mindmap Test",
            "description": "Tests script plugin installation.",
            "pluginType": "script",
            "capabilities": ["script", "mindmap:read", "mindmap:write"],
            "enabled": true,
            "entry": "main.js",
            "permissions": ["mindmap:read", "mindmap:write", "node:read", "node:write"],
            "contributions": {
                "menus": [{
                    "id": "run",
                    "label": "Run",
                    "location": "plugins",
                    "command": "plugin.runScript",
                    "when": "hasSelectedNode"
                }]
            }
        })
    }

    fn test_external_python_plugin(plugin_id: &str) -> Value {
        json!({
            "manifestVersion": 1,
            "pluginId": plugin_id,
            "name": "External Python test plugin",
            "version": "1.0.0",
            "author": "Local Mindmap Test",
            "description": "Tests the external command protocol.",
            "pluginType": "external-command",
            "runtime": "python",
            "entry": "main.py",
            "capabilities": ["external-command", "mindmap:read", "mindmap:write"],
            "enabled": true,
            "permissions": [
                "external-command",
                "mindmap:read",
                "mindmap:write",
                "node:read",
                "node:write"
            ],
            "contributions": {
                "menus": [{
                    "id": "run",
                    "label": "Run",
                    "location": "plugins",
                    "command": "plugin.runExternal",
                    "when": "hasSelectedNode"
                }]
            }
        })
    }

    fn test_external_executable_plugin(plugin_id: &str, entry: &str) -> Value {
        json!({
            "manifestVersion": 1,
            "pluginId": plugin_id,
            "name": "External executable test plugin",
            "version": "1.0.0",
            "author": "Local Mindmap Test",
            "description": "Tests direct executable startup.",
            "pluginType": "external-command",
            "runtime": "executable",
            "entry": entry,
            "capabilities": ["external-command", "mindmap:read"],
            "enabled": true,
            "permissions": ["external-command", "mindmap:read"],
            "contributions": {
                "menus": [{
                    "id": "run",
                    "label": "Run",
                    "location": "plugins",
                    "command": "plugin.runExternal",
                    "when": "always"
                }]
            }
        })
    }

    fn install_external_python_for_test(
        root: &Path,
        plugin_id: &str,
        source: &str,
    ) -> Result<(), String> {
        ensure_user_data_dirs_at(root)?;
        let source_dir = root.join("source-plugin");
        fs::create_dir_all(&source_dir).map_err(|error| error.to_string())?;
        let manifest_path = source_dir.join(MANIFEST_FILE_NAME);
        let entry_path = source_dir.join("main.py");
        fs::write(&manifest_path, "{}").map_err(|error| error.to_string())?;
        fs::write(&entry_path, source).map_err(|error| error.to_string())?;
        let manifest = test_external_python_plugin(plugin_id);
        let assets = vec![PluginInstallAsset {
            relative_path: "main.py".to_string(),
            source_path: Some(entry_path.to_string_lossy().to_string()),
            text: None,
            optional: false,
        }];
        install_plugin_to_user_dir_at_with_writer(
            root,
            plugin_id,
            &manifest,
            false,
            Some(&manifest_path.to_string_lossy()),
            &assets,
            write_user_json_at,
        )?;
        write_user_json_at(
            root,
            USER_PLUGIN_SETTINGS_PATH,
            &json!({
                "scriptRunnerEnabled": false,
                "externalRunnerEnabled": true,
                "pythonPath": "python"
            }),
        )
    }

    fn external_test_context() -> Value {
        json!({
            "contextVersion": 1,
            "app": { "version": "1.9.1", "platform": "desktop" },
            "mindmap": {
                "title": "中心主题",
                "nodeCount": 1,
                "selectedNodeId": "root",
                "rootNodeId": "root"
            },
            "selectedNode": {
                "id": "root",
                "text": "中心主题",
                "remark": "",
                "parentId": null,
                "childrenIds": [],
                "type": "default"
            },
            "nodes": [],
            "selection": { "nodeIds": ["root"] }
        })
    }

    #[test]
    fn serializes_external_context_as_utf8_json_bytes() {
        let bytes =
            serialize_context_utf8(&external_test_context()).expect("context should serialize");
        let decoded = std::str::from_utf8(&bytes).expect("context bytes must be valid UTF-8");
        assert!(decoded.contains("中心主题"));
        assert_eq!(
            serde_json::from_slice::<Value>(&bytes).expect("context should remain JSON")
                ["selectedNode"]["text"],
            "中心主题"
        );
    }

    #[test]
    fn validates_external_command_schema_and_command_ownership() {
        let plugin_id = "localmindmap.test.external.schema";
        let manifest = test_external_python_plugin(plugin_id);
        validate_declarative_manifest(plugin_id, &manifest)
            .expect("valid external manifest should pass");

        for (field, value) in [
            ("runtime", Value::Null),
            ("entry", Value::Null),
            ("shell", Value::String("cmd".to_string())),
            ("args", json!([])),
            ("commandLine", Value::String("python main.py".to_string())),
        ] {
            let mut invalid = manifest.clone();
            invalid
                .as_object_mut()
                .expect("manifest object")
                .insert(field.to_string(), value);
            assert!(
                validate_declarative_manifest(plugin_id, &invalid).is_err(),
                "{field} should be rejected"
            );
        }

        let mut invalid_entry = manifest.clone();
        invalid_entry["entry"] = Value::String("../main.py".to_string());
        assert!(validate_declarative_manifest(plugin_id, &invalid_entry).is_err());
        let mut invalid_command = manifest;
        invalid_command["contributions"]["menus"][0]["command"] =
            Value::String("plugin.runScript".to_string());
        assert!(validate_declarative_manifest(plugin_id, &invalid_command).is_err());
    }

    #[test]
    fn external_runner_stays_disabled_when_settings_are_missing_or_damaged() {
        let root = test_root("external-runner-disabled");
        let plugin_id = "localmindmap.test.external.disabled";
        install_external_python_for_test(
            &root,
            plugin_id,
            "import json; print(json.dumps({'actions': []}))",
        )
        .expect("plugin install should succeed");
        fs::remove_file(root.join(USER_PLUGIN_SETTINGS_PATH)).expect("settings should exist");
        assert!(
            run_external_command_at(&root, plugin_id, &external_test_context(), "python", 500)
                .expect_err("missing settings must disable runner")
                .contains("未启用")
        );
        fs::write(root.join(USER_PLUGIN_SETTINGS_PATH), "{bad json")
            .expect("damaged settings should be written");
        assert!(
            run_external_command_at(&root, plugin_id, &external_test_context(), "python", 500)
                .is_err()
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn external_python_runner_handles_protocol_stderr_exit_and_timeout() {
        if !test_python_runtime_at("python")
            .map(|result| result.ok)
            .unwrap_or(false)
        {
            return;
        }

        let cases = [
            (
                "success",
                "import json,os,sys\nc=json.load(sys.stdin)\nsys.stderr.write(os.environ.get('PYTHONIOENCODING','') + '|' + os.environ.get('PYTHONUTF8',''))\nprint(json.dumps({'actions':[{'type':'showMessage','message':c['selectedNode']['text']}]}, ensure_ascii=False))",
                1000,
                "success",
            ),
            (
                "non-json",
                "print('not json')",
                1000,
                "success",
            ),
            (
                "non-zero",
                "import sys\nsys.stderr.write('failed')\nsys.exit(7)",
                1000,
                "failed",
            ),
            (
                "timeout",
                "import time\ntime.sleep(1)\nprint('{\"actions\": []}')",
                50,
                "timeout",
            ),
            (
                "output-limit",
                "print('x' * 1100000)",
                2000,
                "output_limit",
            ),
            (
                "invalid-stdout-utf8",
                "import sys\nsys.stdout.buffer.write(bytes([255]))",
                1000,
                "failed",
            ),
            (
                "invalid-stderr-utf8",
                "import json,sys\nsys.stderr.buffer.write(bytes([255]))\nprint(json.dumps({'actions': []}))",
                1000,
                "success",
            ),
        ];

        for (name, source, timeout, expected_status) in cases {
            let root = test_root(&format!("external-{name}"));
            let plugin_id = format!("localmindmap.test.external.{name}");
            install_external_python_for_test(&root, &plugin_id, source)
                .expect("plugin install should succeed");
            let result = run_external_command_at(
                &root,
                &plugin_id,
                &external_test_context(),
                "python",
                timeout,
            )
            .expect("runner should return a process result");
            assert_eq!(result.status, expected_status);
            if name == "success" {
                let output: Value =
                    serde_json::from_str(&result.stdout).expect("stdout should be UTF-8 JSON");
                assert_eq!(output["actions"][0]["message"], "中心主题");
                assert!(result.stdout.contains("中心主题"));
                assert_eq!(result.stderr, "utf-8|1");
                assert_eq!(result.exit_code, Some(0));
            } else if name == "non-zero" {
                assert_eq!(result.exit_code, Some(7));
                assert!(result.stderr.contains("failed"));
            } else if name == "invalid-stdout-utf8" {
                assert_eq!(
                    result.error.as_deref(),
                    Some("stdout 不是合法 UTF-8，请确保外部程序输出 UTF-8 JSON。")
                );
            } else if name == "invalid-stderr-utf8" {
                assert!(result.stderr.contains("stderr 非合法 UTF-8"));
            }
            let _ = fs::remove_dir_all(root);
        }
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn external_executable_runner_starts_installed_exe_without_shell() {
        let root = test_root("external-executable");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        let source_dir = root.join("source-executable-plugin");
        fs::create_dir_all(&source_dir).expect("source directory should exist");
        let manifest_path = source_dir.join(MANIFEST_FILE_NAME);
        fs::write(&manifest_path, "{}").expect("source manifest should exist");
        let windows_dir = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".to_string());
        let system_exe = Path::new(&windows_dir).join("System32").join("whoami.exe");
        let source_exe = source_dir.join("plugin.exe");
        fs::copy(system_exe, &source_exe).expect("test executable should be copied");
        let plugin_id = "localmindmap.test.external.executable";
        let manifest = test_external_executable_plugin(plugin_id, "plugin.exe");
        let assets = vec![PluginInstallAsset {
            relative_path: "plugin.exe".to_string(),
            source_path: Some(source_exe.to_string_lossy().to_string()),
            text: None,
            optional: false,
        }];
        install_plugin_to_user_dir_at_with_writer(
            &root,
            plugin_id,
            &manifest,
            false,
            Some(&manifest_path.to_string_lossy()),
            &assets,
            write_user_json_at,
        )
        .expect("executable plugin should install");
        write_user_json_at(
            &root,
            USER_PLUGIN_SETTINGS_PATH,
            &json!({
                "externalRunnerEnabled": true,
                "pythonPath": "python"
            }),
        )
        .expect("settings should be written");
        let result =
            run_external_command_at(&root, plugin_id, &external_test_context(), "python", 2000)
                .expect("executable should return a process result");
        assert_eq!(result.status, "success");
        assert_eq!(result.exit_code, Some(0));
        assert!(!result.stdout.trim().is_empty());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn external_executable_runner_handles_actions_exit_and_timeout() {
        let root = test_root("external-executable-protocol");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        let source_dir = root.join("source-executable-protocol");
        fs::create_dir_all(&source_dir).expect("source directory should exist");
        let source = source_dir.join("plugin.rs");
        fs::write(
            &source,
            r#"
use std::{io::{self, Read}, process, thread, time::Duration};
fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    if input.contains("\"text\":\"exit\"") { process::exit(7); }
    if input.contains("\"text\":\"timeout\"") { thread::sleep(Duration::from_secs(2)); }
    println!("{{\"actions\":[{{\"type\":\"showMessage\",\"level\":\"info\",\"message\":\"exe ok\"}}]}}");
}
"#,
        )
        .expect("helper source should be written");
        let source_exe = source_dir.join("plugin.exe");
        let compile = Command::new("rustc")
            .arg(&source)
            .arg("-o")
            .arg(&source_exe)
            .output()
            .expect("rustc should compile executable test helper");
        assert!(
            compile.status.success(),
            "helper compile failed: {}",
            String::from_utf8_lossy(&compile.stderr)
        );

        let manifest_path = source_dir.join(MANIFEST_FILE_NAME);
        fs::write(&manifest_path, "{}").expect("source manifest should exist");
        let plugin_id = "localmindmap.test.external.executable.protocol";
        let manifest = test_external_executable_plugin(plugin_id, "plugin.exe");
        let assets = vec![PluginInstallAsset {
            relative_path: "plugin.exe".to_string(),
            source_path: Some(source_exe.to_string_lossy().to_string()),
            text: None,
            optional: false,
        }];
        install_plugin_to_user_dir_at_with_writer(
            &root,
            plugin_id,
            &manifest,
            false,
            Some(&manifest_path.to_string_lossy()),
            &assets,
            write_user_json_at,
        )
        .expect("executable plugin should install");
        write_user_json_at(
            &root,
            USER_PLUGIN_SETTINGS_PATH,
            &json!({ "externalRunnerEnabled": true, "pythonPath": "python" }),
        )
        .expect("settings should be written");

        let success =
            run_external_command_at(&root, plugin_id, &external_test_context(), "python", 2000)
                .expect("executable should run");
        assert_eq!(success.status, "success");
        assert_eq!(
            serde_json::from_str::<Value>(&success.stdout).expect("stdout should be JSON")
                ["actions"][0]["message"],
            "exe ok"
        );

        let mut exit_context = external_test_context();
        exit_context["selectedNode"]["text"] = json!("exit");
        let failed = run_external_command_at(&root, plugin_id, &exit_context, "python", 2000)
            .expect("non-zero exit should return process result");
        assert_eq!(failed.status, "failed");
        assert_eq!(failed.exit_code, Some(7));

        let mut timeout_context = external_test_context();
        timeout_context["selectedNode"]["text"] = json!("timeout");
        let timed_out = run_external_command_at(&root, plugin_id, &timeout_context, "python", 100)
            .expect("timeout should return process result");
        assert_eq!(timed_out.status, "timeout");
        assert!(timed_out.duration_ms < 1500);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn creates_valid_python_sample_without_overwriting_existing_files() {
        let root = test_root("python-sample");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        let created =
            create_sample_python_plugin_at(&root).expect("Python sample creation should succeed");
        assert!(created.created);
        assert!(Path::new(&created.manifest_path).is_file());
        assert!(Path::new(created.main_path.as_deref().unwrap_or_default()).is_file());
        let existing = create_sample_python_plugin_at(&root)
            .expect("existing Python sample should be reported");
        assert!(!existing.created);
        let _ = fs::remove_dir_all(root);
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
    fn reliable_local_file_write_replaces_content_atomically() {
        let root = test_root("atomic-local-file");
        fs::create_dir_all(&root).expect("test directory should be created");
        let target = root.join("map.lmind");
        fs::write(&target, "old").expect("fixture should be written");

        write_local_file_reliable_at(None, &target, b"new", None)
            .expect("atomic write should succeed");

        assert_eq!(
            fs::read_to_string(&target).expect("target should be readable"),
            "new"
        );
        assert!(fs::read_dir(&root)
            .expect("root should list")
            .all(|entry| !entry
                .expect("entry should be readable")
                .file_name()
                .to_string_lossy()
                .contains(".tmp")));
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn reliable_local_file_write_failure_keeps_original_file() {
        let root = test_root("atomic-local-file-failure");
        fs::create_dir_all(&root).expect("test directory should be created");
        let target = root.join("map.lmind");
        fs::write(&target, "old").expect("fixture should be written");
        let missing_target = root.join("missing").join("map.lmind");

        let result = write_local_file_reliable_at(None, &missing_target, b"new", None);

        assert!(result.is_err());
        assert_eq!(
            fs::read_to_string(&target).expect("original should be readable"),
            "old"
        );
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn file_backups_are_created_and_pruned_per_file() {
        let root = test_root("file-backup-prune");
        let documents = root.join("documents");
        fs::create_dir_all(&documents).expect("documents directory should exist");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let target = documents.join("map.lmind");
        fs::write(&target, "v1").expect("fixture should be written");
        let options = SaveBackupOptions {
            enabled: true,
            max_backups_per_file: Some(2),
            throttle_ms: None,
        };

        for index in 0..3 {
            write_local_file_reliable_at(
                Some(&root),
                &target,
                format!("v{}", index + 2).as_bytes(),
                Some(&options),
            )
            .expect("reliable write should succeed");
        }

        let backup_dir = backup_dir_for_file(&root, &target);
        let backups = fs::read_dir(&backup_dir)
            .expect("backup directory should exist")
            .filter_map(Result::ok)
            .filter(|entry| entry.path().is_file())
            .count();
        assert_eq!(backups, 2);
        assert_eq!(
            fs::read_to_string(&target).expect("target should be readable"),
            "v4"
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
            "config/plugin-settings.json",
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

    #[test]
    fn creates_valid_batch_script_sample_without_overwriting_existing_files() {
        let root = test_root("sample-batch-script-plugin");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");

        let created = create_sample_batch_script_plugin_at(&root)
            .expect("batch script sample creation should succeed");
        assert!(created.created);
        let manifest_path = PathBuf::from(&created.manifest_path);
        let main_path = PathBuf::from(
            created
                .main_path
                .as_ref()
                .expect("batch script sample should include main.js"),
        );
        assert!(manifest_path.is_file());
        assert!(main_path.is_file());

        let manifest: Value = serde_json::from_str(
            &fs::read_to_string(&manifest_path).expect("sample manifest should be readable"),
        )
        .expect("sample manifest should be JSON");
        validate_declarative_manifest(SAMPLE_BATCH_SCRIPT_PLUGIN_ID, &manifest)
            .expect("batch script sample should satisfy the schema");
        assert_eq!(
            manifest["contributions"]["menus"][1]["location"],
            "node-context"
        );
        assert!(fs::read_to_string(&main_path)
            .expect("main.js should be readable")
            .contains("addChildNodes"));

        fs::write(&main_path, "user-owned content")
            .expect("test should replace main.js with user content");
        let existing = create_sample_batch_script_plugin_at(&root)
            .expect("existing batch sample should be reported");
        assert!(!existing.created);
        assert_eq!(
            fs::read_to_string(&main_path).expect("main.js should remain readable"),
            "user-owned content"
        );

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn creates_valid_workflow_sample_without_overwriting_existing_files() {
        let root = test_root("sample-workflow-plugin");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");

        let created = create_sample_workflow_plugin_at(&root)
            .expect("workflow sample creation should succeed");
        assert!(created.created);
        let manifest_path = PathBuf::from(&created.manifest_path);
        let readme_path = PathBuf::from(&created.readme_path);
        assert!(manifest_path.is_file());
        assert!(readme_path.is_file());
        assert!(created.main_path.is_none());

        let manifest: Value = serde_json::from_str(
            &fs::read_to_string(&manifest_path).expect("manifest should be readable"),
        )
        .expect("workflow manifest should be JSON");
        validate_declarative_manifest(SAMPLE_WORKFLOW_PLUGIN_ID, &manifest)
            .expect("workflow sample should satisfy the schema");
        assert_eq!(manifest["pluginType"], "action-workflow");
        assert_eq!(
            manifest["contributions"]["menus"][1]["location"],
            "node-context"
        );

        fs::write(&readme_path, "user-owned content")
            .expect("test should replace README with user content");
        let existing = create_sample_workflow_plugin_at(&root)
            .expect("existing workflow sample should be reported");
        assert!(!existing.created);
        assert_eq!(
            fs::read_to_string(&readme_path).expect("README should remain readable"),
            "user-owned content"
        );

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn validates_workflow_schema_and_command_ownership() {
        let valid: Value = serde_json::from_str(SAMPLE_WORKFLOW_PLUGIN_MANIFEST)
            .expect("bundled workflow should parse");
        validate_declarative_manifest(SAMPLE_WORKFLOW_PLUGIN_ID, &valid)
            .expect("bundled workflow should validate");

        let mut missing_workflow = valid.clone();
        missing_workflow
            .as_object_mut()
            .expect("manifest should be object")
            .remove("workflow");
        assert!(
            validate_declarative_manifest(SAMPLE_WORKFLOW_PLUGIN_ID, &missing_workflow)
                .expect_err("missing workflow should fail")
                .contains("workflow")
        );

        let mut wrong_command = valid.clone();
        wrong_command["contributions"]["menus"][0]["command"] =
            Value::String("plugin.runScript".to_string());
        assert!(
            validate_declarative_manifest(SAMPLE_WORKFLOW_PLUGIN_ID, &wrong_command)
                .expect_err("workflow runScript command should fail")
                .contains("plugin.runWorkflow")
        );

        let mut executable_field = valid;
        executable_field["workflow"]["runtime"] = Value::String("node".to_string());
        assert!(
            validate_declarative_manifest(SAMPLE_WORKFLOW_PLUGIN_ID, &executable_field)
                .expect_err("workflow runtime should fail")
                .contains("runtime")
        );
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
            None,
            &[],
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
            None,
            &[],
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
            None,
            &[],
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
            None,
            &[],
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
        assert!(manifest.get("enabled").is_none());
        assert!(manifest.get("trusted").is_none());
        assert_eq!(registry[0]["pluginId"], plugin_id);
        assert!(registry[0].get("version").is_none());
        assert_eq!(registry[0]["enabled"], true);
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
        let registry_before =
            read_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, Value::Array(vec![]))
                .expect("initial registry should be readable");

        let mut update = first.clone();
        update["version"] = Value::String("1.0.1".to_string());
        install_plugin_to_user_dir_at_with_writer(
            &root,
            plugin_id,
            &update,
            true,
            None,
            &[],
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
        assert_eq!(registry, registry_before);
        assert!(registry[0].get("version").is_none());
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

    #[test]
    fn script_manifest_requires_safe_js_entry() {
        let plugin_id = "localmindmap.test.script.schema";
        let mut missing = test_script_plugin(plugin_id);
        missing.as_object_mut().unwrap().remove("entry");
        assert!(validate_declarative_manifest(plugin_id, &missing)
            .expect_err("missing entry should fail")
            .contains("entry"));

        for entry in ["/tmp/main.js", "../main.js", "main.ts"] {
            let mut manifest = test_script_plugin(plugin_id);
            manifest["entry"] = Value::String(entry.to_string());
            assert!(
                validate_declarative_manifest(plugin_id, &manifest).is_err(),
                "{entry} should be rejected"
            );
        }
    }

    #[test]
    fn script_install_requires_entry_file_and_copies_it() {
        let root = test_root("script-plugin-install");
        ensure_user_data_dirs_at(&root).expect("user directories should be created");
        let plugin_id = "localmindmap.test.script.install";
        let manifest = test_script_plugin(plugin_id);
        let source_dir = root.join("source-script-plugin");
        fs::create_dir_all(&source_dir).expect("source directory should be created");
        let manifest_path = source_dir.join(MANIFEST_FILE_NAME);
        fs::write(&manifest_path, serde_json::to_string(&manifest).unwrap())
            .expect("source manifest should be written");
        let manifest_path_string = manifest_path.to_string_lossy().to_string();

        let missing_asset = PluginInstallAsset {
            relative_path: "main.js".to_string(),
            source_path: Some(source_dir.join("main.js").to_string_lossy().to_string()),
            text: None,
            optional: false,
        };
        let error = install_plugin_to_user_dir_at_with_writer(
            &root,
            plugin_id,
            &manifest,
            false,
            Some(&manifest_path_string),
            &[missing_asset],
            write_user_json_at,
        )
        .expect_err("missing main.js should fail");
        assert!(error.contains("脚本入口文件不存在：main.js"));

        fs::write(
            source_dir.join("main.js"),
            "async function run(){ return []; }",
        )
        .expect("entry should be written");
        let asset = PluginInstallAsset {
            relative_path: "main.js".to_string(),
            source_path: Some(source_dir.join("main.js").to_string_lossy().to_string()),
            text: None,
            optional: false,
        };
        install_plugin_to_user_dir_at_with_writer(
            &root,
            plugin_id,
            &manifest,
            false,
            Some(&manifest_path_string),
            &[asset],
            write_user_json_at,
        )
        .expect("script plugin should install with entry");

        let installed_entry = root.join(format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}/main.js"));
        assert!(installed_entry.is_file());
        assert_eq!(
            fs::read_to_string(installed_entry).expect("installed entry should be readable"),
            "async function run(){ return []; }"
        );
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn plugin_package_rejects_missing_invalid_and_unsafe_manifest_cases() {
        let root = test_root("package-invalid");
        fs::create_dir_all(&root).expect("test root should exist");

        let missing = root.join("missing.lmplugin");
        write_test_plugin_package(&missing, &[("main.py", b"print('{}')")]);
        assert!(inspect_plugin_package(&missing)
            .expect_err("missing manifest should fail")
            .contains("缺少 manifest.json"));

        let invalid = root.join("invalid-json.lmplugin");
        write_test_plugin_package(&invalid, &[("manifest.json", b"{ broken")]);
        assert!(inspect_plugin_package(&invalid)
            .expect_err("invalid manifest JSON should fail")
            .contains("manifest JSON 无效"));

        let plugin_id = "localmindmap.test.package.invalid";
        let manifest = test_external_python_plugin(plugin_id);
        let manifest_bytes = serde_json::to_vec(&manifest).expect("manifest should serialize");
        let missing_entry = root.join("missing-entry.lmplugin");
        write_test_plugin_package(&missing_entry, &[("manifest.json", &manifest_bytes)]);
        assert!(inspect_plugin_package(&missing_entry)
            .expect_err("missing entry should fail")
            .contains("entry 文件不存在"));

        let mut unsafe_manifest = manifest;
        unsafe_manifest["entry"] = json!("../bad.py");
        let unsafe_bytes =
            serde_json::to_vec(&unsafe_manifest).expect("unsafe manifest should serialize");
        let unsafe_entry = root.join("unsafe-entry.lmplugin");
        write_test_plugin_package(
            &unsafe_entry,
            &[("manifest.json", &unsafe_bytes), ("bad.py", b"")],
        );
        assert!(inspect_plugin_package(&unsafe_entry)
            .expect_err("unsafe entry should fail")
            .contains("entry 路径非法"));

        let zip_slip = root.join("zip-slip.lmplugin");
        write_test_plugin_package(
            &zip_slip,
            &[
                ("manifest.json", &manifest_bytes),
                ("main.py", b"print('{}')"),
                ("../outside.txt", b"bad"),
            ],
        );
        assert!(inspect_plugin_package(&zip_slip)
            .expect_err("zip slip should fail")
            .contains("插件包包含非法路径"));
        assert!(!root.join("outside.txt").exists());

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn plugin_import_dispatch_is_case_insensitive_and_never_parses_package_bytes_as_json() {
        assert_eq!(
            classify_plugin_import(
                r#"  "C:\plugins\valid-python.LMPLUGIN?download=1"  "#,
                "valid-python.LMPLUGIN?download=1"
            ),
            Ok(PluginImportKind::Package)
        );
        assert_eq!(
            classify_plugin_import("C:/plugins/manifest.JSON#selected", r#"' manifest.JSON '"#),
            Ok(PluginImportKind::Manifest)
        );

        let root = test_root("package-dispatch");
        fs::create_dir_all(&root).expect("test root should exist");
        let plugin_id = "localmindmap.test.package.dispatch";
        let manifest = test_external_python_plugin(plugin_id);
        let manifest_bytes = serde_json::to_vec(&manifest).expect("manifest should serialize");
        let package_without_extension = root.join("selected-plugin");
        write_test_plugin_package(
            &package_without_extension,
            &[
                ("manifest.json", &manifest_bytes),
                ("main.py", b"print('{\"actions\": []}')"),
                ("README.md", b"# Dispatch"),
            ],
        );
        let opened = read_plugin_import_at(
            &package_without_extension,
            r#"" valid-python-keyword-plugin.LMPLUGIN?source=test ""#,
        )
        .expect("package should be dispatched by its display name");
        assert_eq!(opened.kind, "lmplugin");
        assert_eq!(opened.manifest["pluginId"], plugin_id);

        let broken_package = root.join("broken.lmplugin");
        fs::write(&broken_package, b"PK not a zip").expect("broken package should be written");
        let error = read_plugin_import_at(&broken_package, "broken.lmplugin")
            .expect_err("broken package should fail as a package");
        assert!(error.contains("插件包无效 / 无法解压"));
        assert!(!error.contains("manifest JSON 无效"));

        let json_path = root.join("manifest.JSON");
        fs::write(&json_path, &manifest_bytes).expect("JSON manifest should be written");
        let opened_json = read_plugin_import_at(&json_path, "manifest.JSON")
            .expect("JSON manifest should use manifest flow");
        assert_eq!(opened_json.kind, "manifest");
        assert_eq!(opened_json.manifest["pluginId"], plugin_id);

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn utf8_bom_manifest_is_supported_for_json_packages_and_installed_scans() {
        assert_eq!(strip_utf8_bom("\u{feff}{\"ok\":true}"), "{\"ok\":true}");
        assert_eq!(
            strip_utf8_bom("{\"value\":\"\u{feff}kept\"}"),
            "{\"value\":\"\u{feff}kept\"}"
        );

        let root = test_root("manifest-bom");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        let plugin_id = "localmindmap.test.package.bom";
        let manifest = test_external_python_plugin(plugin_id);
        let manifest_json = serde_json::to_vec(&manifest).expect("manifest should serialize");
        let mut bom_manifest = vec![0xef, 0xbb, 0xbf];
        bom_manifest.extend_from_slice(&manifest_json);

        let json_path = root.join("bom-manifest.json");
        fs::write(&json_path, &bom_manifest).expect("BOM JSON manifest should be written");
        let opened_json = read_plugin_import_at(&json_path, "bom-manifest.json")
            .expect("ordinary BOM JSON manifest should import");
        assert_eq!(opened_json.kind, "manifest");
        assert_eq!(opened_json.manifest["pluginId"], plugin_id);

        let package_path = root.join("bom-plugin.lmplugin");
        write_test_plugin_package(
            &package_path,
            &[
                ("manifest.json", &bom_manifest),
                ("main.py", b"print('{\"actions\": []}')"),
                ("README.md", b"# BOM package"),
            ],
        );
        let opened_package = read_plugin_import_at(&package_path, "bom-plugin.lmplugin")
            .expect("BOM package manifest should import");
        assert_eq!(opened_package.kind, "lmplugin");
        assert_eq!(opened_package.manifest["pluginId"], plugin_id);
        install_test_plugin_package(&root, &package_path, &opened_package.manifest, false)
            .expect("BOM package should install");
        let installed_dir = root.join(format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}"));
        assert!(installed_dir.join(MANIFEST_FILE_NAME).is_file());
        assert!(installed_dir.join("main.py").is_file());
        assert!(installed_dir.join("README.md").is_file());

        let scanned_plugin_id = "localmindmap.test.installed.bom";
        let scanned_dir = root.join(format!("{USER_PLUGIN_INSTALLED_DIR}/{scanned_plugin_id}"));
        fs::create_dir_all(&scanned_dir).expect("installed scan directory should exist");
        let scanned_manifest = test_declarative_plugin(scanned_plugin_id);
        let mut scanned_bom = vec![0xef, 0xbb, 0xbf];
        scanned_bom.extend_from_slice(
            &serde_json::to_vec(&scanned_manifest).expect("scan manifest should serialize"),
        );
        fs::write(scanned_dir.join(MANIFEST_FILE_NAME), scanned_bom)
            .expect("installed BOM manifest should be written");
        let scanned = scan_installed_plugin_manifests_at(&root, &[])
            .expect("installed manifests should scan");
        assert!(scanned.iter().any(|entry| {
            entry.plugin_id_hint == scanned_plugin_id
                && entry
                    .manifest
                    .as_ref()
                    .and_then(|value| value.get("pluginId"))
                    == Some(&json!(scanned_plugin_id))
                && entry.error.is_none()
        }));

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn plugin_package_install_is_atomic_and_preserves_lifecycle_state() {
        let root = test_root("package-install");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        let plugin_id = "localmindmap.test.package.python";
        let manifest = test_external_python_plugin(plugin_id);
        let manifest_bytes = serde_json::to_vec(&manifest).expect("manifest should serialize");

        let broken_package = root.join("broken-extraction.lmplugin");
        write_test_plugin_package(
            &broken_package,
            &[
                ("manifest.json", &manifest_bytes),
                ("main.py", b"print('{}')"),
                ("conflict", b"file"),
                ("conflict/nested.txt", b"cannot be created"),
            ],
        );
        install_test_plugin_package(&root, &broken_package, &manifest, false)
            .expect_err("extraction failure should abort installation");
        assert!(!root
            .join(format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}"))
            .exists());
        assert!(!root
            .join(format!(
                "{USER_PLUGIN_INSTALLED_DIR}/.{plugin_id}.installing"
            ))
            .exists());
        let failed_registry = read_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, json!([]))
            .expect("registry should remain readable");
        assert!(!plugin_registry_contains(&failed_registry, plugin_id)
            .expect("registry should stay valid"));

        let package = root.join("valid.lmplugin");
        write_test_plugin_package(
            &package,
            &[
                ("manifest.json", &manifest_bytes),
                ("main.py", b"print('{\"actions\": []}')"),
                ("README.md", b"# Test"),
            ],
        );
        install_test_plugin_package(&root, &package, &manifest, false)
            .expect("package should install");
        let installed_dir = root.join(format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}"));
        assert!(installed_dir.join(MANIFEST_FILE_NAME).is_file());
        assert_eq!(
            fs::read(installed_dir.join("main.py")).expect("entry should be readable"),
            b"print('{\"actions\": []}')"
        );
        assert_eq!(
            fs::read(installed_dir.join("README.md")).expect("README should be copied"),
            b"# Test"
        );
        let initial_registry = read_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, json!([]))
            .expect("registry should be readable");
        let lifecycle_keys = initial_registry[0]
            .as_object()
            .expect("registry entry should be an object")
            .keys()
            .cloned()
            .collect::<HashSet<_>>();
        assert_eq!(
            lifecycle_keys,
            HashSet::from([
                "pluginId".to_string(),
                "enabled".to_string(),
                "trusted".to_string(),
                "installedAt".to_string(),
                "updatedAt".to_string(),
            ])
        );
        assert_eq!(initial_registry[0]["trusted"], false);

        let mut registry = read_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, json!([]))
            .expect("registry should be readable");
        registry[0]["enabled"] = json!(false);
        registry[0]["trusted"] = json!(true);
        write_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, &registry)
            .expect("registry should update");

        let mut update = manifest.clone();
        update["version"] = json!("2.0.0");
        let update_bytes = serde_json::to_vec(&update).expect("update should serialize");
        let update_package = root.join("update.lmplugin");
        write_test_plugin_package(
            &update_package,
            &[
                ("manifest.json", &update_bytes),
                ("main.py", b"print('{\"actions\": []}')"),
            ],
        );
        install_test_plugin_package(&root, &update_package, &update, true)
            .expect("package overwrite should succeed");
        let updated_registry = read_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, json!([]))
            .expect("updated registry should be readable");
        assert_eq!(updated_registry[0]["enabled"], false);
        assert_eq!(updated_registry[0]["trusted"], true);
        let installed_manifest: Value = serde_json::from_str(
            &fs::read_to_string(installed_dir.join(MANIFEST_FILE_NAME))
                .expect("installed manifest should be readable"),
        )
        .expect("installed manifest should parse");
        assert_eq!(installed_manifest["version"], "2.0.0");
        assert!(installed_manifest.get("enabled").is_none());
        assert!(installed_manifest.get("trusted").is_none());

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn exported_plugin_package_excludes_private_state_and_can_be_reimported() {
        let root = test_root("package-export");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        let plugin_id = "localmindmap.test.package.export";
        let manifest = test_external_python_plugin(plugin_id);
        let manifest_bytes = serde_json::to_vec(&manifest).expect("manifest should serialize");
        let package = root.join("source.lmplugin");
        write_test_plugin_package(
            &package,
            &[
                ("manifest.json", &manifest_bytes),
                ("main.py", b"print('{\"actions\": []}')"),
                ("README.md", b"# Export test"),
            ],
        );
        install_test_plugin_package(&root, &package, &manifest, false)
            .expect("source package should install");

        let exported = root.join("exported.lmplugin");
        export_plugin_package_at(&root, plugin_id, &exported)
            .expect("plugin package should export");
        let inspected = inspect_plugin_package(&exported).expect("export should be importable");
        assert_eq!(
            inspected.files,
            HashSet::from([
                "manifest.json".to_string(),
                "main.py".to_string(),
                "README.md".to_string()
            ])
        );
        assert!(inspected.manifest.get("trusted").is_none());
        assert!(inspected.manifest.get("installedAt").is_none());
        assert!(!inspected.files.iter().any(|path| path.contains("registry")));

        let second_root = test_root("package-reimport");
        ensure_user_data_dirs_at(&second_root).expect("second user root should exist");
        install_test_plugin_package(&second_root, &exported, &inspected.manifest, false)
            .expect("exported package should re-import");
        let registry = read_user_json_at(&second_root, USER_PLUGIN_REGISTRY_PATH, json!([]))
            .expect("new registry should be readable");
        assert_eq!(registry[0]["trusted"], false);
        assert!(second_root
            .join(format!("{USER_PLUGIN_INSTALLED_DIR}/{plugin_id}/main.py"))
            .is_file());

        fs::remove_dir_all(root).expect("test directory should be removable");
        fs::remove_dir_all(second_root).expect("second test directory should be removable");
    }

    #[test]
    fn bundled_plugin_gallery_catalog_is_valid_and_installable() {
        let catalog = load_plugin_gallery_catalog_from_text(PLUGIN_GALLERY_CATALOG);
        assert_eq!(catalog.version, 1);
        assert!(catalog.error.is_none());
        assert_eq!(catalog.items.len(), 4);
        assert!(catalog.items.iter().all(|item| item.installable));
        assert_eq!(
            catalog
                .items
                .iter()
                .map(|item| item.catalog.plugin_type.as_str())
                .collect::<HashSet<_>>(),
            HashSet::from([
                "import-export",
                "action-workflow",
                "script",
                "external-command"
            ])
        );
    }

    #[test]
    fn plugin_gallery_rejects_unsafe_and_missing_catalog_paths() {
        for path in [
            "../manifest.json",
            "C:/plugins/manifest.json",
            "https://example.com/manifest.json",
            "plugin/../manifest.json",
        ] {
            assert!(
                validate_gallery_catalog_path(path).is_err(),
                "{path} should be rejected"
            );
        }
        assert_eq!(
            validate_gallery_catalog_path("safe-plugin/manifest.json")
                .expect("safe relative path should pass"),
            "safe-plugin/manifest.json"
        );

        let mut catalog: Value =
            serde_json::from_str(PLUGIN_GALLERY_CATALOG).expect("catalog should parse");
        catalog["items"][0]["path"] = json!("missing-plugin/manifest.json");
        let result = load_plugin_gallery_catalog_from_text(&catalog.to_string());
        assert!(result.error.is_none());
        assert!(!result.items[0].installable);
        assert!(result.items[0]
            .error
            .as_deref()
            .unwrap_or_default()
            .contains("不存在"));
    }

    #[test]
    fn damaged_gallery_catalog_does_not_affect_installed_plugin_scan() {
        let root = test_root("gallery-damaged-catalog");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        let plugin_id = "localmindmap.test.gallery-isolation";
        let manifest = test_declarative_plugin(plugin_id);
        install_plugin_to_user_dir_at(&root, plugin_id, &manifest, false)
            .expect("existing plugin should install");

        let catalog = load_plugin_gallery_catalog_from_text("{broken");
        assert!(catalog.error.is_some());
        assert!(catalog.items.is_empty());
        let installed =
            scan_installed_plugin_manifests_at(&root, &[]).expect("scan should still work");
        assert!(installed
            .iter()
            .any(|entry| entry.plugin_id_hint == plugin_id && entry.error.is_none()));
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn gallery_installs_all_plugin_types_and_keeps_manifest_metadata_clean() {
        let root = test_root("gallery-install-all");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        let catalog = load_plugin_gallery_catalog_from_text(PLUGIN_GALLERY_CATALOG);
        for item in &catalog.items {
            let result = install_gallery_plugin_at(
                &root,
                PLUGIN_GALLERY_CATALOG,
                &item.catalog.id,
                false,
                Some("2026-07-04T00:00:00.000Z"),
            )
            .expect("gallery plugin should install");
            let installed_dir = root.join(&result.installed_dir);
            let manifest: Value = parse_json_without_bom(
                &fs::read_to_string(installed_dir.join(MANIFEST_FILE_NAME))
                    .expect("manifest should be copied"),
            )
            .expect("manifest should parse");
            assert_eq!(manifest["pluginId"], item.catalog.id);
            assert!(manifest.get("trusted").is_none());
            assert!(manifest.get("enabled").is_none());
            assert!(installed_dir.join("README.md").is_file());
            if let Some(entry) = manifest.get("entry").and_then(Value::as_str) {
                assert!(installed_dir.join(entry).is_file());
            }
        }
        let registry = read_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, json!([]))
            .expect("registry should be readable");
        let registry = registry.as_array().expect("registry should be an array");
        assert_eq!(registry.len(), 4);
        assert!(registry.iter().all(|entry| entry["trusted"] == false
            && entry["enabled"] == true
            && entry["installedAt"] == "2026-07-04T00:00:00.000Z"));
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn gallery_overwrite_preserves_enabled_and_trusted() {
        let root = test_root("gallery-overwrite-lifecycle");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        let plugin_id = "builtin-gallery.script-batch";
        install_gallery_plugin_at(
            &root,
            PLUGIN_GALLERY_CATALOG,
            plugin_id,
            false,
            Some("2026-07-04T00:00:00.000Z"),
        )
        .expect("gallery plugin should install");
        let mut registry = read_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, json!([]))
            .expect("registry should be readable");
        registry[0]["enabled"] = json!(false);
        registry[0]["trusted"] = json!(true);
        write_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, &registry)
            .expect("registry should update");

        install_gallery_plugin_at(
            &root,
            PLUGIN_GALLERY_CATALOG,
            plugin_id,
            true,
            Some("2026-07-05T00:00:00.000Z"),
        )
        .expect("gallery plugin should reinstall");
        let registry = read_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, json!([]))
            .expect("registry should be readable");
        assert_eq!(registry[0]["enabled"], false);
        assert_eq!(registry[0]["trusted"], true);
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn unavailable_gallery_install_does_not_pollute_registry() {
        let root = test_root("gallery-unavailable-rollback");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        let mut catalog: Value =
            serde_json::from_str(PLUGIN_GALLERY_CATALOG).expect("catalog should parse");
        catalog["items"][0]["path"] = json!("missing/manifest.json");
        let error = install_gallery_plugin_at(
            &root,
            &catalog.to_string(),
            "builtin-gallery.text-export",
            false,
            Some("2026-07-04T00:00:00.000Z"),
        )
        .expect_err("missing gallery asset should fail");
        assert!(error.contains("不存在"));
        let registry = read_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, json!([]))
            .expect("registry should be readable");
        assert_eq!(registry, json!([]));
        assert!(!root
            .join(format!(
                "{USER_PLUGIN_INSTALLED_DIR}/builtin-gallery.text-export"
            ))
            .exists());
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    fn dev_project_request(plugin_id: &str, template_type: &str) -> DevPluginProjectRequest {
        DevPluginProjectRequest {
            name: format!("Test {template_type}"),
            plugin_id: plugin_id.to_string(),
            version: "1.0.0".to_string(),
            author: "Local Mindmap Test".to_string(),
            description: "Developer workbench test project.".to_string(),
            template_type: template_type.to_string(),
            menu_location: "plugins".to_string(),
            generate_readme: true,
            generate_entry: true,
            overwrite: false,
        }
    }

    fn write_dev_test_project(
        root: &Path,
        plugin_id: &str,
        manifest: &Value,
        assets: &[(&str, &[u8])],
    ) {
        let directory = root.join(USER_PLUGIN_DEV_DIR).join(plugin_id);
        fs::create_dir_all(&directory).expect("dev project directory should exist");
        fs::write(
            directory.join(MANIFEST_FILE_NAME),
            serde_json::to_vec_pretty(manifest).expect("manifest should serialize"),
        )
        .expect("manifest should be written");
        for (relative_path, bytes) in assets {
            let path = directory.join(relative_path);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).expect("asset parent should exist");
            }
            fs::write(path, bytes).expect("asset should be written");
        }
    }

    #[test]
    fn dev_workbench_creates_all_templates_without_overwriting() {
        let root = test_root("dev-create-templates");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        let templates = [
            ("localmindmap.user.export", "import-export", None),
            ("localmindmap.user.workflow", "action-workflow", None),
            ("localmindmap.user.script", "script", Some("main.js")),
            (
                "localmindmap.user.python",
                "external-command-python",
                Some("main.py"),
            ),
            (
                "localmindmap.user.executable",
                "external-command-executable",
                None,
            ),
            ("localmindmap.user.theme", "theme-pack", None),
        ];

        for (plugin_id, template_type, expected_entry) in templates {
            let request = dev_project_request(plugin_id, template_type);
            let created = create_dev_plugin_project_at(&root, &request)
                .expect("dev template should be created");
            assert!(created.created);
            assert!(!created.overwritten);
            assert!(Path::new(&created.manifest_path).is_file());
            assert!(Path::new(created.readme_path.as_deref().unwrap_or_default()).is_file());
            if let Some(entry) = expected_entry {
                assert!(
                    root.join(USER_PLUGIN_DEV_DIR)
                        .join(plugin_id)
                        .join(entry)
                        .is_file(),
                    "{template_type} should create {entry}"
                );
            }
        }
        let script = root
            .join(USER_PLUGIN_DEV_DIR)
            .join("localmindmap.user.script")
            .join("main.js");
        let script_text = fs::read_to_string(script).expect("script entry should be readable");
        assert!(script_text.contains("async function run(context)"));
        assert!(script_text.contains("示例子节点 3"));
        let python = root
            .join(USER_PLUGIN_DEV_DIR)
            .join("localmindmap.user.python")
            .join("main.py");
        let python_text = fs::read_to_string(python).expect("Python entry should be readable");
        assert!(python_text.contains("sys.stdin.reconfigure(encoding=\"utf-8\")"));
        assert!(python_text.contains("ensure_ascii=False"));

        let duplicate_request = dev_project_request("localmindmap.user.script", "script");
        let original_manifest = fs::read(
            root.join(USER_PLUGIN_DEV_DIR)
                .join("localmindmap.user.script")
                .join(MANIFEST_FILE_NAME),
        )
        .expect("original manifest should be readable");
        assert!(create_dev_plugin_project_at(&root, &duplicate_request)
            .expect_err("duplicate project should not be overwritten")
            .contains("已存在"));
        assert_eq!(
            fs::read(
                root.join(USER_PLUGIN_DEV_DIR)
                    .join("localmindmap.user.script")
                    .join(MANIFEST_FILE_NAME)
            )
            .expect("manifest should remain readable"),
            original_manifest
        );
        let mut overwrite_request = duplicate_request;
        overwrite_request.overwrite = true;
        overwrite_request.description = "Overwritten safely.".to_string();
        let overwritten = create_dev_plugin_project_at(&root, &overwrite_request)
            .expect("confirmed overwrite should succeed");
        assert!(overwritten.overwritten);

        for plugin_id in [
            "../escape",
            "C:ads",
            "localmindmap..escape",
            ".hidden",
            "CON",
        ] {
            let request = dev_project_request(plugin_id, "script");
            assert!(
                create_dev_plugin_project_at(&root, &request).is_err(),
                "{plugin_id} should be rejected"
            );
        }
        let failed_id = "localmindmap.user.failed";
        let failed_request = dev_project_request(failed_id, "unsupported");
        assert!(create_dev_plugin_project_at(&root, &failed_request).is_err());
        assert!(!root.join(USER_PLUGIN_DEV_DIR).join(failed_id).exists());
        assert!(!root
            .join(USER_PLUGIN_DEV_DIR)
            .join(format!(".{failed_id}.creating"))
            .exists());

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn dev_validation_covers_manifest_entry_permissions_and_risk() {
        let root = test_root("dev-validation");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");

        let script_id = "localmindmap.user.valid-script";
        create_dev_plugin_project_at(&root, &dev_project_request(script_id, "script"))
            .expect("valid script project should be created");
        let valid_script = validate_dev_plugin_project_at(&root, script_id);
        assert!(valid_script.valid);
        assert!(valid_script.can_package);
        assert_eq!(valid_script.entry.as_deref(), Some("main.js"));
        assert!(valid_script
            .warnings
            .iter()
            .any(|issue| issue.code == "plugin-risk-medium"));

        let script_dir = root.join(USER_PLUGIN_DEV_DIR).join(script_id);
        fs::remove_file(script_dir.join("README.md")).expect("README should be removed");
        let no_readme = validate_dev_plugin_project_at(&root, script_id);
        assert!(no_readme.valid);
        assert!(no_readme
            .warnings
            .iter()
            .any(|issue| issue.code == "readme-missing"));

        let manifest_bytes =
            fs::read(script_dir.join(MANIFEST_FILE_NAME)).expect("manifest should be readable");
        let mut bom_manifest = vec![0xef, 0xbb, 0xbf];
        bom_manifest.extend_from_slice(&manifest_bytes);
        fs::write(script_dir.join(MANIFEST_FILE_NAME), bom_manifest)
            .expect("BOM manifest should be written");
        assert!(validate_dev_plugin_project_at(&root, script_id).valid);

        let missing_manifest_id = "localmindmap.user.missing-manifest";
        fs::create_dir_all(root.join(USER_PLUGIN_DEV_DIR).join(missing_manifest_id))
            .expect("project directory should exist");
        assert!(validate_dev_plugin_project_at(&root, missing_manifest_id)
            .errors
            .iter()
            .any(|issue| issue.code == "manifest-missing"));

        let damaged_id = "localmindmap.user.damaged";
        let damaged_dir = root.join(USER_PLUGIN_DEV_DIR).join(damaged_id);
        fs::create_dir_all(&damaged_dir).expect("damaged project should exist");
        fs::write(damaged_dir.join(MANIFEST_FILE_NAME), "{broken")
            .expect("damaged manifest should be written");
        assert!(validate_dev_plugin_project_at(&root, damaged_id)
            .errors
            .iter()
            .any(|issue| issue.code == "manifest-json-invalid"));

        for (suffix, entry) in [
            ("missing-entry", "main.js"),
            ("parent-entry", "../main.js"),
            ("absolute-entry", "C:/plugins/main.js"),
            ("url-entry", "https://example.com/main.js"),
            ("ads-entry", "main.js:stream"),
            ("wrong-script-entry", "plugin.js"),
        ] {
            let plugin_id = format!("localmindmap.user.{suffix}");
            let mut manifest = test_script_plugin(&plugin_id);
            manifest["entry"] = json!(entry);
            write_dev_test_project(&root, &plugin_id, &manifest, &[]);
            let validation = validate_dev_plugin_project_at(&root, &plugin_id);
            assert!(!validation.valid, "{entry} should be invalid");
            assert!(!validation.can_package);
        }

        let forbidden_id = "localmindmap.user.forbidden-fields";
        let mut forbidden = test_script_plugin(forbidden_id);
        forbidden["shell"] = json!("cmd.exe");
        forbidden["commandLine"] = json!("cmd /c echo");
        forbidden["args"] = json!(["/c"]);
        write_dev_test_project(&root, forbidden_id, &forbidden, &[("main.js", b"")]);
        assert!(!validate_dev_plugin_project_at(&root, forbidden_id).valid);

        let bad_command_id = "localmindmap.user.bad-command";
        let mut bad_command = test_script_plugin(bad_command_id);
        bad_command["contributions"]["menus"][0]["command"] = json!("builtin.notAllowed");
        write_dev_test_project(&root, bad_command_id, &bad_command, &[("main.js", b"")]);
        assert!(validate_dev_plugin_project_at(&root, bad_command_id)
            .errors
            .iter()
            .any(|issue| issue.code == "command-not-allowed"));

        let wrong_exe_id = "localmindmap.user.wrong-executable";
        let wrong_exe = test_external_executable_plugin(wrong_exe_id, "plugin.bin");
        write_dev_test_project(
            &root,
            wrong_exe_id,
            &wrong_exe,
            &[("plugin.bin", b"binary")],
        );
        assert!(validate_dev_plugin_project_at(&root, wrong_exe_id)
            .errors
            .iter()
            .any(|issue| issue.code == "executable-entry-invalid"));

        let python_id = "localmindmap.user.valid-python";
        create_dev_plugin_project_at(
            &root,
            &dev_project_request(python_id, "external-command-python"),
        )
        .expect("valid Python project should be created");
        assert!(validate_dev_plugin_project_at(&root, python_id).valid);

        let workflow_id = "localmindmap.user.valid-workflow";
        create_dev_plugin_project_at(&root, &dev_project_request(workflow_id, "action-workflow"))
            .expect("valid workflow project should be created");
        assert!(validate_dev_plugin_project_at(&root, workflow_id).valid);

        let executable_id = "localmindmap.user.pending-executable";
        create_dev_plugin_project_at(
            &root,
            &dev_project_request(executable_id, "external-command-executable"),
        )
        .expect("executable placeholder project should be created");
        let executable_validation = validate_dev_plugin_project_at(&root, executable_id);
        assert!(!executable_validation.valid);
        assert!(executable_validation
            .errors
            .iter()
            .any(|issue| issue.message.contains("待补充 entry 文件")));

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn dev_package_is_filtered_atomic_and_reimportable() {
        let root = test_root("dev-package");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        let plugin_id = "localmindmap.user.package-script";
        create_dev_plugin_project_at(&root, &dev_project_request(plugin_id, "script"))
            .expect("script project should be created");
        let project_dir = root.join(USER_PLUGIN_DEV_DIR).join(plugin_id);
        fs::create_dir_all(project_dir.join("assets")).expect("assets directory should exist");
        fs::write(project_dir.join("assets/icon.txt"), "icon").expect("asset should be written");
        for excluded_dir in ["node_modules", ".git", "logs"] {
            fs::create_dir_all(project_dir.join(excluded_dir))
                .expect("excluded directory should exist");
            fs::write(
                project_dir.join(excluded_dir).join("private.txt"),
                "private",
            )
            .expect("excluded file should be written");
        }
        fs::write(project_dir.join("plugin-registry.json"), "{}")
            .expect("registry metadata should be written");
        fs::write(project_dir.join("trusted"), "true").expect("trusted marker should be written");
        let manifest_path = project_dir.join(MANIFEST_FILE_NAME);
        let mut manifest: Value = parse_json_without_bom(
            &fs::read_to_string(&manifest_path).expect("manifest should be readable"),
        )
        .expect("manifest should parse");
        manifest["trusted"] = json!(true);
        manifest["installedAt"] = json!("2026-07-04T00:00:00.000Z");
        manifest["updatedAt"] = json!("2026-07-04T00:00:00.000Z");
        fs::write(
            &manifest_path,
            serde_json::to_vec_pretty(&manifest).expect("manifest should serialize"),
        )
        .expect("manifest should update");

        let output = root.join("package-script.lmplugin");
        let packaged = build_dev_plugin_package_at(&root, plugin_id, &output)
            .expect("valid project should package");
        assert_eq!(packaged.package_path, output.to_string_lossy());
        assert_eq!(
            packaged.files,
            vec![
                "manifest.json".to_string(),
                "README.md".to_string(),
                "assets/icon.txt".to_string(),
                "main.js".to_string(),
            ]
        );
        let inspected = inspect_plugin_package(&output).expect("package should be importable");
        assert!(inspected.manifest.get("trusted").is_none());
        assert!(inspected.manifest.get("installedAt").is_none());
        assert!(inspected.manifest.get("updatedAt").is_none());
        assert!(!inspected.files.iter().any(|path| {
            path.contains("node_modules")
                || path.contains(".git")
                || path.contains("logs")
                || path.contains("registry")
                || path == "trusted"
        }));
        assert!(inspected.files.iter().all(|path| {
            !Path::new(path).is_absolute() && !path.contains("..") && !path.contains(':')
        }));

        let install_root = test_root("dev-package-reimport");
        ensure_user_data_dirs_at(&install_root).expect("install root should exist");
        install_test_plugin_package(&install_root, &output, &inspected.manifest, false)
            .expect("built package should re-import");
        let registry = read_user_json_at(&install_root, USER_PLUGIN_REGISTRY_PATH, json!([]))
            .expect("registry should be readable");
        assert_eq!(registry[0]["trusted"], false);

        let executable_id = "localmindmap.user.unpackageable-executable";
        create_dev_plugin_project_at(
            &root,
            &dev_project_request(executable_id, "external-command-executable"),
        )
        .expect("executable project should be created");
        let invalid_output = root.join("invalid-executable.lmplugin");
        fs::write(&invalid_output, b"previous package")
            .expect("previous package should be written");
        assert!(
            build_dev_plugin_package_at(&root, executable_id, &invalid_output)
                .expect_err("missing executable must block packaging")
                .contains("禁止打包")
        );
        assert_eq!(
            fs::read(&invalid_output).expect("previous output should remain"),
            b"previous package"
        );

        let rollback_parent = root.join("missing-parent");
        let rollback_output = rollback_parent.join("rollback.lmplugin");
        assert!(build_dev_plugin_package_at(&root, plugin_id, &rollback_output).is_err());
        assert!(!rollback_output.exists());
        assert!(!rollback_parent.join("rollback.lmplugin.tmp").exists());
        assert!(validate_plugin_package_entry_name("../escape.txt", false).is_err());
        assert!(validate_plugin_package_entry_name("safe/../../escape.txt", false).is_err());

        fs::remove_dir_all(root).expect("test directory should be removable");
        fs::remove_dir_all(install_root).expect("install root should be removable");
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn executable_package_requires_exe_entry() {
        let root = test_root("package-executable-extension");
        fs::create_dir_all(&root).expect("test root should exist");
        let plugin_id = "localmindmap.test.package.bad-executable";
        let manifest = test_external_executable_plugin(plugin_id, "plugin.bin");
        let manifest_bytes = serde_json::to_vec(&manifest).expect("manifest should serialize");
        let package = root.join("bad-executable.lmplugin");
        write_test_plugin_package(
            &package,
            &[
                ("manifest.json", &manifest_bytes),
                ("plugin.bin", b"binary"),
            ],
        );
        assert!(inspect_plugin_package(&package)
            .expect_err("non-exe executable should fail")
            .contains("entry 必须是 .exe"));
        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    fn diagnostic_fix_actions_for_tests(report: &PluginDiagnosticReport) -> Vec<String> {
        let mut actions = report
            .items
            .iter()
            .filter_map(|item| item.fix_action.clone())
            .collect::<Vec<_>>();
        actions.sort();
        actions.dedup();
        actions
    }

    #[test]
    fn plugin_diagnostics_detects_registry_states_and_bom() {
        let root = test_root("diagnostics-registry");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");

        let missing = scan_plugin_diagnostics_at(&root, Some("registry"), vec![])
            .expect("diagnostics should scan missing registry");
        assert!(missing.items.iter().any(|item| {
            item.title == "Registry missing" && item.fix_action.as_deref() == Some("create-registry")
        }));

        fs::write(root.join(USER_PLUGIN_REGISTRY_PATH), "{broken")
            .expect("damaged registry should be written");
        let damaged = scan_plugin_diagnostics_at(&root, Some("registry"), vec![])
            .expect("diagnostics should report damaged registry");
        assert!(damaged.items.iter().any(|item| {
            item.title == "Registry JSON damaged"
                && item.severity == PluginDiagnosticSeverity::Critical
        }));

        let registry = json!([
            { "pluginId": "localmindmap.test.orphan", "installedAt": "2026-07-01T00:00:00.000Z" },
            { "pluginId": "localmindmap.test.duplicate", "enabled": true, "trusted": false, "updatedAt": "2026-07-01T00:00:00.000Z" },
            { "pluginId": "localmindmap.test.duplicate", "enabled": false, "trusted": true, "updatedAt": "2026-07-02T00:00:00.000Z" }
        ]);
        fs::write(
            root.join(USER_PLUGIN_REGISTRY_PATH),
            format!("\u{feff}{}", registry),
        )
        .expect("BOM registry should be written");
        let report = scan_plugin_diagnostics_at(&root, Some("registry"), vec![])
            .expect("diagnostics should parse BOM registry");
        assert!(report.items.iter().any(|item| item.title == "Registry orphan record"));
        assert!(report.items.iter().any(|item| item.title == "Registry enabled missing"));
        assert!(report.items.iter().any(|item| item.title == "Registry trusted missing"));
        assert!(report.items.iter().any(|item| item.title == "Duplicate registry pluginId"));

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn plugin_diagnostics_fixes_registry_and_installed_orphans_with_backup() {
        let root = test_root("diagnostics-fix");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        let plugin_id = "localmindmap.test.valid-installed";
        let plugin_dir = root.join(USER_PLUGIN_INSTALLED_DIR).join(plugin_id);
        fs::create_dir_all(&plugin_dir).expect("installed plugin dir should exist");
        fs::write(
            plugin_dir.join(MANIFEST_FILE_NAME),
            serde_json::to_vec_pretty(&test_declarative_plugin(plugin_id))
                .expect("manifest should serialize"),
        )
        .expect("manifest should be written");
        let missing_state_id = "localmindmap.test.missing-state";
        let missing_state_dir = root.join(USER_PLUGIN_INSTALLED_DIR).join(missing_state_id);
        fs::create_dir_all(&missing_state_dir).expect("installed plugin dir should exist");
        fs::write(
            missing_state_dir.join(MANIFEST_FILE_NAME),
            serde_json::to_vec_pretty(&test_declarative_plugin(missing_state_id))
                .expect("manifest should serialize"),
        )
        .expect("manifest should be written");
        fs::write(
            root.join(USER_PLUGIN_REGISTRY_PATH),
            serde_json::to_vec_pretty(&json!([
                { "pluginId": "localmindmap.test.registry-orphan", "enabled": true, "trusted": false },
                { "pluginId": missing_state_id }
            ]))
            .expect("registry should serialize"),
        )
        .expect("registry should be written");

        let report = scan_plugin_diagnostics_at(&root, Some("all"), vec![])
            .expect("diagnostics should scan");
        let actions = diagnostic_fix_actions_for_tests(&report);
        assert!(actions.contains(&"add-registry:localmindmap.test.valid-installed".to_string()));
        assert!(actions.contains(&"remove-registry-orphan:localmindmap.test.registry-orphan".to_string()));
        let results = fix_plugin_diagnostics_at(&root, &actions)
            .expect("diagnostics fixes should apply");
        assert!(results.iter().all(|result| result.backup_path.is_some()));
        assert!(root.join(USER_PLUGIN_DIAGNOSTIC_BACKUP_DIR).is_dir());

        let registry = read_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, json!([]))
            .expect("registry should be readable");
        assert!(plugin_registry_contains(&registry, plugin_id).expect("registry should parse"));
        assert!(!plugin_registry_contains(&registry, "localmindmap.test.registry-orphan")
            .expect("registry should parse"));
        let missing_state = registry
            .as_array()
            .and_then(|items| {
                items.iter().find(|item| {
                    item.get("pluginId").and_then(Value::as_str)
                        == Some("localmindmap.test.missing-state")
                })
            })
            .expect("missing-state item should remain");
        assert_eq!(missing_state["enabled"], true);
        assert_eq!(missing_state["trusted"], false);

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn plugin_diagnostics_detects_installed_manifest_entry_and_lifecycle() {
        let root = test_root("diagnostics-installed");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        write_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, &json!([]))
            .expect("registry should be written");

        let lifecycle_id = "localmindmap.test.lifecycle";
        let lifecycle_dir = root.join(USER_PLUGIN_INSTALLED_DIR).join(lifecycle_id);
        fs::create_dir_all(&lifecycle_dir).expect("plugin dir should exist");
        let mut manifest = test_script_plugin(lifecycle_id);
        manifest["trusted"] = json!(true);
        manifest["installedAt"] = json!("2026-07-01T00:00:00.000Z");
        manifest["updatedAt"] = json!("2026-07-02T00:00:00.000Z");
        fs::write(
            lifecycle_dir.join(MANIFEST_FILE_NAME),
            serde_json::to_vec_pretty(&manifest).expect("manifest should serialize"),
        )
        .expect("manifest should be written");
        fs::write(lifecycle_dir.join("main.js"), "export default {};")
            .expect("entry should be written");

        let unsafe_id = "localmindmap.test.unsafe-entry";
        let unsafe_dir = root.join(USER_PLUGIN_INSTALLED_DIR).join(unsafe_id);
        fs::create_dir_all(&unsafe_dir).expect("plugin dir should exist");
        let mut unsafe_manifest = test_script_plugin(unsafe_id);
        unsafe_manifest["entry"] = json!("../main.js");
        fs::write(
            unsafe_dir.join(MANIFEST_FILE_NAME),
            serde_json::to_vec_pretty(&unsafe_manifest).expect("manifest should serialize"),
        )
        .expect("unsafe manifest should be written");

        let exe_id = "localmindmap.test.bad-exe";
        let exe_dir = root.join(USER_PLUGIN_INSTALLED_DIR).join(exe_id);
        fs::create_dir_all(&exe_dir).expect("plugin dir should exist");
        fs::write(
            exe_dir.join(MANIFEST_FILE_NAME),
            serde_json::to_vec_pretty(&test_external_executable_plugin(exe_id, "plugin.bin"))
                .expect("manifest should serialize"),
        )
        .expect("exe manifest should be written");
        fs::write(exe_dir.join("plugin.bin"), "binary").expect("entry should be written");

        let report = scan_plugin_diagnostics_at(&root, Some("installed"), vec![])
            .expect("diagnostics should scan installed plugins");
        assert!(report.items.iter().any(|item| item.title == "Manifest contains lifecycle field"));
        assert!(report.items.iter().any(|item| {
            item.title == "Entry path is unsafe"
                && item.severity == PluginDiagnosticSeverity::Critical
        }));
        assert!(report.items.iter().any(|item| item.title == "Executable entry is not .exe"));

        fix_plugin_diagnostics_at(
            &root,
            &[format!("strip-manifest-lifecycle:{lifecycle_id}")],
        )
        .expect("lifecycle fix should apply");
        let stripped: Value = parse_json_without_bom(
            &fs::read_to_string(lifecycle_dir.join(MANIFEST_FILE_NAME))
                .expect("manifest should be readable"),
        )
        .expect("manifest should parse");
        assert!(stripped.get("trusted").is_none());
        assert!(stripped.get("installedAt").is_none());
        assert!(stripped.get("updatedAt").is_none());

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    fn write_installed_test_plugin(root: &Path, plugin_id: &str, manifest: &Value) -> PathBuf {
        let plugin_dir = root.join(USER_PLUGIN_INSTALLED_DIR).join(plugin_id);
        fs::create_dir_all(&plugin_dir).expect("plugin dir should exist");
        fs::write(
            plugin_dir.join(MANIFEST_FILE_NAME),
            serde_json::to_vec_pretty(manifest).expect("manifest should serialize"),
        )
        .expect("manifest should be written");
        if manifest.get("entry").and_then(Value::as_str) == Some("main.js") {
            fs::write(plugin_dir.join("main.js"), "export default {};")
                .expect("entry should be written");
        }
        plugin_dir
    }

    fn has_lifecycle_diagnostic(
        report: &PluginDiagnosticReport,
        plugin_id: &str,
        field: Option<&str>,
    ) -> bool {
        report.items.iter().any(|item| {
            item.title == "Manifest contains lifecycle field"
                && item.plugin_id.as_deref() == Some(plugin_id)
                && field.map(|field| item.message.contains(field)).unwrap_or(true)
        })
    }

    #[test]
    fn plugin_diagnostics_lifecycle_detection_only_checks_manifest_top_level_keys() {
        let root = test_root("diagnostics-lifecycle-top-level");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        write_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, &json!([]))
            .expect("registry should be written");

        let trusted_id = "localmindmap.test.lifecycle.top.trusted";
        let mut trusted_manifest = test_script_plugin(trusted_id);
        trusted_manifest["trusted"] = json!(true);
        write_installed_test_plugin(&root, trusted_id, &trusted_manifest);

        let installed_at_id = "localmindmap.test.lifecycle.top.installedAt";
        let mut installed_at_manifest = test_script_plugin(installed_at_id);
        installed_at_manifest["installedAt"] = json!("2026-07-01T00:00:00.000Z");
        write_installed_test_plugin(&root, installed_at_id, &installed_at_manifest);

        let updated_at_id = "localmindmap.test.lifecycle.top.updatedAt";
        let mut updated_at_manifest = test_script_plugin(updated_at_id);
        updated_at_manifest["updatedAt"] = json!("2026-07-02T00:00:00.000Z");
        write_installed_test_plugin(&root, updated_at_id, &updated_at_manifest);

        let description_id = "localmindmap.test.lifecycle.description.only";
        let mut description_manifest = test_script_plugin(description_id);
        description_manifest["description"] =
            json!("用于验证 manifest 中 trusted / installedAt / updatedAt 会被诊断并移除。");
        write_installed_test_plugin(&root, description_id, &description_manifest);

        let label_id = "localmindmap.test.lifecycle.contribution.label";
        let mut label_manifest = test_script_plugin(label_id);
        label_manifest["contributions"]["menus"][0]["label"] =
            json!("trusted label should not be lifecycle state");
        write_installed_test_plugin(&root, label_id, &label_manifest);

        let report = scan_plugin_diagnostics_at(&root, Some("installed"), vec![])
            .expect("diagnostics should scan installed plugins");

        assert!(has_lifecycle_diagnostic(&report, trusted_id, Some("trusted")));
        assert!(has_lifecycle_diagnostic(
            &report,
            installed_at_id,
            Some("installedAt")
        ));
        assert!(has_lifecycle_diagnostic(
            &report,
            updated_at_id,
            Some("updatedAt")
        ));
        assert!(!has_lifecycle_diagnostic(&report, description_id, None));
        assert!(!has_lifecycle_diagnostic(&report, label_id, None));

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn plugin_diagnostics_lifecycle_fix_preserves_manifest_text_fields_and_rescan_is_clean() {
        let root = test_root("diagnostics-lifecycle-fix-description");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        write_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, &json!([]))
            .expect("registry should be written");

        let plugin_id = "localmindmap.diagnostics.test.lifecycle.in.manifest";
        let description = "用于验证 manifest 中 trusted / installedAt / updatedAt 会被诊断并移除。";
        let mut manifest = test_script_plugin(plugin_id);
        manifest["description"] = json!(description);
        manifest["trusted"] = json!(true);
        manifest["installedAt"] = json!("2026-07-01T00:00:00.000Z");
        manifest["updatedAt"] = json!("2026-07-02T00:00:00.000Z");
        let plugin_dir = write_installed_test_plugin(&root, plugin_id, &manifest);

        let initial_report = scan_plugin_diagnostics_at(&root, Some("installed"), vec![])
            .expect("diagnostics should scan installed plugins");
        assert!(has_lifecycle_diagnostic(&initial_report, plugin_id, Some("trusted")));
        assert!(has_lifecycle_diagnostic(
            &initial_report,
            plugin_id,
            Some("installedAt")
        ));
        assert!(has_lifecycle_diagnostic(
            &initial_report,
            plugin_id,
            Some("updatedAt")
        ));

        fix_plugin_diagnostics_at(&root, &[format!("strip-manifest-lifecycle:{plugin_id}")])
            .expect("lifecycle fix should apply");

        let stripped: Value = parse_json_without_bom(
            &fs::read_to_string(plugin_dir.join(MANIFEST_FILE_NAME))
                .expect("manifest should be readable"),
        )
        .expect("manifest should parse");
        assert!(stripped.get("trusted").is_none());
        assert!(stripped.get("installedAt").is_none());
        assert!(stripped.get("updatedAt").is_none());
        assert_eq!(stripped.get("description").and_then(Value::as_str), Some(description));

        let clean_report = scan_plugin_diagnostics_at(&root, Some("installed"), vec![])
            .expect("diagnostics should scan installed plugins");
        assert!(!has_lifecycle_diagnostic(&clean_report, plugin_id, None));

        let mut restored = stripped;
        restored["trusted"] = json!(true);
        fs::write(
            plugin_dir.join(MANIFEST_FILE_NAME),
            serde_json::to_vec_pretty(&restored).expect("manifest should serialize"),
        )
        .expect("manifest should be written");
        let restored_report = scan_plugin_diagnostics_at(&root, Some("installed"), vec![])
            .expect("diagnostics should scan installed plugins");
        assert!(has_lifecycle_diagnostic(&restored_report, plugin_id, Some("trusted")));

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn plugin_diagnostics_lifecycle_handles_damaged_json_and_bom_manifests() {
        let root = test_root("diagnostics-lifecycle-bom-damaged");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        write_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, &json!([]))
            .expect("registry should be written");

        let damaged_id = "localmindmap.test.lifecycle.damaged";
        let damaged_dir = root.join(USER_PLUGIN_INSTALLED_DIR).join(damaged_id);
        fs::create_dir_all(&damaged_dir).expect("plugin dir should exist");
        fs::write(damaged_dir.join(MANIFEST_FILE_NAME), "{broken")
            .expect("damaged manifest should be written");

        let bom_id = "localmindmap.test.lifecycle.bom";
        let bom_dir = root.join(USER_PLUGIN_INSTALLED_DIR).join(bom_id);
        fs::create_dir_all(&bom_dir).expect("plugin dir should exist");
        let mut bom_manifest = test_script_plugin(bom_id);
        bom_manifest["description"] =
            json!("trusted / installedAt / updatedAt appear here as ordinary text.");
        bom_manifest["trusted"] = json!(true);
        let mut bom_manifest_text =
            serde_json::to_string_pretty(&bom_manifest).expect("manifest should serialize");
        bom_manifest_text.insert(0, '\u{feff}');
        fs::write(bom_dir.join(MANIFEST_FILE_NAME), bom_manifest_text)
            .expect("BOM manifest should be written");
        fs::write(bom_dir.join("main.js"), "export default {};")
            .expect("entry should be written");

        let report = scan_plugin_diagnostics_at(&root, Some("installed"), vec![])
            .expect("diagnostics should scan installed plugins");

        assert!(report.items.iter().any(|item| {
            item.title == "Installed manifest JSON damaged"
                && item.plugin_id.as_deref() == Some(damaged_id)
        }));
        assert!(has_lifecycle_diagnostic(&report, bom_id, Some("trusted")));
        assert!(!has_lifecycle_diagnostic(&report, bom_id, Some("installedAt")));
        assert!(!has_lifecycle_diagnostic(&report, bom_id, Some("updatedAt")));

        fs::remove_dir_all(root).expect("test directory should be removable");
    }

    #[test]
    fn plugin_diagnostics_scans_dev_gallery_package_and_sanitizes_markdown() {
        let root = test_root("diagnostics-dev-gallery");
        ensure_user_data_dirs_at(&root).expect("user directories should exist");
        write_user_json_at(&root, USER_PLUGIN_REGISTRY_PATH, &json!([]))
            .expect("registry should be written");
        let dev_id = "localmindmap.user.diag-script";
        create_dev_plugin_project_at(&root, &dev_project_request(dev_id, "script"))
            .expect("dev project should be created");
        fs::remove_file(
            root.join(USER_PLUGIN_DEV_DIR)
                .join(dev_id)
                .join("README.md"),
        )
        .expect("README should be removed");

        let report = scan_plugin_diagnostics_at(&root, Some("all"), vec![])
            .expect("diagnostics should scan all scopes");
        assert!(report.counts.dev_projects >= 1);
        assert!(report.counts.gallery_examples >= 1);
        assert!(report.items.iter().any(|item| item.title == "Dev readme-missing"));
        assert!(report.items.iter().any(|item| item.category == PluginDiagnosticCategory::Package));

        let markdown = sanitized_diagnostic_report_markdown(&report);
        assert!(markdown.contains("Plugin Diagnostics Report"));
        assert!(!markdown.contains(&root.to_string_lossy().to_string()));
        assert!(!markdown.contains("async function run(context)"));
        assert!(!markdown.contains("sys.stdin"));

        fs::remove_dir_all(root).expect("test directory should be removable");
    }
}
