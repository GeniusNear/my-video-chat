'use client'
import { useState, useRef, useEffect } from 'react'
import type { Instance } from 'simple-peer'
import { createClient } from '@/lib/supabase'
import { Call, Profile } from '@/types'

export const useWebRTC = (currentUser: Profile | null, selectedUser: Profile | null) => {
  const [activeCall, setActiveCall] = useState<Call | null>(null)
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  const [isCallActive, setIsCallActive] = useState(false)
  
  const myVideoRef = useRef<HTMLVideoElement>(null)
  const userVideoRef = useRef<HTMLVideoElement>(null)
  const connectionRef = useRef<Instance | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  
  const supabase = createClient()

  // 1. Начать звонок
  const startCall = async (type: 'audio' | 'video') => {
    if (!selectedUser || !currentUser) return;
    
    // @ts-ignore
    const SimplePeer = (await import('simple-peer')).default || (await import('simple-peer'));
    
    const currentStream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
    setStream(currentStream);
    setIsCallActive(true);
    
    // Хак для обновления ref
    setTimeout(() => { if (myVideoRef.current) myVideoRef.current.srcObject = currentStream; }, 100);

    const peer = new SimplePeer({ initiator: true, trickle: false, stream: currentStream });

    peer.on('signal', async (data: any) => {
      const { data: callData } = await supabase.from('calls').insert({
        caller_id: currentUser.id,
        receiver_id: selectedUser.id,
        type,
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

  // 2. Принять звонок
  const acceptCall = async () => {
    if (!activeCall) return;
    
    // @ts-ignore
    const SimplePeer = (await import('simple-peer')).default || (await import('simple-peer'));
    
    setIsCallModalOpen(false);
    setIsCallActive(true);

    const currentStream = await navigator.mediaDevices.getUserMedia({ video: activeCall.type === 'video', audio: true });
    setStream(currentStream);
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

  // 3. Завершить звонок
  const endCall = async () => {
    setIsCallActive(false);
    setIsCallModalOpen(false);
    
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
    await supabase.from('calls').update({ status: 'rejected' }).eq('id', activeCall.id);
    setActiveCall(null);
    setIsCallModalOpen(false);
  };

  // 4. Слежение за статусом звонка
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
    startCall, acceptCall, endCall, rejectCall
  };
}
