'use client'
import { useState, useRef, useEffect } from 'react'
import type { Instance } from 'simple-peer'
import { createClient } from '@/lib/supabase'
import { Call, Profile, Room } from '@/types'

const RING_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2060/2060-preview.mp3';

export const useWebRTC = (currentUser: Profile | null, selectedRoom: Room | null) => {
  // Состояния звонка
  const [activeCall, setActiveCall] = useState<Call | null>(null)
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  const [isCallActive, setIsCallActive] = useState(false)
  
  // Устройства
  const [isMicOn, setIsMicOn] = useState(true)
  const [isCamOn, setIsCamOn] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  // Потоки
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  // Важно: Map хранит ID пользователя -> Поток
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  
  // Рефы
  const myVideoRef = useRef<HTMLVideoElement>(null)
  const peersRef = useRef<Map<string, Instance>>(new Map()) // ID пользователя -> Peer Connection
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const callNotificationRef = useRef<Notification | null>(null);
  const [voiceVolume, setVoiceVolume] = useState(0);

  const supabase = createClient()

  // --- УТИЛИТЫ ---
  const getMedia = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // По умолчанию видео выключено для старта (как в Discord)
        stream.getVideoTracks().forEach(t => t.enabled = false);
        
        setLocalStream(stream);
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;
        
        // Запускаем анализ голоса (для анимации своей аватарки)
        setupVoiceAnalyser(stream);
        
        return stream;
    } catch (e) {
        console.error('Media error:', e);
        alert('Не удалось получить доступ к камере или микрофону');
        return null;
    }
  };

  const setupVoiceAnalyser = (stream: MediaStream) => {
      if(audioContextRef.current) return;
      try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const analyser = audioContext.createAnalyser();
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(analyser);
          analyser.fftSize = 64;
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          
          audioContextRef.current = audioContext;

          const checkVolume = () => {
              if (!analyser) return;
              analyser.getByteFrequencyData(dataArray);
              const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
              setVoiceVolume(volume);
              requestAnimationFrame(checkVolume);
          };
          checkVolume();
      } catch(e) { console.error("Audio Analysis Error", e); }
  };

  const addSystemMessage = async (text: string) => {
    if (!selectedRoom || !currentUser) return;
    await supabase.from('messages').insert({ content: text, sender_id: currentUser.id, room_id: selectedRoom.id, message_type: 'text' });
  };

  // --- СОЗДАНИЕ ПИРА (Simple-Peer) ---
  const createPeer = async (initiator: boolean, stream: MediaStream, partnerId: string, signalData?: any) => {
      // @ts-ignore
      const SimplePeer = (await import('simple-peer')).default || (await import('simple-peer'));
      
      const peer = new SimplePeer({ initiator, trickle: false, stream });

      peer.on('signal', async (data: any) => {
          // Отправляем сигнал конкретному пользователю
          await supabase.from('signals').insert({
              room_id: selectedRoom?.id,
              sender_id: currentUser?.id,
              receiver_id: partnerId,
              data: data
          });
      });

      peer.on('stream', (remoteStream: MediaStream) => {
          setRemoteStreams(prev => new Map(prev).set(partnerId, remoteStream));
      });

      peer.on('error', (err: any) => {
          console.error('Peer error:', err);
          peersRef.current.delete(partnerId);
      });

      peer.on('close', () => {
          peersRef.current.delete(partnerId);
          setRemoteStreams(prev => {
              const newMap = new Map(prev);
              newMap.delete(partnerId);
              return newMap;
          });
      });

      if (signalData) peer.signal(signalData);
      
      peersRef.current.set(partnerId, peer);
      return peer;
  };

  // --- ЛОГИКА ЗВОНКА ---

  const startCall = async () => {
    if (!selectedRoom || !currentUser) return;
    
    setIsCallActive(true);
    setIsCamOn(false);
    
    const stream = await getMedia();
    if (!stream) {
        setIsCallActive(false);
        return;
    }

    const { data: call } = await supabase.from('calls').insert({
        caller_id: currentUser.id,
        room_id: selectedRoom.id,
        type: 'audio',
        status: 'ringing'
    }).select().single();
    
    if (call) setActiveCall(call);
  };

  const acceptCall = async () => {
    if (!activeCall || !selectedRoom) return;
    
    setIsCallModalOpen(false);
    setIsCallActive(true);
    setIsCamOn(false);

    const stream = await getMedia();
    if (!stream) return;

    await supabase.from('calls').update({ status: 'accepted' }).eq('id', activeCall.id);

    // Отправляем сигнал READY всем в комнате (точнее, инициатору)
    // В идеальном Mesh надо слать всем, но пока шлем инициатору
    await supabase.from('signals').insert({
        room_id: selectedRoom.id,
        sender_id: currentUser?.id,
        receiver_id: activeCall.caller_id,
        data: { type: 'ready' }
    });
  };

  // --- ПОДПИСКА НА СИГНАЛЫ (HANDSHAKE) ---
  useEffect(() => {
      if (!isCallActive || !selectedRoom || !currentUser || !localStream) return;

      const channel = supabase.channel('webrtc_signals')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals', filter: `room_id=eq.${selectedRoom.id}` }, 
        async (payload) => {
            const { sender_id, receiver_id, data } = payload.new;

            // Игнорируем свои и чужие (не мне адресованные) сигналы
            if (sender_id === currentUser.id) return;
            if (receiver_id && receiver_id !== currentUser.id) return;

            // 1. Получили READY -> Мы инициатор -> Создаем Offer
            if (data.type === 'ready') {
                if (!peersRef.current.has(sender_id)) {
                    await createPeer(true, localStream, sender_id);
                }
            }
            
            // 2. Получили OFFER -> Мы принимающий -> Создаем Answer
            else if (data.type === 'offer') {
                if (!peersRef.current.has(sender_id)) {
                    await createPeer(false, localStream, sender_id, data);
                } else {
                    peersRef.current.get(sender_id)?.signal(data);
                }
            }
            
            // 3. Получили ANSWER или CANDIDATE -> Просто сигналим существующему пиру
            else {
                const peer = peersRef.current.get(sender_id);
                if (peer) peer.signal(data);
            }
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, [isCallActive, selectedRoom, currentUser, localStream]);


  const endCall = async () => {
    setIsCallActive(false);
    setIsCallModalOpen(false);
    
    // Уничтожаем все соединения
    peersRef.current.forEach(p => p.destroy());
    peersRef.current.clear();
    setRemoteStreams(new Map());
    
    // Останавливаем локальные треки
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    if(audioContextRef.current) audioContextRef.current.close();

    // Завершаем звонок в БД (если я инициатор)
    if (activeCall && activeCall.caller_id === currentUser?.id) {
        await addSystemMessage('📞 Звонок завершен');
        await supabase.from('calls').update({ status: 'ended' }).eq('id', activeCall.id);
    }
    setActiveCall(null);
  };

  const rejectCall = async () => {
    if (!activeCall) return;
    await addSystemMessage('📞 Звонок отклонен');
    await supabase.from('calls').update({ status: 'rejected' }).eq('id', activeCall.id);
    setActiveCall(null);
    setIsCallModalOpen(false);
  };

  // --- УПРАВЛЕНИЕ МЕДИА ---
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

  const startScreenShare = async (fps = 30, quality = '1080p') => {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { width: 1920, height: 1080, frameRate: fps }, 
            audio: true 
        });
        const screenTrack = screenStream.getVideoTracks()[0];

        // Заменяем видео трек у всех пиров
        peersRef.current.forEach(peer => {
            // @ts-ignore
            const sender = peer._pc.getSenders().find((s: any) => s.track.kind === 'video');
            if (sender) sender.replaceTrack(screenTrack);
        });

        // Обновляем локальное превью
        if (myVideoRef.current) myVideoRef.current.srcObject = screenStream;
        
        setIsScreenSharing(true);
        setIsCamOn(true); // Считаем, что "видео" включено (хоть это и экран)

        // Обработка остановки стрима средствами браузера
        screenTrack.onended = () => stopScreenShare();

    } catch (e) { console.error("Ошибка стрима:", e); }
  };

  const stopScreenShare = async () => {
      // Возвращаем камеру
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = cameraStream.getVideoTracks()[0];

      peersRef.current.forEach(peer => {
          // @ts-ignore
          const sender = peer._pc.getSenders().find((s: any) => s.track.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
      });

      if (myVideoRef.current) myVideoRef.current.srcObject = cameraStream;
      setIsScreenSharing(false);
      // Если камера была выключена до стрима - выключаем трек
      if (!isCamOn) videoTrack.enabled = false;
  };

  // Рингтон и уведомления
  useEffect(() => {
    if (activeCall?.status === 'ringing' && activeCall.caller_id !== currentUser?.id) {
        if (!ringtoneRef.current) {
            ringtoneRef.current = new Audio(RING_SOUND_URL);
            ringtoneRef.current.loop = true;
        }
        ringtoneRef.current.play().catch(() => {});

        if (Notification.permission === 'granted' && !callNotificationRef.current) {
            const n = new Notification('Входящий звонок!', {
                body: '📞 Кто-то звонит...',
                icon: '/icon.png',
                requireInteraction: true
            });
            n.onclick = () => { window.focus(); n.close(); };
            callNotificationRef.current = n;
        }
    } else {
        if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
        }
        if (callNotificationRef.current) {
            callNotificationRef.current.close();
            callNotificationRef.current = null;
        }
    }
    return () => { if (ringtoneRef.current) ringtoneRef.current.pause(); };
  }, [activeCall, currentUser]);

  return {
    activeCall, setActiveCall,
    isCallModalOpen, setIsCallModalOpen,
    isCallActive, setIsCallActive,
    myVideoRef, userVideoRef: null,
    localStream, remoteStreams,
    startCall, acceptCall, endCall, rejectCall,
    toggleMic, toggleCam, isMicOn, isCamOn,
    startScreenShare, stopScreenShare, isScreenSharing,
    voiceVolume
  };
}
