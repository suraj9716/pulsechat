import { Injectable } from '@angular/core';
import { MessageResponse } from './chat-api.service';
import {
  deleteChatHistory,
  readChatHistory,
  writeChatHistory
} from '../utils/message-file-store.helper';

export interface LocalConversationMeta {
  roomId: string;
  friendId: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface SaveMessageOptions {
  friendId?: string;
  myUserId?: string;
  incrementUnread?: boolean;
  roomId?: string;
}

const DB_NAME = 'pulsechat-local';
const DB_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class LocalMessageStoreService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  /** Load history: device files/localStorage first, IndexedDB as extra backup. */
  async getRoomMessages(roomId: string, friendId?: string): Promise<MessageResponse[]> {
    const key = String(roomId);
    const fromFiles = (await readChatHistory(key, friendId)) ?? [];
    const fromIdb = await this.readRoomFromIndexedDb(key);
    const merged = this.mergeMessages(fromFiles, fromIdb);

    if (merged.length) {
      await this.saveRoomHistory(key, merged, friendId);
    }

    return merged;
  }

  /** Save full chat history to friend folder + localStorage + IndexedDB. */
  async saveRoomHistory(roomId: string, messages: MessageResponse[], friendId?: string): Promise<void> {
    const key = String(roomId);
    const normalized = messages.map((m) => this.normalizeMessage(m, key));
    await writeChatHistory(key, friendId, normalized);
    await this.replaceRoomInIndexedDb(key, normalized);

    if (friendId && normalized.length) {
      const last = normalized[normalized.length - 1];
      await this.updateConversationMeta(last, friendId, undefined, false);
    }
  }

  async saveMessage(msg: MessageResponse, opts?: SaveMessageOptions): Promise<void> {
    const chatRoomId = String(msg.chatRoomId || opts?.roomId || '');
    if (!chatRoomId) return;

    const existing = await this.getRoomMessages(chatRoomId, opts?.friendId);
    const normalized = this.normalizeMessage(msg, chatRoomId);
    if (existing.some((m) => m.id === normalized.id)) {
      return;
    }

    const next = [...existing, normalized].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    await this.saveRoomHistory(chatRoomId, next, opts?.friendId);

    if (opts?.friendId) {
      await this.updateConversationMeta(normalized, opts.friendId, opts.myUserId, opts.incrementUnread === true);
    }
  }

  async markRoomRead(roomId: string, friendId: string): Promise<void> {
    const key = String(roomId);
    const msgs = await this.getRoomMessages(key, friendId);
    let changed = false;
    for (const msg of msgs) {
      if (msg.status !== 'SEEN') {
        msg.status = 'SEEN';
        changed = true;
      }
    }
    if (changed) {
      await this.saveRoomHistory(key, msgs, friendId);
    }

    const db = await this.openDb();
    const meta = (await this.getConversation(key)) ?? {
      roomId: key,
      friendId,
      lastMessagePreview: null,
      lastMessageAt: null,
      unreadCount: 0
    };
    meta.unreadCount = 0;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('conversations', 'readwrite');
      tx.objectStore('conversations').put(meta);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getConversation(roomId: string): Promise<LocalConversationMeta | null> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('conversations', 'readonly');
      const request = tx.objectStore('conversations').get(String(roomId));
      request.onsuccess = () => resolve((request.result as LocalConversationMeta | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllConversations(): Promise<LocalConversationMeta[]> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('conversations', 'readonly');
      const request = tx.objectStore('conversations').getAll();
      request.onsuccess = () => resolve(request.result as LocalConversationMeta[]);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRoom(roomId: string, friendId?: string): Promise<void> {
    const key = String(roomId);
    await deleteChatHistory(key, friendId);
    const db = await this.openDb();
    const msgs = await this.readRoomFromIndexedDb(key);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['messages', 'conversations'], 'readwrite');
      for (const msg of msgs) {
        tx.objectStore('messages').delete(msg.id);
      }
      tx.objectStore('conversations').delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  exportRoomToFile(roomId: string, friendName?: string): Promise<void> {
    return this.getRoomMessages(roomId).then((msgs) => {
      const blob = new Blob([JSON.stringify(msgs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `pulsechat-${friendName ?? roomId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  createOutboundMessage(
    roomId: string,
    senderId: string,
    receiverId: string,
    content: string,
    opts?: { messageType?: MessageResponse['messageType']; imageUrl?: string }
  ): MessageResponse {
    return {
      id: crypto.randomUUID(),
      senderId: String(senderId),
      receiverId: String(receiverId),
      chatRoomId: String(roomId),
      content: content || null,
      messageType: opts?.messageType ?? 'TEXT',
      imageUrl: opts?.imageUrl,
      status: 'SENT',
      timestamp: new Date().toISOString()
    };
  }

  private mergeMessages(...lists: MessageResponse[][]): MessageResponse[] {
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

  private normalizeMessage(msg: MessageResponse, chatRoomId: string): MessageResponse {
    return {
      ...msg,
      id: String(msg.id),
      senderId: String(msg.senderId),
      receiverId: String(msg.receiverId),
      chatRoomId: String(msg.chatRoomId || chatRoomId),
      timestamp: this.normalizeTimestamp(msg.timestamp)
    };
  }

  private normalizeTimestamp(value: MessageResponse['timestamp']): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') return new Date(String(value)).toISOString();
    return new Date().toISOString();
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('messages')) {
          const store = db.createObjectStore('messages', { keyPath: 'id' });
          store.createIndex('chatRoomId', 'chatRoomId', { unique: false });
        }
        if (!db.objectStoreNames.contains('conversations')) {
          db.createObjectStore('conversations', { keyPath: 'roomId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    });
    return this.dbPromise;
  }

  private async readRoomFromIndexedDb(roomId: string): Promise<MessageResponse[]> {
    const db = await this.openDb();
    const key = String(roomId);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readonly');
      const request = tx.objectStore('messages').index('chatRoomId').getAll(key);
      request.onsuccess = () => {
        const rows = (request.result as MessageResponse[]) ?? [];
        const alt = rows.length
          ? rows
          : (request.result as MessageResponse[]).filter(
              (m) => String(m.chatRoomId).toLowerCase() === key.toLowerCase()
            );
        resolve(alt);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async replaceRoomInIndexedDb(roomId: string, messages: MessageResponse[]): Promise<void> {
    const existing = await this.readRoomFromIndexedDb(roomId);
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      for (const msg of existing) store.delete(msg.id);
      for (const msg of messages) store.put(this.normalizeMessage(msg, roomId));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async updateConversationMeta(
    msg: MessageResponse,
    friendId: string,
    myUserId?: string,
    incrementUnread = false
  ): Promise<void> {
    const db = await this.openDb();
    const existing = await this.getConversation(msg.chatRoomId);
    const unread =
      incrementUnread && myUserId && msg.receiverId === myUserId
        ? (existing?.unreadCount ?? 0) + 1
        : existing?.unreadCount ?? 0;

    const meta: LocalConversationMeta = {
      roomId: msg.chatRoomId,
      friendId,
      lastMessagePreview: this.previewFor(msg),
      lastMessageAt: msg.timestamp,
      unreadCount: unread
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('conversations', 'readwrite');
      tx.objectStore('conversations').put(meta);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private previewFor(msg: MessageResponse): string {
    if (msg.messageType === 'IMAGE') return '📷 Photo';
    if (msg.messageType === 'CALL') return msg.content ? `📞 ${msg.content}` : '📞 Voice call';
    return msg.content?.trim() || 'Message';
  }
}
