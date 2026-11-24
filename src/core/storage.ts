/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.STORAGE
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\core\storage.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/core/storage.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
/** LeeWay Global P2P — offline encrypted message store with delayed delivery. */
import type { QueuedMessage, WireMessage, Attachment } from './types.ts';
import { isExpired } from './messages.ts';

export interface MessageStore {
  put(item: QueuedMessage): Promise<void>;
  get(id: string): Promise<QueuedMessage | undefined>;
  all(roomId?: string): Promise<QueuedMessage[]>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryMessageStore implements MessageStore {
  private items = new Map<string, QueuedMessage>();

  async put(item: QueuedMessage): Promise<void> { this.items.set(item.message.id, item); }
  async get(id: string): Promise<QueuedMessage | undefined> { return this.items.get(id); }
  async all(roomId?: string): Promise<QueuedMessage[]> {
    return [...this.items.values()].filter((i) => !roomId || i.message.roomId === roomId)
      .sort((a, b) => a.message.createdAt - b.message.createdAt);
  }
  async delete(id: string): Promise<void> { this.items.delete(id); }
  async clear(): Promise<void> { this.items.clear(); }
}

const DB_NAME = 'leeway-global-p2p';
const STORE = 'queue';

/** IndexedDB store. Data is already encrypted before it reaches this layer. */
export class IndexedDbMessageStore implements MessageStore {
  constructor(private dbName = DB_NAME) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'message.id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      t.oncomplete = () => db.close();
    });
  }

  async put(item: QueuedMessage): Promise<void> { await this.tx('readwrite', (s) => s.put(item)); }
  async get(id: string): Promise<QueuedMessage | undefined> { return this.tx('readonly', (s) => s.get(id)); }
  async all(roomId?: string): Promise<QueuedMessage[]> {
    const items = await this.tx<QueuedMessage[]>('readonly', (s) => s.getAll());
    return items.filter((i) => !roomId || i.message.roomId === roomId)
      .sort((a, b) => a.message.createdAt - b.message.createdAt);
  }
  async delete(id: string): Promise<void> { await this.tx('readwrite', (s) => s.delete(id)); }
  async clear(): Promise<void> { await this.tx('readwrite', (s) => s.clear()); }
}

export function newQueued(message: WireMessage): QueuedMessage {
  return { message, attempts: 0, status: 'queued' };
}

/** Marks queued items whose TTL elapsed; used on startup and periodic retries. */
export function expireStale(items: QueuedMessage[], now = Date.now()): QueuedMessage[] {
  return items.map((item) => {
    if (item.status !== 'delivered' && isExpired(item.message, now)) {
      return { ...item, status: 'expired' as const, error: 'message TTL expired before delivery' };
    }
    return item;
  });
}

/** Encrypted file envelope for manual transfer (USB/SD/Bluetooth/courier). */
export function buildTransferBundle(message: WireMessage, attachment: Attachment, sender: string): string {
  return JSON.stringify({
    v: 1,
    format: 'leeway-global-p2p/offline-encrypted-transfer',
    sender,
    exportedAt: Date.now(),
    message,
    attachment,
  }, null, 2);
}

export function parseTransferBundle(raw: string): { message: WireMessage; attachment: Attachment; sender: string } {
  const parsed = JSON.parse(raw);
  if (parsed?.format !== 'leeway-global-p2p/offline-encrypted-transfer' || !parsed.message) {
    throw new Error('Not a LeeWay encrypted transfer bundle');
  }
  return { message: parsed.message, attachment: parsed.attachment, sender: parsed.sender };
}
