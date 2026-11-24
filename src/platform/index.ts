/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.PLATFORM
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: OS-agnostic platform adapter interface with browser and fallback implementations
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/platform/index.ts
WHY: Android, iPhone/iOS, Windows, macOS, Linux and Web/PWA must share one dispatch core
HOW: Capability negotiation, no OS-specific branching in core; honest NOT VERIFIED where physical testing is absent
*/
import { IndexedDbMessageStore, MemoryMessageStore, type MessageStore } from '../core/storage.ts';

export type OsFamily = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'web' | 'unknown';

export interface PlatformCapabilities {
  os: OsFamily;
  label: string;
  mediaCapture: boolean;
  audioMimeTypes: string[];
  videoMimeTypes: string[];
  persistence: 'indexeddb' | 'memory';
  privateRoom: boolean;
  physicalVerification: 'VERIFIED' | 'NOT VERIFIED';
}

export interface CapturedBurst {
  bytes: Uint8Array;
  mime: string;
  durationMs: number;
  previewUrl?: string;
}

/** A recording starts immediately; `result` resolves when the caller stops it. */
export interface CaptureHandle {
  stop: () => void;
  result: Promise<CapturedBurst>;
}

export interface PrivateRoomHandle {
  close: () => void;
  participants: number;
}

export interface PlatformAdapter {
  readonly id: string;
  capabilities(): PlatformCapabilities;
  storage(): MessageStore;
  preferredAudioMime(): string | undefined;
  preferredVideoMime(): string | undefined;
  captureAudio(): Promise<CaptureHandle>;
  captureVideo(): Promise<CaptureHandle>;
  playBurst(url: string, mime: string): Promise<void>;
  openPrivateRoom(participants: number): Promise<PrivateRoomHandle>;
}

const AUDIO_MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg'];
const VIDEO_MIMES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

