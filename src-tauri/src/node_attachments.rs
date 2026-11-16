use std::{fs, io::Write, path::Path, process::Command, time::{SystemTime, UNIX_EPOCH}};

fn open_target(target: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("powershell.exe");
        command.args(["-NoProfile", "-NonInteractive", "-Command", "Start-Process -FilePath $env:LMIND_ATTACHMENT_TARGET"]);
        command.env("LMIND_ATTACHMENT_TARGET", target);
        command
    };
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = Command::new("xdg-open");
    #[cfg(not(target_os = "windows"))]
    command.arg(target);
    command.spawn().map_err(|error| format!("无法打开附件：{error}"))?;
    Ok(())
}

fn validate_link(url: &str) -> Result<url::Url, String> {
    let parsed = url::Url::parse(url).map_err(|_| "附件链接格式无效。".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none()
        || !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("附件链接只支持 HTTP/HTTPS。".into());
    }
    Ok(parsed)
}

pub fn open_attachment_link(url: String) -> Result<(), String> {
    open_target(validate_link(&url)?.as_str())
}

fn validate_file_name(name: &str) -> Result<(), String> {
    if name.is_empty() || name.len() > 200 || name.chars().any(|c| c.is_control() || "\\/:*?\"<>|".contains(c))
        || name.ends_with('.') || name.ends_with(' ') || name.starts_with('.') {
        return Err("附件文件名无效。".into());
    }
    let extension = Path::new(name).extension().and_then(|part| part.to_str()).unwrap_or("").to_lowercase();
    if !matches!(extension.as_str(), "pdf" | "txt" | "md" | "csv" | "tsv" | "json" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "odt" | "ods" | "odp" | "rtf" | "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp" | "mp3" | "wav" | "mp4" | "mov" | "zip" | "7z") {
        return Err("此文件类型不支持直接打开，请先另存附件。".into());
    }
    let stem = name.split('.').next().unwrap_or("").to_uppercase();
    if matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL") || (stem.len() == 4 && (stem.starts_with("COM") || stem.starts_with("LPT")) && stem.ends_with(|c: char| c.is_ascii_digit())) {
        return Err("附件文件名为系统保留名称。".into());
    }
    Ok(())
}

pub fn open_embedded_attachment(name: String, bytes: Vec<u8>) -> Result<(), String> {
    validate_file_name(&name)?;
    if bytes.len() > 20 * 1024 * 1024 { return Err("附件不能超过 20 MB。".into()); }
    // A fresh directory avoids overwriting any existing attachment or following a pre-existing link.
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
    let directory = std::env::temp_dir().join(format!("local-mindmap-attachment-{}-{nonce}", std::process::id()));
    fs::create_dir(&directory).map_err(|e| e.to_string())?;
    let path = directory.join(&name);
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&path).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    drop(file);
    open_target(path.to_str().ok_or("附件路径无法显示。")?)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn attachment_names_are_safe_and_documents_are_supported() {
        for name in ["report.pdf", "需求.docx", "data.xlsx", "notes.txt"] { assert!(validate_file_name(name).is_ok()); }
        for name in ["../test.pdf", "a\\b.pdf", "C:foo.pdf", "run.exe", "run.cmd", "CON.txt", "LPT1.pdf", "bad.pdf."] { assert!(validate_file_name(name).is_err(), "{name}"); }
    }
    #[test]
    fn attachment_links_only_open_web_urls() {
        assert!(validate_link("https://example.com/report").is_ok());
        for url in ["file:///C:/test.exe", "javascript:alert(1)", "https://user:pass@example.com", "not a url"] { assert!(validate_link(url).is_err()); }
    }
}
