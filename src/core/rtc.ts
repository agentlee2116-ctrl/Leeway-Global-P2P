/*
LEEWAY_HEADER - DO NOT REMOVE
REGION: PRODUCT
TAG: PRODUCT.LEEWAY_GLOBAL_P2P.RTC
DISCOVERY_PIPELINE: Voice -> Intent -> Location -> Vertical -> Ranking -> Render
WHO: LeeWay Creator / LeeWay Global P2P engineering
WHAT: Governed LeeWay Global P2P source: src\core\rtc.ts
WHEN: 2026-11-24
WHERE: agentlee2116-ctrl/Leeway-Global-P2P/src/core/rtc.ts
WHY: Offline-first LeeWay walkie-talkie dispatch for families across regions
HOW: Governed source reusing LeeWay contracts; no competing authority; evidence-backed verification
*/
/**
 * LeeWay Global P2P — WebRTC direct peer links.
 * Voice push-to-talk, voice notes, audio/video calls and a data channel.
 * Signaling is carried by an authorized relay or local mesh channel.
 * No media permission is requested until the user explicitly starts voice/video.
 */
import type { WireMessage } from './types.ts';

export interface SignalPayload {
  kind: 'offer' | 'answer' | 'ice';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface MediaCapabilities {
  dataChannel: boolean;
  voice: boolean;
  video: boolean;
  reason?: string;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

export function detectMediaCapabilities(): MediaCapabilities {
  const hasRtc = typeof RTCPeerConnection !== 'undefined';
  const hasMedia = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  return {
    dataChannel: hasRtc,
    voice: hasRtc && hasMedia,
    video: hasRtc && hasMedia,
    reason: !hasRtc ? 'WebRTC unavailable in this environment' : !hasMedia ? 'no media devices / permission API' : undefined,
  };
}

export class P2PLink {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private makingOffer = false;
  private verbose: (s: string) => void = () => {};

  constructor(
    private selfId: string,
    private peerId: string,
    private sendSignal: (to: string, payload: SignalPayload) => void,
    private onMessage: (message: WireMessage) => void,
    private onState: (state: string) => void = () => {},
    logger?: (s: string) => void,
  ) {
    if (logger) this.verbose = logger;
  }

  get connected(): boolean {
    return this.channel?.readyState === 'open';
  }

  async start(initiator: boolean): Promise<void> {
    if (typeof RTCPeerConnection === 'undefined') throw new Error('WebRTC is not available');
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.sendSignal(this.peerId, { kind: 'ice', candidate: e.candidate.toJSON() });
    };
    this.pc.onconnectionstatechange = () => {
      this.onState(this.pc?.connectionState ?? 'closed');
    };
    if (initiator) {
      this.channel = this.pc.createDataChannel('leeway-messages');
      this.bindChannel(this.channel);
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.sendSignal(this.peerId, { kind: 'offer', sdp: offer });
    } else {
      this.pc.ondatachannel = (e) => this.bindChannel(e.channel);
    }
    this.verbose(`P2PLink ${this.selfId} -> ${this.peerId} initiator=${initiator}`);
  }

  private bindChannel(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.onopen = () => this.onState('data-open');
    channel.onmessage = (event) => {
      try { this.onMessage(JSON.parse(event.data) as WireMessage); } catch { /* ignore malformed */ }
    };
  }

  async handleSignal(payload: SignalPayload): Promise<void> {
    if (!this.pc) await this.start(false);
    const pc = this.pc!;
    try {
      if (payload.kind === 'offer' && payload.sdp) {
        await pc.setRemoteDescription(payload.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal(this.peerId, { kind: 'answer', sdp: answer });
      } else if (payload.kind === 'answer' && payload.sdp) {
        await pc.setRemoteDescription(payload.sdp);
      } else if (payload.kind === 'ice' && payload.candidate) {
        await pc.addIceCandidate(payload.candidate);
      }
    } catch (err) {
      this.verbose(`signal error: ${String(err)}`);
    }
  }

  send(message: WireMessage): boolean {
    if (!this.connected || !this.channel) return false;
    this.channel.send(JSON.stringify(message));
    return true;
  }

  /** Push-to-talk / voice note. Caller holds the returned stop function. */
  async startVoice(kind: 'ptt' | 'voice-note'): Promise<{ stop: () => MediaStreamTrack[]; tracks: MediaStreamTrack[] }> {
    if (!this.pc) throw new Error('Start the peer link first');
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const tracks = this.localStream.getAudioTracks();
    tracks.forEach((track) => this.pc!.addTrack(track, this.localStream!));
    this.verbose(`voice ${kind}: ${tracks.length} audio track(s)`);
    return { tracks, stop: () => this.stopLocalMedia() };
  }

  async startCall(withVideo: boolean): Promise<MediaStream> {
    if (!this.pc) throw new Error('Start the peer link first');
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
    this.localStream.getTracks().forEach((track) => this.pc!.addTrack(track, this.localStream!));
    this.verbose(`call video=${withVideo}: ${this.localStream!.getTracks().length} track(s)`);
    return this.localStream;
  }

  private stopLocalMedia(): MediaStreamTrack[] {
    const tracks = this.localStream?.getTracks() ?? [];
    tracks.forEach((t) => t.stop());
    this.localStream = null;
    return tracks;
  }

  close(): void {
    this.stopLocalMedia();
    this.channel?.close();
    this.pc?.close();
    this.pc = null;
    this.channel = null;
    this.onState('closed');
  }
}
