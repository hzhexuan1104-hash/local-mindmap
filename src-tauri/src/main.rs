#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
use rfd::FileDialog;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fs,
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
const EXTERNAL_STDOUT_LIMIT: usize = 1024 * 1024;
const EXTERNAL_STDERR_LIMIT: usize = 64 * 1024;
const EXTERNAL_DEFAULT_TIMEOUT_MS: u64 = 5000;
const EXTERNAL_MAX_TIMEOUT_MS: u64 = 30_000;
const PLUGIN_PACKAGE_MAX_ENTRIES: usize = 1_000;
const PLUGIN_PACKAGE_MAX_FILE_SIZE: u64 = 64 * 1024 * 1024;
const PLUGIN_PACKAGE_MAX_TOTAL_SIZE: u64 = 128 * 1024 * 1024;
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
        if lower.ends_with(".dll") {
            return Err("runtime=executable 不支持 DLL。".to_string());
        }
        #[cfg(target_os = "windows")]
        if !lower.ends_with(".exe") {
            return Err("Windows 下 runtime=executable 时 entry 必须是 .exe 文件。".to_string());
        }
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

    if let Err(error) = write_json(root, &relative_staging_manifest, &installed_manifest) {
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
    if let Some(entry) = installed_manifest.get("entry").and_then(Value::as_str) {
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

fn validate_python_path(python_path: &str) -> Result<PathBuf, String> {
    let trimmed = python_path.trim();
    if trimmed.is_empty() || trimmed.contains('\0') {
        return Err("Python 路径不能为空。".to_string());
    }
    if ["python", "python3", "python.exe"].contains(&trimmed) {
        return Ok(PathBuf::from(trimmed));
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err(
            "Python 路径只允许简单命令 python/python3/python.exe 或可执行文件绝对路径。"
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
    Ok(path)
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
        .unwrap_or("python")
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

    let mut command = if runtime == "python" {
        if requested_python_path.trim() != configured_python_path {
            return Err("Python 路径与已保存配置不一致，请重新加载设置。".to_string());
        }
        let python = validate_python_path(&configured_python_path)?;
        let mut command = Command::new(python);
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
    let executable = validate_python_path(python_path)?;
    let mut command = Command::new(executable);
    command.arg("--version");
    configure_python_utf8(&mut command);
    let result = run_managed_process(
        &mut command,
        &[],
        EXTERNAL_DEFAULT_TIMEOUT_MS,
        64 * 1024,
        64 * 1024,
    )?;
    let version = if result.stdout.trim().is_empty() {
        result.stderr.trim().to_string()
    } else {
        result.stdout.trim().to_string()
    };
    Ok(PythonTestResult {
        ok: result.status == "success" && !version.is_empty(),
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
            list_user_files,
            install_plugin_to_user_dir,
            uninstall_plugin_from_user_dir,
            open_user_data_dir,
            open_plugin_dir,
            open_plugin_dev_dir,
            create_sample_plugin,
            create_sample_script_plugin,
            create_sample_batch_script_plugin,
            create_sample_workflow_plugin,
            create_sample_python_plugin,
            open_sample_script_plugin_dir,
            open_plugin_manifest_dir,
            scan_installed_plugin_manifests,
            reload_plugins_from_disk,
            open_plugin_import_with_dialog,
            install_plugin_package,
            export_plugin_package,
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
        assert_eq!(manifest["enabled"], true);
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
        assert_eq!(installed_manifest["enabled"], false);
        assert_eq!(installed_manifest["trusted"], true);

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
}
