import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Room, RoomEvent, createLocalAudioTrack } from 'livekit-client';
import type { LocalAudioTrack } from 'livekit-client';
import type { LiveKitSession } from '@/store/GameState';

interface VoiceControlsProps {
  livekit: LiveKitSession | null;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({ livekit }) => {
  const roomRef = useRef<Room | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [remoteCount, setRemoteCount] = useState(0);

  useEffect(() => {
    return () => {
      audioTrackRef.current?.stop();
      roomRef.current?.disconnect();
    };
  }, []);

  if (!livekit?.configured || !livekit.url || !livekit.token) {
    return (
      <View style={styles.disabled}>
        <Text style={styles.disabledText}>Voice needs LiveKit env vars</Text>
      </View>
    );
  }

  const connect = async () => {
    if (status === 'connecting' || status === 'connected') return;
    const url = livekit.url;
    const token = livekit.token;
    if (!url || !token) return;

    setStatus('connecting');

    try {
      const room = new Room();
      roomRef.current = room;
      room.on(RoomEvent.ParticipantConnected, () => setRemoteCount(room.remoteParticipants.size));
      room.on(RoomEvent.ParticipantDisconnected, () => setRemoteCount(room.remoteParticipants.size));

      await room.connect(url, token);
      const audioTrack = await createLocalAudioTrack();
      audioTrackRef.current = audioTrack;
      await room.localParticipant.publishTrack(audioTrack);
      setRemoteCount(room.remoteParticipants.size);
      setStatus('connected');
    } catch {
      audioTrackRef.current?.stop();
      roomRef.current?.disconnect();
      audioTrackRef.current = null;
      roomRef.current = null;
      setStatus('error');
    }
  };

  const disconnect = () => {
    audioTrackRef.current?.stop();
    roomRef.current?.disconnect();
    audioTrackRef.current = null;
    roomRef.current = null;
    setRemoteCount(0);
    setStatus('idle');
  };

  const connected = status === 'connected';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, connected && styles.buttonConnected]}
        onPress={connected ? disconnect : connect}
        activeOpacity={0.75}
      >
        <Text style={styles.buttonText}>
          {connected ? 'Leave Voice' : status === 'connecting' ? 'Connecting...' : 'Join Voice'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.meta}>
        {connected ? `${remoteCount + 1} in voice` : status === 'error' ? 'Voice failed' : 'Voice ready'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    backgroundColor: '#1a1a1b',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonConnected: {
    backgroundColor: '#6aaa64',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  meta: {
    color: '#565758',
    fontSize: 11,
    fontWeight: '700',
  },
  disabled: {
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  disabledText: {
    color: '#787c7e',
    fontSize: 11,
    fontWeight: '700',
  },
});
