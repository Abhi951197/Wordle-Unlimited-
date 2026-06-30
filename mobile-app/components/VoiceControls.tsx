import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Room, RoomEvent, Track, createLocalAudioTrack } from 'livekit-client';
import type { LocalAudioTrack } from 'livekit-client';
import type { LiveKitSession } from '@/store/GameState';

interface VoiceControlsProps {
  livekit: LiveKitSession | null;
  compact?: boolean;
  enabled?: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({ livekit, compact = false, enabled = true }) => {
  const roomRef = useRef<Room | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const audioHostRef = useRef<any>(null);
  const remoteElementsRef = useRef<Map<string, HTMLMediaElement>>(new Map());
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [remoteCount, setRemoteCount] = useState(0);
  const [muted, setMuted] = useState(false);
  const [audioLocked, setAudioLocked] = useState(false);

  const cleanupRemoteAudio = () => {
    remoteElementsRef.current.forEach(element => element.remove());
    remoteElementsRef.current.clear();
  };

  const disconnect = () => {
    cleanupRemoteAudio();
    audioTrackRef.current?.stop();
    roomRef.current?.disconnect();
    audioTrackRef.current = null;
    roomRef.current = null;
    setRemoteCount(0);
    setMuted(false);
    setAudioLocked(false);
    setStatus('idle');
  };

  useEffect(() => disconnect, []);

  useEffect(() => {
    if (!enabled) disconnect();
  }, [enabled]);

  if (!enabled) {
    return (
      <View style={[styles.disabled, compact && styles.compactBox]}>
        <Text style={styles.disabledText}>Voice disabled</Text>
      </View>
    );
  }

  if (!livekit?.configured || !livekit.url || !livekit.token) {
    return (
      <View style={[styles.disabled, compact && styles.compactBox]}>
        <Text style={styles.disabledText}>Voice unavailable</Text>
      </View>
    );
  }

  const attachRemoteAudio = (track: any, publication: any, participant: any) => {
    if (track.kind !== Track.Kind.Audio || Platform.OS !== 'web') return;
    const key = `${participant.identity}:${publication.trackSid}`;
    if (remoteElementsRef.current.has(key)) return;

    const element = track.attach() as HTMLMediaElement;
    element.autoplay = true;
    (element as any).playsInline = true;
    element.style.display = 'none';
    remoteElementsRef.current.set(key, element);

    const host = audioHostRef.current;
    if (host?.appendChild) host.appendChild(element);
    element.play?.().catch(() => setAudioLocked(true));
  };

  const detachRemoteAudio = (track: any, publication: any, participant: any) => {
    if (track.kind !== Track.Kind.Audio || Platform.OS !== 'web') return;
    const key = `${participant.identity}:${publication.trackSid}`;
    const element = remoteElementsRef.current.get(key);
    track.detach?.(element);
    element?.remove();
    remoteElementsRef.current.delete(key);
  };

  const unlockAudio = async () => {
    try {
      await roomRef.current?.startAudio();
      await Promise.all(
        [...remoteElementsRef.current.values()].map(element => element.play?.().catch(() => undefined)),
      );
      setAudioLocked(false);
    } catch {
      setAudioLocked(true);
    }
  };

  const connect = async () => {
    if (status === 'connecting' || status === 'connected') {
      await unlockAudio();
      return;
    }

    setStatus('connecting');

    try {
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, () => setRemoteCount(room.remoteParticipants.size));
      room.on(RoomEvent.ParticipantDisconnected, () => setRemoteCount(room.remoteParticipants.size));
      room.on(RoomEvent.TrackSubscribed, attachRemoteAudio);
      room.on(RoomEvent.TrackUnsubscribed, detachRemoteAudio);
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        setAudioLocked(!room.canPlaybackAudio);
      });

      const url = livekit.url;
      const token = livekit.token;
      if (!url || !token) throw new Error('Missing LiveKit connection');
      await room.connect(url, token);
      await room.startAudio().catch(() => setAudioLocked(true));

      room.remoteParticipants.forEach(participant => {
        participant.trackPublications.forEach(publication => {
          const track = publication.track;
          if (track) attachRemoteAudio(track, publication, participant);
        });
      });

      const audioTrack = await createLocalAudioTrack();
      audioTrackRef.current = audioTrack;
      await room.localParticipant.publishTrack(audioTrack);
      setRemoteCount(room.remoteParticipants.size);
      setStatus('connected');
    } catch {
      cleanupRemoteAudio();
      audioTrackRef.current?.stop();
      roomRef.current?.disconnect();
      audioTrackRef.current = null;
      roomRef.current = null;
      setStatus('error');
    }
  };

  const toggleMute = async () => {
    if (status !== 'connected' || !audioTrackRef.current) return;
    if (muted) {
      await audioTrackRef.current.unmute();
      setMuted(false);
    } else {
      await audioTrackRef.current.mute();
      setMuted(true);
    }
  };

  const connected = status === 'connected';

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      {Platform.OS === 'web' && <View ref={audioHostRef} style={styles.audioHost as any} />}
      <TouchableOpacity
        style={[styles.voiceButton, connected && styles.buttonConnected]}
        onPress={connected ? unlockAudio : connect}
        activeOpacity={0.75}
      >
        <Text style={styles.symbolText}>{connected ? 'ON' : 'MIC'}</Text>
        <Text style={styles.buttonText}>{connected ? 'On' : status === 'connecting' ? '...' : 'Join'}</Text>
      </TouchableOpacity>
      {connected && (
        <TouchableOpacity
          style={[styles.roundIconButton, muted && styles.mutedButton]}
          onPress={toggleMute}
          activeOpacity={0.75}
        >
          <Text style={[styles.iconText, muted && styles.mutedIconText]}>{muted ? 'OFF' : 'MIC'}</Text>
          <Text style={styles.srText}>{muted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>
      )}
      {connected && (
        <TouchableOpacity
          style={[styles.roundIconButton, styles.leaveButton]}
          onPress={disconnect}
          activeOpacity={0.75}
        >
          <Text style={styles.leaveIconText}>X</Text>
          <Text style={styles.srText}>Leave</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.meta}>
        {connected
          ? `${remoteCount + 1} in voice${audioLocked ? ' - tap Voice On' : muted ? ' - muted' : ''}`
          : status === 'error' ? 'Voice failed' : 'Voice ready'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  compactContainer: {
    justifyContent: 'center',
  },
  audioHost: {
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#172233',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  buttonConnected: {
    backgroundColor: '#16C75A',
    borderColor: '#5fd36f',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  roundIconButton: {
    backgroundColor: '#111820',
    minWidth: 44,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedButton: {
    borderColor: '#f0c040',
  },
  leaveButton: {
    borderColor: '#e55c5c',
    backgroundColor: '#3A1015',
  },
  symbolText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  iconText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '900',
  },
  mutedIconText: {
    color: '#FACC15',
  },
  leaveIconText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '900',
  },
  srText: {
    display: 'none',
  },
  meta: {
    color: '#9aa4b2',
    fontSize: 11,
    fontWeight: '700',
  },
  disabled: {
    backgroundColor: '#111820',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  compactBox: {
    alignSelf: 'flex-end',
  },
  disabledText: {
    color: '#9aa4b2',
    fontSize: 11,
    fontWeight: '700',
  },
});