export function detectOs(userAgent?: string, platform?: string): OsFamily {
  const ua = (userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')).toLowerCase();
  const p = (platform ?? (typeof navigator !== 'undefined' ? (navigator as any).userAgentData?.platform ?? navigator.platform : '')).toLowerCase();
  if (/iphone|ipad|ipod/.test(ua) || p === 'iphone' || p === 'ipad') return 'ios';
  if (/android/.test(ua) || p === 'android') return 'android';
  if (/windows/.test(ua) || p === 'windows') return 'windows';
  if (/mac os x|macintosh/.test(ua) || p === 'macos') return 'macos';
  if (/linux|x11|cr os/.test(ua) || p === 'linux') return 'linux';
  if (ua) return 'web';
  return 'unknown';
}

export function supportedMimeTypes(kind: 'audio' | 'video'): string[] {
  const candidates = kind === 'audio' ? AUDIO_MIMES : VIDEO_MIMES;
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return candidates.slice(0, 1);
  return candidates.filter((m) => MediaRecorder.isTypeSupported(m));
}

/** Ordered, one-at-a-time PTT playback. Transport-independent and unit-testable. */
export class OrderedPlaybackQueue {
  private queue: string[] = [];
  private active: string | null = null;
  constructor(private play: (id: string) => Promise<void>) {}

  get current(): string | null { return this.active; }
  get pending(): string[] { return [...this.queue]; }

  enqueue(id: string): void {
    if (!id || this.queue.includes(id) || this.active === id) return;
    this.queue.push(id);
  }

  /** Starts the next item only when idle. Returns the started id, if any. */
  async advance(): Promise<string | null> {
    if (this.active || this.queue.length === 0) return null;
    const id = this.queue.shift()!;
    this.active = id;
    try { await this.play(id); }
    finally { this.active = null; }
    return id;
  }

  /** Drains the queue until empty. Useful in tests and on deterministic runners. */
  async drain(): Promise<string[]> {
    const played: string[] = [];
    while (this.queue.length || this.active) {
      const id = await this.advance();
      if (id) played.push(id);
      else break;
    }
    return played;
  }

  clear(): void { this.queue = []; this.active = null; }
}

/** Browser / PWA / desktop-browser adapter — same code path on every OS. */
export class BrowserPlatform implements PlatformAdapter {
  readonly id = 'browser-web';
  private store: MessageStore;

  constructor(private os: OsFamily = detectOs()) {
    this.store = typeof indexedDB !== 'undefined' ? new IndexedDbMessageStore() : new MemoryMessageStore();
  }

  capabilities(): PlatformCapabilities {
    const hasMedia = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    const hasRecorder = typeof MediaRecorder !== 'undefined';
    return {
      os: this.os,
      label: this.os,
      mediaCapture: hasMedia && hasRecorder,
      audioMimeTypes: supportedMimeTypes('audio'),
      videoMimeTypes: supportedMimeTypes('video'),
      persistence: this.store instanceof IndexedDbMessageStore ? 'indexeddb' : 'memory',
      privateRoom: typeof RTCPeerConnection !== 'undefined',
      physicalVerification: 'NOT VERIFIED',
    };
  }

  storage(): MessageStore { return this.store; }
  preferredAudioMime(): string | undefined { return this.capabilities().audioMimeTypes[0]; }
  preferredVideoMime(): string | undefined { return this.capabilities().videoMimeTypes[0]; }

  async captureAudio(): Promise<CaptureHandle> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = this.preferredAudioMime();
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: BlobPart[] = [];
    const started = Date.now();
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const result = new Promise<CapturedBurst>((resolve, reject) => {
      recorder.onerror = () => { stream.getTracks().forEach((t) => t.stop()); reject(new Error('audio recorder error')); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        resolve({
          bytes: new Uint8Array(await blob.arrayBuffer()), mime: blob.type || 'audio/webm',
          durationMs: Date.now() - started,
        });
      };
      recorder.start();
    });
    return { stop: () => recorder.stop(), result };
  }

  async captureVideo(): Promise<CaptureHandle> {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const mime = this.preferredVideoMime();
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: BlobPart[] = [];
    const started = Date.now();
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const result = new Promise<CapturedBurst>((resolve, reject) => {
      recorder.onerror = () => { stream.getTracks().forEach((t) => t.stop()); reject(new Error('video recorder error')); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
        resolve({
          bytes: new Uint8Array(await blob.arrayBuffer()), mime: blob.type || 'video/webm',
          durationMs: Date.now() - started,
          previewUrl: URL.createObjectURL(blob),
        });
      };
      recorder.start();
    });
    return { stop: () => recorder.stop(), result };
  }

  async playBurst(url: string, _mime: string): Promise<void> {
    const audio = new Audio(url);
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
  }

  async openPrivateRoom(participants: number): Promise<PrivateRoomHandle> {
    return { close: () => {}, participants };
  }
}

/** Non-browser environments (Node tests, unsupported shells): honest fallback. */
export class FallbackPlatform implements PlatformAdapter {
  readonly id = 'fallback';
  private store = new MemoryMessageStore();

  constructor(private caps: Partial<PlatformCapabilities> = {}) {}

  capabilities(): PlatformCapabilities {
    return {
      os: 'unknown', label: 'unsupported shell', mediaCapture: false,
      audioMimeTypes: [], videoMimeTypes: [], persistence: 'memory',
      privateRoom: false, physicalVerification: 'NOT VERIFIED', ...this.caps,
    };
  }

  storage(): MessageStore { return this.store; }
  preferredAudioMime(): string | undefined { return undefined; }
  preferredVideoMime(): string | undefined { return undefined; }
  async captureAudio(): Promise<CaptureHandle> { throw new Error('media capture not available on this platform'); }
  async captureVideo(): Promise<CaptureHandle> { throw new Error('media capture not available on this platform'); }
  async playBurst(): Promise<void> { return; }
  async openPrivateRoom(participants: number): Promise<PrivateRoomHandle> {
    return { close: () => {}, participants };
  }
}

/** Selects the adapter for the current runtime. No OS is treated as canonical. */
export function detectPlatform(): PlatformAdapter {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return new FallbackPlatform();
  return new BrowserPlatform(detectOs());
}
