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
