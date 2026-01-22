'use client'
import { useState, useRef, useEffect } from 'react'
import type { Instance } from 'simple-peer'
import { createClient } from '@/lib/supabase'
import { Call, Profile, Room } from '@/types'

const RING_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2060/2060-preview.mp3';

export const useWebRTC = (currentUser: Profile | null, selectedRoom: Room | null) => {
  const [activeCall, setActiveCall] = useState<Call | null>(null)
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  const [isCallActive, setIsCallActive] = useState(false)
  
  // Устройства
  const [isMicOn, setIsMicOn] = useState(true)
  const [isCamOn, setIsCamOn] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  // Потоки
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  
  // Рефы
  const myVideoRef = useRef<HTMLVideoElement>(null)
  const userVideoRef = useRef<HTMLVideoElement>(null) // Оставим для обратной совместимости, хотя VideoCallScreen использует Map
  const peersRef = useRef<Map<string, Instance>>(new Map())
  
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [voiceVolume, setVoiceVolume] = useState(0);

  const supabase = createClient()

  // Инициализация медиа
  const initLocalStream = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        
        // По умолчанию выключаем видео, если пользователь не просил (но мы договорились, что старт с видео)
        // Если хочешь старт БЕЗ видео, раскомментируй:
        // stream.getVideoTracks().forEach(t => t.enabled = false); setIsCamOn(false);

        if (myVideoRef.current) myVideoRef.current.srcObject = stream;
        setupVoiceAnalyser(stream);
        return stream;
    } catch (e) {
        console.error("Ошибка камеры:", e);
        return null;
    }
  };

  const setupVoiceAnalyser = (stream: MediaStream) => {
      if(audioContextRef.current) return;
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const checkVolume = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setVoiceVolume(volume);
          requestAnimationFrame(checkVolume);
      };
      checkVolume();
  };

  const startScreenShare = async (fps = 30, quality = '1080p') => {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { width: 1920, height: 1080, frameRate: fps }, 
            audio: true 
        });
        const screenTrack = screenStream.getVideoTracks()[0];

        // Добавляем трек экрана ко всем пирам (ВТОРОЙ ВИДЕО ТРЕК)
        peersRef.current.forEach(peer => {
            (peer as any).addTrack(screenTrack, localStream!);
        });

        // Сохраняем трек локально, чтобы VideoCallScreen мог его отрисовать отдельно
        // Мы сделаем хак: добавим его в localStream, а компонент сам разберется
        setLocalStream(prev => {
            if (!prev) return screenStream;
            const newStream = new MediaStream([...prev.getTracks(), screenTrack]);
            return newStream;
        });
        
        setIsScreenSharing(true);
        
        screenTrack.onended = () => stopScreenShare();
    } catch (e) { console.error("Ошибка стрима:", e); }
  };

  const stopScreenShare = async () => {
      if (!localStream) return;
      
      // Находим трек экрана (обычно он последний добавленный или имеет label 'screen')
      // Но DisplayMedia треки имеют другой kind? Нет, тоже video.
      // Найдем трек, который НЕ камера. Камера обычно первая.
      const tracks = localStream.getVideoTracks();
      const screenTrack = tracks.find(t => t.label.includes('screen') || t.label.includes('window') || t !== tracks[0]);

      if (screenTrack) {
          screenTrack.stop();
          peersRef.current.forEach(peer => {
              (peer as any).removeTrack(screenTrack, localStream);
          });
          
          setLocalStream(prev => {
              if(!prev) return null;
              return new MediaStream(prev.getTracks().filter(t => t !== screenTrack));
          });
      }
      setIsScreenSharing(false);
  };

  const createPeer = async (initiator: boolean, stream: MediaStream, partnerId: string, signalData?: any) => {
      // @ts-ignore
      const SimplePeer = (await import('simple-peer')).default || (await import('simple-peer'));
      
      const peer = new SimplePeer({ initiator, trickle: false, stream });

      peer.on('signal', async (data: any) => {
          await supabase.from('messages').insert({
              content: JSON.stringify(data),
              sender_id: currentUser?.id,
              room_id: selectedRoom?.id,
              message_type: 'signal', 
              file_url: partnerId 
          });
      });

      peer.on('stream', (stream: MediaStream) => {
          setRemoteStreams(prev => new Map(prev).set(partnerId, stream));
      });

      if (signalData) peer.signal(signalData);
      
      peersRef.current.set(partnerId, peer);
      return peer;
  };

  const startCall = async () => {
    if (!selectedRoom || !currentUser) return;
    
    setIsCallActive(true);
    const stream = await initLocalStream(); 
    if (!stream) return;

    const { data: call } = await supabase.from('calls').insert({
        caller_id: currentUser.id,
        room_id: selectedRoom.id,
        type: 'video',
        status: 'ringing'
    }).select().single();
    
    if (call) setActiveCall(call);
  };

  const acceptCall = async () => {
    if (!activeCall) return;
    setIsCallModalOpen(false);
    setIsCallActive(true);
    const stream = await initLocalStream();
    if (!stream) return;

    await supabase.from('calls').update({ status: 'accepted' }).eq('id', activeCall.id);
  };

  const endCall = async () => {
    setIsCallActive(false);
    peersRef.current.forEach(p => p.destroy());
    peersRef.current.clear();
    setRemoteStreams(new Map());
    
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    if(audioContextRef.current) audioContextRef.current.close();

    if (activeCall) await supabase.from('calls').update({ status: 'ended' }).eq('id', activeCall.id);
    setActiveCall(null);
  };

  // <-- ВОТ ОНА, ФУНКЦИЯ REJECT, КОТОРУЮ ТЫ ИСКАЛ
  const rejectCall = async () => {
    if (!activeCall) return;
    await supabase.from('calls').update({ status: 'rejected' }).eq('id', activeCall.id);
    setActiveCall(null);
    setIsCallModalOpen(false);
  };

  const toggleMic = () => {
    if (localStream) {
        localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
        setIsMicOn(p => !p);
    }
  };

  const toggleCam = () => {
    if (localStream) {
        localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
        setIsCamOn(p => !p);
    }
  };

  // Подписка на сигналы
  useEffect(() => {
      if (!isCallActive || !selectedRoom || !currentUser || !localStream) return;

      const channel = supabase.channel('signaling')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${selectedRoom.id}` }, 
        async (payload) => {
            const msg = payload.new;
            if (msg.message_type !== 'signal') return;
            if (msg.file_url !== currentUser.id) return; 

            const signal = JSON.parse(msg.content);
            const senderId = msg.sender_id;

            if (peersRef.current.has(senderId)) {
                peersRef.current.get(senderId)?.signal(signal);
            } else {
                await createPeer(false, localStream, senderId, signal);
            }
        })
        .subscribe();

      // Для инициатора (пока упрощенно: если я создал звонок, я жду)
      if (activeCall && activeCall.caller_id === currentUser.id) {
          // В полной Mesh сети здесь нужно отправить "Hello" всем участникам
      }

      return () => { supabase.removeChannel(channel); };
  }, [isCallActive, selectedRoom, currentUser, localStream]);

  // Рингтон
  useEffect(() => {
    if (activeCall?.status === 'ringing' && activeCall.caller_id !== currentUser?.id) {
        if (!ringtoneRef.current) {
            ringtoneRef.current = new Audio(RING_SOUND_URL);
            ringtoneRef.current.loop = true;
        }
        ringtoneRef.current.play().catch(() => {});
    } else {
        if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
        }
    }
    return () => { if (ringtoneRef.current) ringtoneRef.current.pause(); };
  }, [activeCall, currentUser]);

  return {
    activeCall, setActiveCall,
    isCallModalOpen, setIsCallModalOpen,
    isCallActive, setIsCallActive,
    myVideoRef, userVideoRef,
    localStream, remoteStreams,
    startCall, acceptCall, endCall, rejectCall,
    toggleMic, toggleCam, isMicOn, isCamOn,
    startScreenShare, stopScreenShare, isScreenSharing,
    voiceVolume
  };
}
