/** Browser-only delivery of text the server already produced; nothing runs it. */
export function downloadSqlText(text: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
