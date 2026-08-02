import { MessageResponse } from '../services/chat-api.service';

export function isDuplicateMessage(a: MessageResponse, b: MessageResponse): boolean {
  if (String(a.id).toLowerCase() === String(b.id).toLowerCase()) {
    return true;
  }
  if (String(a.senderId).toLowerCase() !== String(b.senderId).toLowerCase()) {
    return false;
  }
  if ((a.content ?? '') !== (b.content ?? '')) {
    return false;
  }
  if ((a.imageUrl ?? '') !== (b.imageUrl ?? '')) {
    return false;
  }
  const delta = Math.abs(new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return delta < 5000;
}
