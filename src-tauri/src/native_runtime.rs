use serde_json::{json, Value};
use std::{io::{self, BufRead, Write}, path::PathBuf};

#[derive(Clone)]
pub struct AppHandle { root: PathBuf }
impl AppHandle {
    pub fn path(&self) -> &Self { self }
    pub fn app_data_dir(&self) -> Result<PathBuf, String> { Ok(self.root.clone()) }
}
pub fn serve(dispatch: fn(AppHandle, &str, Value) -> Result<Value, String>) {
    let Some(root) = std::env::var_os("LMIND_DATA_DIR") else { eprintln!("LMIND_DATA_DIR is required"); return; };
    let app = AppHandle { root: PathBuf::from(root) };
    for line in io::stdin().lock().lines() {
        let Ok(line) = line else { break };
        let request: Value = match serde_json::from_str(&line) { Ok(v) => v, Err(_) => continue };
        let id = request["id"].clone();
        let result = dispatch(app.clone(), request["command"].as_str().unwrap_or(""), request["args"].clone());
        let reply = match result { Ok(value) => json!({"id":id,"result":value}), Err(error) => json!({"id":id,"error":error}) };
        let mut out = io::stdout().lock();
        if writeln!(out, "{reply}").and_then(|_| out.flush()).is_err() { break; }
    }
}
