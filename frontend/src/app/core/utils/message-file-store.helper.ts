import { MessageResponse } from '../services/chat-api.service';

const ROOT = 'PulseChat';
const LS_PREFIX = 'pulsechat_history_v2';

export function normalizeStorageKey(id: string): string {
  return String(id || '')
    .trim()
    .toLowerCase();
}

function friendFilePath(friendId: string): string {
  return `${ROOT}/friends/${normalizeStorageKey(friendId)}/messages.json`;
}

function roomFilePath(roomId: string): string {
  return `${ROOT}/rooms/${normalizeStorageKey(roomId)}/messages.json`;
}

function lsFriendKey(friendId: string): string {
  return `${LS_PREFIX}:friend:${normalizeStorageKey(friendId)}`;
}

function lsRoomKey(roomId: string): string {
  return `${LS_PREFIX}:room:${normalizeStorageKey(roomId)}`;
}

/** Load history for a friend (stable even if room id changes). */
export async function readFriendHistory(friendId: string): Promise<MessageResponse[] | null> {
  const sources: (MessageResponse[] | null)[] = [
    await readViaCapacitor(friendFilePath(friendId)),
    await readViaOpfs(friendFilePath(friendId)),
    readLocalStorage(lsFriendKey(friendId))
  ];
  const merged = mergeMessageLists(sources.filter((s): s is MessageResponse[] => !!s?.length));
  return merged.length ? merged : null;
}

/** Save chat history — friend folder (WhatsApp-style) + room backup + localStorage. */
export async function writeChatHistory(
  roomId: string,
  friendId: string | undefined,
  messages: MessageResponse[]
): Promise<void> {
  const payload = JSON.stringify(messages);
  writeLocalStorage(lsRoomKey(roomId), payload);
  if (friendId) {
    writeLocalStorage(lsFriendKey(friendId), payload);
  }

  if (friendId && (await writeViaCapacitor(friendFilePath(friendId), payload))) {
    await writeViaCapacitor(roomFilePath(roomId), payload);
    return;
  }

  if (friendId) {
    await writeViaOpfs(friendFilePath(friendId), payload);
  }
  await writeViaOpfs(roomFilePath(roomId), payload);
}

/** Load chat history — try friend folder, room file, then localStorage. */
export async function readChatHistory(roomId: string, friendId?: string): Promise<MessageResponse[] | null> {
  const sources: (MessageResponse[] | null)[] = [];

  if (friendId) {
    sources.push(await readViaCapacitor(friendFilePath(friendId)));
    sources.push(await readViaOpfs(friendFilePath(friendId)));
    sources.push(readLocalStorage(lsFriendKey(friendId)));
  }

  sources.push(await readViaCapacitor(roomFilePath(roomId)));
  sources.push(await readViaOpfs(roomFilePath(roomId)));
  sources.push(readLocalStorage(lsRoomKey(roomId)));

  const merged = mergeMessageLists(sources.filter((s): s is MessageResponse[] => !!s?.length));
  return merged.length ? merged : null;
}

export async function deleteChatHistory(roomId: string, friendId?: string): Promise<void> {
  if (friendId) {
    removeLocalStorage(lsFriendKey(friendId));
    await deleteViaCapacitor(friendFilePath(friendId));
    await deleteViaOpfs(friendFilePath(friendId));
  }
  removeLocalStorage(lsRoomKey(roomId));
  await deleteViaCapacitor(roomFilePath(roomId));
  await deleteViaOpfs(roomFilePath(roomId));
}

function mergeMessageLists(lists: MessageResponse[][]): MessageResponse[] {
  const byId = new Map<string, MessageResponse>();
  for (const list of lists) {
    for (const msg of list) {
      if (msg?.id) byId.set(String(msg.id), msg);
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

function writeLocalStorage(key: string, payload: string): void {
  try {
    localStorage.setItem(key, payload);
  } catch (err) {
    console.warn('PulseChat: localStorage full or blocked', err);
  }
}

function readLocalStorage(key: string): MessageResponse[] | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseMessages(raw) : null;
  } catch {
    return null;
  }
}

function removeLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

async function writeViaCapacitor(path: string, payload: string): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return false;
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const dir = path.substring(0, path.lastIndexOf('/'));
    await Filesystem.mkdir({ path: dir, directory: Directory.Documents, recursive: true }).catch(() => {});
    await Filesystem.writeFile({
      path,
      data: payload,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true
    });
    return true;
  } catch (err) {
    console.warn('PulseChat: Capacitor file write failed', err);
    return false;
  }
}

async function readViaCapacitor(path: string): Promise<MessageResponse[] | null> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return null;
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const result = await Filesystem.readFile({
      path,
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });
    return parseMessages(String(result.data));
  } catch {
    return null;
  }
}

async function deleteViaCapacitor(path: string): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    await Filesystem.deleteFile({ path, directory: Directory.Documents });
  } catch {
    /* ignore */
  }
}

async function writeViaOpfs(path: string, payload: string): Promise<void> {
  if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) return;
  try {
    const parts = path.split('/');
    const root = await navigator.storage.getDirectory();
    let dir: FileSystemDirectoryHandle = root;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: true });
    }
    const file = await dir.getFileHandle(parts[parts.length - 1], { create: true });
    const writable = await file.createWritable();
    await writable.write(payload);
    await writable.close();
  } catch (err) {
    console.warn('PulseChat: OPFS write failed', err);
  }
}

async function readViaOpfs(path: string): Promise<MessageResponse[] | null> {
  if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) return null;
  try {
    const parts = path.split('/');
    const root = await navigator.storage.getDirectory();
    let dir: FileSystemDirectoryHandle = root;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i]);
    }
    const file = await dir.getFileHandle(parts[parts.length - 1]);
    const text = await (await file.getFile()).text();
    return parseMessages(text);
  } catch {
    return null;
  }
}

async function deleteViaOpfs(path: string): Promise<void> {
  if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) return;
  try {
    const parts = path.split('/');
    const root = await navigator.storage.getDirectory();
    let dir: FileSystemDirectoryHandle = root;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i]);
    }
    await dir.removeEntry(parts[parts.length - 1]);
  } catch {
    /* ignore */
  }
}

function parseMessages(raw: string): MessageResponse[] | null {
  try {
    const parsed = JSON.parse(raw) as MessageResponse[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Legacy exports kept for any old imports
export async function writeRoomMessagesFile(roomId: string, messages: MessageResponse[]): Promise<void> {
  await writeChatHistory(roomId, undefined, messages);
}

export async function readRoomMessagesFile(roomId: string): Promise<MessageResponse[] | null> {
  return readChatHistory(roomId);
}

export async function deleteRoomMessagesFile(roomId: string): Promise<void> {
  await deleteChatHistory(roomId);
}
