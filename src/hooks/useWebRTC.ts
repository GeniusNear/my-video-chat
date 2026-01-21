'use client'
import { useState, useRef, useEffect } from 'react'
import type { Instance } from 'simple-peer'
import { createClient } from '@/lib/supabase'
import { Call, Profile } from '@/types'

const RING_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2060/2060-preview.mp3';

export const useWebRTC = (currentUser: Profile | null, selectedUser: Profile | null) => {
  const [activeCall, setActiveCall] = useState<Call | null>(null)
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  const [isCallActive, setIsCallActive] = useState(false)
  const [isMicOn, setIsMicOn] = useState(true)
  const [isCamOn, setIsCamOn] = useState(false)
  
  const myVideoRef = useRef<HTMLVideoElement>(null)
  const userVideoRef = useRef<HTMLVideoElement>(null)
  const connectionRef = useRef<Instance | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const callNotificationRef = useRef<Notification | null>(null);

  const supabase = createClient()

  // Вспомогательная функция для добавления системного сообщения в чат
  const addSystemMessage = async (text: string, type: 'audio' | 'video') => {
    if (!activeCall || !currentUser) return;
    
    // Определяем получателя сообщения (того, с кем был звонок)
    const partnerId = activeCall.caller_id === currentUser.id ? activeCall.receiver_id : activeCall.caller_id;

    await supabase.from('messages').insert({
        content: text,
        sender_id: currentUser.id,
        receiver_id: partnerId,
        message_type: 'text' // Можно добавить тип 'system', но пока пусть будет text
    });
  };

  useEffect(() => {
    if (activeCall?.status === 'ringing' && activeCall.receiver_id === currentUser?.id) {
        if (!ringtoneRef.current) {
            ringtoneRef.current = new Audio(RING_SOUND_URL);
            ringtoneRef.current.loop = true;
        }
        ringtoneRef.current.play().catch(() => {});

        if (Notification.permission === 'granted' && !callNotificationRef.current) {
            const n = new Notification('Входящий звонок!', {
                body: activeCall.type === 'video' ? '📹 Видеозвонок' : '📞 Аудиозвонок',
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

    return () => {
        if (ringtoneRef.current) { ringtoneRef.current.pause(); ringtoneRef.current = null; }
        if (callNotificationRef.current) { callNotificationRef.current.close(); callNotificationRef.current = null; }
    };
  }, [activeCall, currentUser]);


  const getMedia = async () => {
    try {
        const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        currentStream.getVideoTracks().forEach(t => t.enabled = false);
        setStream(currentStream);
        return currentStream;
    } catch (e) {
        console.error('Ошибка доступа к медиа:', e);
        return null;
    }
  };

  const startCall = async () => {
    if (!selectedUser || !currentUser) return;
    
    // @ts-ignore
    const SimplePeer = (await import('simple-peer')).default || (await import('simple-peer'));
    
    const currentStream = await getMedia();
    if (!currentStream) return;

    setIsCallActive(true);
    setIsCamOn(false);
    
    setTimeout(() => { if (myVideoRef.current) myVideoRef.current.srcObject = currentStream; }, 100);

    const peer = new SimplePeer({ initiator: true, trickle: false, stream: currentStream });

    peer.on('signal', async (data: any) => {
      const { data: callData } = await supabase.from('calls').insert({
        caller_id: currentUser.id,
        receiver_id: selectedUser.id,
        type: 'audio',
        status: 'ringing',
        signal_data: data
      }).select().single();
      
      if (callData) {
        setActiveCall(callData);
        setIsCallModalOpen(true);
      }
    });

    peer.on('stream', (remoteStream: MediaStream) => {
      if (userVideoRef.current) userVideoRef.current.srcObject = remoteStream;
    });

    connectionRef.current = peer;
  };

  const acceptCall = async () => {
    if (!activeCall) return;
    
    // @ts-ignore
    const SimplePeer = (await import('simple-peer')).default || (await import('simple-peer'));
    
    setIsCallModalOpen(false);
    setIsCallActive(true);
    setIsCamOn(false);

    const currentStream = await getMedia();
    if (!currentStream) return;

    setTimeout(() => { if (myVideoRef.current) myVideoRef.current.srcObject = currentStream; }, 100);

    const peer = new SimplePeer({ initiator: false, trickle: false, stream: currentStream });

    peer.on('signal', async (data: any) => {
      await supabase.from('calls').update({ status: 'accepted', signal_data: data }).eq('id', activeCall.id);
    });

    peer.on('stream', (remoteStream: MediaStream) => {
      if (userVideoRef.current) userVideoRef.current.srcObject = remoteStream;
    });

    peer.signal(activeCall.signal_data);
    connectionRef.current = peer;
  };

  const endCall = async () => {
    setIsCallActive(false);
    setIsCallModalOpen(false);
    
    // <-- НОВОЕ: Добавляем сообщение о завершении звонка
    // Только инициатор звонка пишет в базу, чтобы не дублировать сообщения
    if (activeCall && activeCall.caller_id === currentUser?.id) {
        const icon = activeCall.type === 'video' ? '📹' : '📞';
        await addSystemMessage(`${icon} Звонок завершен`, activeCall.type);
    }

    if (connectionRef.current) connectionRef.current.destroy();
    if (stream) stream.getTracks().forEach(track => track.stop());
    
    setStream(null);
    if (activeCall) {
        await supabase.from('calls').update({ status: 'ended' }).eq('id', activeCall.id);
        setActiveCall(null);
    }
  };

  const rejectCall = async () => {
    if (!activeCall) return;

    // <-- НОВОЕ: Логика пропущенного/отклоненного
    if (activeCall.status === 'ringing') {
        // Если я отклоняю входящий - это "Звонок отклонен" (пишем мы)
        // Если я отменяю исходящий - это "Отмена"
        const isIncoming = activeCall.receiver_id === currentUser?.id;
        const msgText = isIncoming ? '📞 Звонок отклонен' : '📞 Звонок отменен';
        
        await addSystemMessage(msgText, activeCall.type);
    }

    await supabase.from('calls').update({ status: 'rejected' }).eq('id', activeCall.id);
    setActiveCall(null);
    setIsCallModalOpen(false);
  };

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMicOn(prev => !prev);
    }
  };

  const toggleCam = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsCamOn(prev => !prev);
    }
  };

  useEffect(() => {
    if (!connectionRef.current || !activeCall || activeCall.caller_id !== currentUser?.id) return;
    if (activeCall.status === 'accepted' && activeCall.signal_data && !connectionRef.current.connected) {
        connectionRef.current.signal(activeCall.signal_data);
    }
  }, [activeCall, currentUser]);

  return {
    activeCall, setActiveCall,
    isCallModalOpen, setIsCallModalOpen,
    isCallActive, setIsCallActive,
    myVideoRef, userVideoRef,
    startCall, acceptCall, endCall, rejectCall,
    toggleMic, toggleCam, isMicOn, isCamOn
  };
}
