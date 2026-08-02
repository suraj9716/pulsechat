export function formatLiveCallTimer(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function formatCallDurationLabel(seconds: number): string {
  const safe = Math.max(0, seconds);
  if (safe < 60) {
    return `Voice call · ${safe} sec`;
  }
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  if (rem === 0) {
    return `Voice call · ${mins} min`;
  }
  return `Voice call · ${mins} min ${rem} sec`;
}

export function callLogContent(wasActive: boolean, durationSeconds: number, endReason: 'hangup' | 'reject'): string {
  if (wasActive) {
    return formatCallDurationLabel(durationSeconds);
  }
  if (endReason === 'reject') {
    return 'Call declined';
  }
  return 'Missed voice call';
}
