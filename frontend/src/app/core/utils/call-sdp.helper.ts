/** Repair SDP text corrupted during JSON / WebSocket relay (lost or escaped newlines). */
export function fixSdpString(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  if (text.startsWith('{') && text.includes('"sdp"')) {
    try {
      const parsed = JSON.parse(text) as { sdp?: unknown };
      if (typeof parsed.sdp === 'string') {
        text = parsed.sdp.trim();
      }
    } catch {
      /* keep original */
    }
  }

  if (!text.includes('\n') && !text.includes('\r')) {
    if (text.includes('\\n') || text.includes('\\r\\n')) {
      text = text.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
    } else if (/[a-z]=/.test(text)) {
      text = text.replace(/(?<=[^\r\n])(?=[a-z]=)/g, '\n');
    }
  }

  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  return lines.join('\r\n') + '\r\n';
}
