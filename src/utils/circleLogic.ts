/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.CIRCLELOGIC
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\utils\circleLogic.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/utils/circleLogic.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
export type CircleId = string;

export interface CircleInfo {
  id: CircleId;
  name: string;
  membersCount: number;
}

export interface VoiceBurst {
  id: string;
  circleId: CircleId;
  sender: string;
  avatarUrl?: string;
  timeLabel: string;
  durationSec: number;
  durationLabel: string;
  waveform: number[];
  queued: boolean;
}

export interface TextDispatch {
  id: string;
  circleId: CircleId;
  sender: string;
  avatarUrl?: string;
  timeLabel: string;
  body: string;
  queued: boolean;
  reactions?: Record<string, number>;
}

export interface VideoSnap {
  id: string;
  circleId: CircleId;
  title: string;
  sender: string;
  avatarUrl?: string;
  timeLabel: string;
  durationSec: number;
  thumbnailUrl: string;
  queued: boolean;
  reactions?: Record<string, number>;
}

export const DEFAULT_CIRCLES: CircleInfo[] = [
  { id: 'LW-MKE-01', name: 'Milwaukee Family', membersCount: 5 },
  { id: 'LW-GLB-08', name: 'Global Family', membersCount: 9 },
  { id: 'LW-UKG-03', name: 'UK & Gulf Circle', membersCount: 4 },
];

export const INITIAL_VOICE_BURSTS: VoiceBurst[] = [
  {
    id: 'vb-1',
    circleId: 'LW-MKE-01',
    sender: 'Dad (Leonard)',
    avatarUrl: './src/assets/images/avatar_leonard_1795518769606.jpg',
    timeLabel: '15s ago',
    durationSec: 9,
    durationLabel: '00:09',
    waveform: [28, 56, 82, 64, 94, 48, 72, 88, 52, 68, 40, 32],
    queued: false,
  },
  {
    id: 'vb-2',
    circleId: 'LW-MKE-01',
    sender: 'Grandson (Leo Jr.)',
    timeLabel: '3m ago',
    durationSec: 6,
    durationLabel: '00:06',
    waveform: [22, 48, 66, 90, 58, 44, 76, 62, 38, 50, 34, 24],
    queued: false,
  },
  {
    id: 'vb-3',
    circleId: 'LW-GLB-08',
    sender: 'Aunt Maya',
    avatarUrl: './src/assets/images/avatar_maya_1795518769059.jpg',
    timeLabel: '14m ago',
    durationSec: 11,
    durationLabel: '00:11',
    waveform: [35, 62, 74, 86, 54, 92, 68, 44, 78, 58, 42, 30],
    queued: false,
  },
  {
    id: 'vb-4',
    circleId: 'LW-UKG-03',
    sender: 'Uncle Tariq',
    timeLabel: '22m ago',
    durationSec: 8,
    durationLabel: '00:08',
    waveform: [40, 52, 70, 84, 60, 48, 74, 66, 50, 40, 36, 28],
    queued: false,
  },
];

export const INITIAL_TEXT_DISPATCHES: TextDispatch[] = [
  {
    id: 'td-1',
    circleId: 'LW-MKE-01',
    sender: 'Aunt Maya',
    avatarUrl: './src/assets/images/avatar_maya_1795518769059.jpg',
    timeLabel: '12m ago',
    body: 'On my way home now, traffic is moving steady along I-94. 👍',
    queued: false,
  },
  {
    id: 'td-2',
    circleId: 'LW-MKE-01',
    sender: 'Dad (Leonard)',
    avatarUrl: './src/assets/images/avatar_leonard_1795518769606.jpg',
    timeLabel: '28m ago',
    body: 'Dinner table is set on the patio whenever everyone arrives.',
    queued: false,
  },
  {
    id: 'td-3',
    circleId: 'LW-GLB-08',
    sender: 'Cousin Nadia',
    timeLabel: '40m ago',
    body: 'Landed safely in Toronto, checking in on the family channel!',
    queued: false,
  },
  {
    id: 'td-4',
    circleId: 'LW-UKG-03',
    sender: 'Uncle Tariq',
    timeLabel: '1h ago',
    body: 'Morning tea ready here in London. Talk soon.',
    queued: false,
  },
];

export const INITIAL_VIDEO_SNAPS: VideoSnap[] = [
  {
    id: 'vs-1',
    circleId: 'LW-MKE-01',
    title: 'Lakefront Shoreline Snap',
    sender: 'Grandson (Leo Jr.)',
    timeLabel: '8m ago',
    durationSec: 12,
    thumbnailUrl: './src/assets/images/lakefront_snap_1795518767950.jpg',
    queued: false,
  },
  {
    id: 'vs-2',
    circleId: 'LW-MKE-01',
    title: 'Patio Dinner Table Ready',
    sender: 'Aunt Maya',
    avatarUrl: './src/assets/images/avatar_maya_1795518769059.jpg',
    timeLabel: '35m ago',
    durationSec: 15,
    thumbnailUrl: './src/assets/images/family_dinner_snap_1795518768888.jpg',
    queued: false,
  },
  {
    id: 'vs-3',
    circleId: 'LW-GLB-08',
    title: 'Evening Patio Gathering',
    sender: 'Dad (Leonard)',
    avatarUrl: './src/assets/images/avatar_leonard_1795518769606.jpg',
    timeLabel: '1h ago',
    durationSec: 10,
    thumbnailUrl: './src/assets/images/family_dinner_snap_1795518768888.jpg',
    queued: false,
  },
  {
    id: 'vs-4',
    circleId: 'LW-UKG-03',
    title: 'Sunset Harbor Walk',
    sender: 'Uncle Tariq',
    timeLabel: '2h ago',
    durationSec: 14,
    thumbnailUrl: './src/assets/images/lakefront_snap_1795518767950.jpg',
    queued: false,
  },
];

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function generateWaveform(seedLength: number, bars = 12): number[] {
  const result: number[] = [];
  for (let i = 0; i < bars; i++) {
    const val = 28 + ((seedLength * 19 + i * 29) % 66);
    result.push(val);
  }
  return result;
}

