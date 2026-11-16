use std::{ffi::OsString, path::Path};

/// Return the requested document even if unavailable, so the UI reports the
/// open error instead of silently showing an empty document.
pub fn from_args(args: impl IntoIterator<Item = OsString>) -> Option<String> {
    args.into_iter().find_map(|arg| {
        let path = Path::new(&arg);
        path.extension()
            .filter(|ext| ext.to_string_lossy().eq_ignore_ascii_case("lmind"))
            .map(|_| path.to_string_lossy().into_owned())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_unicode_spaces_and_uppercase_extension() {
        let path = r"C:用户资料项目 计划.LMIND";
        assert_eq!(from_args([OsString::from(path)]), Some(path.into()));
    }

    #[test]
    fn ignores_unrelated_arguments_and_selects_first_document() {
        assert_eq!(
            from_args(["--verbose", "notes.txt", "first.lmind", "second.lmind"].map(OsString::from)),
            Some("first.lmind".into())
        );
        assert_eq!(from_args([OsString::from("--verbose")]), None);
    }

    #[test]
    fn keeps_unavailable_path_for_visible_error() {
        assert_eq!(from_args([OsString::from("missing.lmind")]), Some("missing.lmind".into()));
    }
}

