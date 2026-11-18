fn main() {
    if std::env::var("CARGO_CFG_TARGET_VENDOR").as_deref() == Ok("win7") {
        println!("cargo:rustc-link-arg-bin=local-mindmap-service=/SUBSYSTEM:CONSOLE,6.01");
    }
}
