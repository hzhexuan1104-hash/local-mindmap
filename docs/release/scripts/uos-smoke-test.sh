#!/usr/bin/env bash
set -euo pipefail

package_dir=${1:?usage: uos-smoke-test.sh <package-dir> <x64|arm64>}
arch=${2:?usage: uos-smoke-test.sh <package-dir> <x64|arm64>}

case "$arch" in
  x64) expected_deb_arch=amd64 ; expected_machine='x86-64|x86_64' ;;
  arm64) expected_deb_arch=arm64 ; expected_machine='aarch64|ARM aarch64' ;;
  *) echo "unsupported UOS architecture: $arch" >&2; exit 2 ;;
esac

deb=$(find "$package_dir" -maxdepth 1 -type f -name "Local-Mindmap_*_uos_${arch}.deb" -print -quit)
appimage=$(find "$package_dir" -maxdepth 1 -type f -name "Local-Mindmap_*_uos_${arch}.AppImage" -print -quit)
test -n "$deb" && test -n "$appimage"
test "$(dpkg-deb -f "$deb" Architecture)" = "$expected_deb_arch"
dpkg-deb -c "$deb" | grep -q '\.desktop'
dpkg-deb -c "$deb" | grep -Eqi 'icons?.*\.(png|svg)'
test -x "$appimage"
file -b "$appimage" | grep -Eqi "$expected_machine"
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT
(cd "$work_dir" && "$appimage" --appimage-extract >/dev/null)
test -d "$work_dir/squashfs-root"
echo "UOS $arch package structure check passed. Complete the real-device checklist before changing candidate status."
