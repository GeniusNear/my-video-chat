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
  
  const [isMicOn, setIsMicOn] = useState(true)
  const [isCamOn, setIsCamOn] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  
  const myVideoRef = useRef<HTMLVideoElement>(null)
  const peersRef = useRef<Map<string, Instance>>(new Map()) // ID участника -> Peer
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const callNotificationRef = useRef<Notification | null>(null);

  const supabase = createClient()

  // --- УТИЛИТЫ ---
  const getMedia = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getVideoTracks().forEach(t => t.enabled = false); // Старт без видео
        setStreamState(stream);
        return stream;
    } catch (e) {
        console.error('Media error:', e);
        return null;
    }
  };

  const setStreamState = (stream: MediaStream) => {
      setLocalStream(stream);
      if (myVideoRef.current) myVideoRef.current.srcObject = stream;
  };

  const addSystemMessage = async (text: string) => {
    if (!selectedRoom || !currentUser) return;
    await supabase.from('messages').insert({ content: text, sender_id: currentUser.id, room_id: selectedRoom.id, message_type: 'text' });
  };

  // --- СОЗДАНИЕ ПИРА ---
  const createPeer = async (initiator: boolean, stream: MediaStream, partnerId: string) => {
      // @ts-ignore
      const SimplePeer = (await import('simple-peer')).default || (await import('simple-peer'));
      
      // Создаем пира
      const peer = new SimplePeer({ initiator, trickle: false, stream });

      // Когда пир генерирует сигнал (offer/answer/candidate) -> шлем в БД
      peer.on('signal', async (data: any) => {
          await supabase.from('signals').insert({
              room_id: selectedRoom?.id,
              sender_id: currentUser?.id,
              receiver_id: partnerId, // Сигнал конкретному юзеру
              data: data
          });
      });

      peer.on('stream', (remoteStream: MediaStream) => {
          setRemoteStreams(prev => new Map(prev).set(partnerId, remoteStream));
      });

      peer.on('close', () => {
          peersRef.current.delete(partnerId);
          setRemoteStreams(prev => {
              const newMap = new Map(prev);
              newMap.delete(partnerId);
              return newMap;
          });
      });

      peersRef.current.set(partnerId, peer);
      return peer;
  };

  // --- ЛОГИКА ЗВОНКА ---

  const startCall = async () => {
    if (!selectedRoom || !currentUser) return;
    
    // 1. Включаем интерфейс
    setIsCallActive(true);
    setIsCamOn(false);
    
    // 2. Получаем медиа
    const stream = await getMedia();
    if (!stream) return;

    // 3. Создаем запись звонка (чтобы у других зазвонило)
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

    // Обновляем статус
    await supabase.from('calls').update({ status: 'accepted' }).eq('id', activeCall.id);

    // В MESH сети инициатор (звонящий) должен начать соединение со мной.
    // Но так как мы используем trickle: false, нам нужно обменяться сигналами.
    
    // Логика:
    // 1. Я ответил. Я создаю пира (initiator: false) для Звонящего.
    // 2. Звонящий создает пира (initiator: true) для Меня.
    // Это сложно синхронизировать.
    
    // ПРОСТОЙ ВАРИАНТ (РАБОЧИЙ):
    // Тот, кто ОТВЕТИЛ (Accept), посылает сигнал "Я готов" (Ready).
    // Тот, кто ЗВОНИЛ (Caller), видит "Ready" и создает Offer.
    
    await supabase.from('signals').insert({
        room_id: selectedRoom.id,
        sender_id: currentUser?.id,
        receiver_id: activeCall.caller_id,
        data: { type: 'ready' } // Специальный сигнал
    });
  };

  // --- ПОДПИСКА НА СИГНАЛЫ ---
  useEffect(() => {
      if (!isCallActive || !selectedRoom || !currentUser || !localStream) return;

      const channel = supabase.channel('webrtc_signals')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals', filter: `room_id=eq.${selectedRoom.id}` }, 
        async (payload) => {
            const { sender_id, receiver_id, data } = payload.new;

            // Игнорируем свои сигналы
            if (sender_id === currentUser.id) return;
            // Игнорируем чужие (если это приватный сигнал)
            if (receiver_id && receiver_id !== currentUser.id) return;

            // --- ЛОГИКА СОЕДИНЕНИЯ ---
            
            // 1. Если получили "READY" (мы - звонящий, нам ответили)
            if (data.type === 'ready') {
                // Создаем пира-инициатора
                await createPeer(true, localStream, sender_id);
            }
            
            // 2. Если получили OFFER (нам звонят)
            else if (data.type === 'offer') {
                // Создаем пира-ответчика (если его нет)
                const peer = peersRef.current.get(sender_id) || await createPeer(false, localStream, sender_id);
                peer.signal(data);
            }
            
            // 3. Если получили ANSWER (мы звонили, нам пришел ответ на оффер)
            else if (data.type === 'answer') {
                const peer = peersRef.current.get(sender_id);
                if (peer) peer.signal(data);
            }
            
            // 4. ICE Candidate (для trickle: true, но мы пока false)
            else if (data.candidate) {
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
    
    peersRef.current.forEach(p => p.destroy());
    peersRef.current.clear();
    setRemoteStreams(new Map());
    
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    setLocalStream(null);

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

  // СТРИМ (Упрощенно)
  const startScreenShare = async () => { /* ... */ }; // Оставим пока пустым или скопируем старую логику
  const stopScreenShare = async () => { /* ... */ };

  return {
    activeCall, setActiveCall, isCallModalOpen, setIsCallModalOpen, isCallActive, setIsCallActive,
    myVideoRef, userVideoRef: null, // Не нужен
    localStream, remoteStreams,
    startCall, acceptCall, endCall, rejectCall,
    toggleMic, toggleCam, isMicOn, isCamOn,
    startScreenShare, stopScreenShare, isScreenSharing,
    voiceVolume: 0 // Пока заглушка
  };
}