export function addVoiceBurst(
  bursts: VoiceBurst[],
  params: {
    circleId: CircleId;
    sender: string;
    durationSec: number;
    offline: boolean;
    avatarUrl?: string;
    justNowLabel?: string;
  }
): VoiceBurst[] {
  const duration = Math.max(1, Math.round(params.durationSec));
  const next: VoiceBurst = {
    id: `vb-${Date.now()}-${bursts.length}`,
    circleId: params.circleId,
    sender: params.sender,
    avatarUrl: params.avatarUrl,
    timeLabel: params.justNowLabel ?? 'Just now',
    durationSec: duration,
    durationLabel: formatDuration(duration),
    waveform: generateWaveform(duration + bursts.length),
    queued: params.offline,
  };
  return [next, ...bursts];
}

export function addTextMessage(
  messages: TextDispatch[],
  params: {
    circleId: CircleId;
    sender: string;
    body: string;
    offline: boolean;
    avatarUrl?: string;
    justNowLabel?: string;
  }
): { ok: true; messages: TextDispatch[] } | { ok: false; error: string } {
  const trimmed = params.body.trim();
  if (!trimmed) {
    return { ok: false, error: 'Message cannot be empty.' };
  }
  const next: TextDispatch = {
    id: `td-${Date.now()}-${messages.length}`,
    circleId: params.circleId,
    sender: params.sender,
    avatarUrl: params.avatarUrl,
    timeLabel: params.justNowLabel ?? 'Just now',
    body: trimmed,
    queued: params.offline,
  };
  return { ok: true, messages: [next, ...messages] };
}

export function addVideoSnap(
  snaps: VideoSnap[],
  params: {
    circleId: CircleId;
    title: string;
    sender: string;
    durationSec: number;
    thumbnailUrl: string;
    offline: boolean;
    avatarUrl?: string;
    justNowLabel?: string;
  }
): { ok: true; snaps: VideoSnap[] } | { ok: false; error: string } {
  const trimmed = params.title.trim();
  if (!trimmed) {
    return { ok: false, error: 'Snap title cannot be empty.' };
  }
  const next: VideoSnap = {
    id: `vs-${Date.now()}-${snaps.length}`,
    circleId: params.circleId,
    title: trimmed,
    sender: params.sender,
    avatarUrl: params.avatarUrl,
    timeLabel: params.justNowLabel ?? 'Just now',
    durationSec: Math.max(3, Math.round(params.durationSec)),
    thumbnailUrl: params.thumbnailUrl,
    queued: params.offline,
  };
  return { ok: true, snaps: [next, ...snaps] };
}

export function flushOfflineQueue<T extends { queued: boolean }>(items: T[]): T[] {
  return items.map((item) => (item.queued ? { ...item, queued: false } : item));
}

export function filterByCircle<T extends { circleId: CircleId }>(
  items: T[],
  circleId: CircleId
): T[] {
  return items.filter((item) => item.circleId === circleId);
}

export function countQueuedItems(
  voices: VoiceBurst[],
  texts: TextDispatch[],
  snaps: VideoSnap[]
): number {
  return (
    voices.filter((v) => v.queued).length +
    texts.filter((t) => t.queued).length +
    snaps.filter((s) => s.queued).length
  );
}

export function validateCircleSetup(
  displayName: string,
  circleId: string
): { ok: true; displayName: string; circleId: string } | { ok: false; error: string } {
  const cleanName = displayName.trim();
  const cleanCircle = circleId.trim().toUpperCase();
  if (cleanName.length < 2) {
    return { ok: false, error: 'Display name must be at least 2 characters.' };
  }
  if (!/^[A-Z0-9-]{4,18}$/.test(cleanCircle)) {
    return {
      ok: false,
      error: 'Circle ID must be 4–18 letters, numbers, or dashes (e.g. LW-MKE-01).',
    };
  }
  return { ok: true, displayName: cleanName, circleId: cleanCircle };
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'LW';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function toggleItemReaction<T extends { id: string; reactions?: Record<string, number> }>(
  items: T[],
  itemId: string,
  emoji: string
): T[] {
  return items.map((item) => {
    if (item.id !== itemId) return item;
    const current = item.reactions ?? {};
    const nextCount = (current[emoji] ?? 0) + 1;
    return {
      ...item,
      reactions: {
        ...current,
        [emoji]: nextCount,
      },
    };
  });
}

export function generateDeviceFingerprint(seed?: number): string {
  const hexChars = '0123456789ABCDEF';
  const groups: string[] = [];
  let s = typeof seed === 'number' ? Math.abs(Math.floor(seed)) : Math.floor(Math.random() * 0xffffff);
  for (let g = 0; g < 4; g++) {
    let chunk = '';
    for (let c = 0; c < 4; c++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      chunk += hexChars[s % 16];
    }
    groups.push(chunk);
  }
  return `ED25519 · ${groups.join('-')}`;
}

export function generateCircleCode(seed?: number): string {
  const regions = ['MKE', 'GLB', 'ATL', 'LDN', 'DXB', 'NYC'];
  const n = typeof seed === 'number' ? Math.abs(Math.floor(seed)) : Math.floor(Math.random() * 999);
  const reg = regions[n % regions.length];
  const num = String((n % 89) + 10).padStart(2, '0');
  return `LW-${reg}-${num}`;
}

