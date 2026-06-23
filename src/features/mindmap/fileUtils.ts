export function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');

  downloadLink.href = objectUrl;
  downloadLink.download = fileName;
  downloadLink.style.display = 'none';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(objectUrl);
}

export function downloadTextFile(
  content: string,
  fileName: string,
  mimeType: string,
) {
  downloadBlob(new Blob([content], { type: mimeType }), fileName);
}

export function selectLocalFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const fileInput = document.createElement('input');

    fileInput.type = 'file';
    fileInput.accept = accept;
    fileInput.style.display = 'none';

    fileInput.addEventListener(
      'change',
      () => {
        resolve(fileInput.files?.[0] ?? null);
        fileInput.remove();
      },
      { once: true },
    );

    document.body.appendChild(fileInput);
    fileInput.click();
  });
}
