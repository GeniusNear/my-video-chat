'use client'

import { useEffect, useState } from 'react' 
import { Call } from '@/types'

// Компоненты
import Sidebar from '@/components/Sidebar'
import Chat from '@/components/Chat'
import CallModal from '@/components/CallModal'
import VideoCallScreen from '@/components/VideoCallScreen'

// Хуки
import { useChat } from '@/hooks/useChat'
import { useWebRTC } from '@/hooks/useWebRTC'

export default function HomePage() {
  // 1. Подключаем данные чата
  const { 
    users, currentUser, loading, selectedUser, setSelectedUser, 
    messages, isUploading, sendMessage, sendFile, deleteMessage, logout, supabase 
  } = useChat();

  // 2. Подключаем WebRTC (передаем данные из чата)
  const {
    activeCall, setActiveCall,
    isCallModalOpen, setIsCallModalOpen,
    isCallActive, setIsCallActive,
    myVideoRef, userVideoRef,
    startCall, acceptCall, endCall, rejectCall
  } = useWebRTC(currentUser, selectedUser);

  // 3. Локальные состояния UI (лайтбокс)
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // 4. Подписка на входящие звонки (в Page, т.к. связывает Chat и WebRTC)
  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('global_calls').on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, (payload: any) => {
       const c = payload.new as Call;
       // Входящий звонок
       if (payload.eventType === 'INSERT' && c.receiver_id === currentUser.id) { 
           setActiveCall(c); 
           setIsCallModalOpen(true); 
       }
       // Обновление статуса
       if (payload.eventType === 'UPDATE' && c.id === activeCall?.id) { 
          if(['ended','rejected'].includes(c.status)) { 
              setActiveCall(null); 
              setIsCallModalOpen(false); 
              setIsCallActive(false); 
          }
          if(c.status === 'accepted') setActiveCall(c);
       }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser, activeCall, setActiveCall, setIsCallModalOpen, setIsCallActive, supabase]);

  // Хендлер зума
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    e.deltaY < 0 ? setZoomLevel(p => Math.min(p + 0.2, 3)) : setZoomLevel(p => Math.max(p - 0.2, 1));
  };
  useEffect(() => { if (!selectedImage) setZoomLevel(1); }, [selectedImage]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-900 text-white font-bold">Загрузка...</div>

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      <Sidebar 
        currentUser={currentUser} users={users} selectedUser={selectedUser} 
        onSelectUser={setSelectedUser} onLogout={logout} 
      />

      {selectedUser ? (
        <Chat 
          currentUser={currentUser!} selectedUser={selectedUser} messages={messages}
          isUploading={isUploading} onSendMessage={sendMessage} onSendFile={sendFile}
          onDeleteMessage={deleteMessage} onStartCall={startCall} onImageClick={setSelectedImage}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center relative z-10 text-center animate-in fade-in duration-1000">
            <div className="bg-slate-800/50 p-10 rounded-3xl border border-slate-700 shadow-2xl backdrop-blur-sm">
                <div className="text-6xl mb-6">👋</div>
                <h1 className="text-3xl font-black text-white mb-2">Добро пожаловать!</h1>
                <p className="text-slate-400">Выберите чат, чтобы начать общение</p>
            </div>
        </div>
      )}

      {/* ЭКРАНЫ */}
      {isCallActive && activeCall && (
        <VideoCallScreen isVideo={activeCall.type === 'video'} myVideoRef={myVideoRef} userVideoRef={userVideoRef} onLeave={endCall} />
      )}
      
      {isCallModalOpen && activeCall && !isCallActive && (
        <CallModal isCaller={activeCall.caller_id === currentUser?.id} type={activeCall.type} onAccept={acceptCall} onReject={rejectCall} />
      )}
      
      {selectedImage && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in" onClick={() => setSelectedImage(null)} onWheel={handleWheel}>
           <div className="relative w-full h-full flex items-center justify-center p-4">
             <img src={selectedImage} className="max-w-full max-h-full rounded-lg shadow-2xl transition-transform duration-200" style={{ transform: `scale(${zoomLevel})` }} />
             <button className="absolute top-8 right-8 text-white/50 hover:text-white text-4xl">✕</button>
           </div>
        </div>
      )}
    </div>
  )
}
