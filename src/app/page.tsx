'use client'

import { useEffect, useState } from 'react' 
import { Call, Room } from '@/types'

// Компоненты
import Sidebar from '@/components/Sidebar'
import Chat from '@/components/Chat'
import CallModal from '@/components/CallModal'
import VideoCallScreen from '@/components/VideoCallScreen'

// Хуки
import { useChat } from '@/hooks/useChat'
import { useWebRTC } from '@/hooks/useWebRTC'
import { usePresence } from '@/hooks/usePresence'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'

export default function HomePage() {
  // 1. Подключаем данные чата
  const { 
    currentUser, loading, 
    rooms, selectedRoom, setSelectedRoom, 
    createPrivateChat, createGroupChat, leaveRoom, updateProfile,
    messages, isUploading, sendMessage, sendFile, deleteMessage, logout, supabase 
  } = useChat();

  // 2. Утилиты
  usePresence(currentUser?.id);
  const { unreadCounts, markAsRead, resetUnreadCount } = useUnreadMessages(currentUser?.id);

  // 3. WebRTC (Звонки + Стримы)
  const {
    activeCall, setActiveCall,
    isCallModalOpen, setIsCallModalOpen,
    isCallActive, setIsCallActive,
    myVideoRef, userVideoRef, // <-- ТЕПЕРЬ ОНО ТУТ ЕСТЬ
    localStream, remoteStreams,
    startCall, acceptCall, endCall, rejectCall,
    toggleMic, toggleCam, isMicOn, isCamOn,
    startScreenShare, stopScreenShare, isScreenSharing
  } = useWebRTC(currentUser, selectedRoom);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // --- ЛОГИКА ---
  
  const handleSelectRoom = (room: Room) => {
    setSelectedRoom(room);
    resetUnreadCount(room.id);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (selectedRoom && messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.sender_id !== currentUser?.id) {
            timer = setTimeout(() => {
                markAsRead(selectedRoom.id, lastMsg.id);
            }, 1000);
        }
    }
    return () => clearTimeout(timer);
  }, [selectedRoom, messages, markAsRead, currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase.channel('global_calls').on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, (payload: any) => {
       const c = payload.new as Call;
       if (payload.eventType === 'INSERT' && c.caller_id !== currentUser.id) { 
           setActiveCall(c); 
           setIsCallModalOpen(true); 
       }
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
  }, [currentUser, activeCall, setActiveCall, setIsCallModalOpen, setIsCallActive, supabase, rooms]);

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    e.deltaY < 0 ? setZoomLevel(p => Math.min(p + 0.2, 3)) : setZoomLevel(p => Math.max(p - 0.2, 1));
  };
  useEffect(() => { if (!selectedImage) setZoomLevel(1); }, [selectedImage]);

  const handleDeleteMessage = async (id: number) => {
      if(confirm('Удалить сообщение?')) {
          await supabase.from('messages').delete().eq('id', id);
      }
  }

  const handleToggleScreenShare = () => {
      if (isScreenSharing) {
          stopScreenShare();
      } else {
          startScreenShare(30, '1080p');
      }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-900 text-white font-bold">Загрузка...</div>

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      <Sidebar 
        currentUser={currentUser} 
        rooms={rooms}
        selectedRoom={selectedRoom} 
        unreadCounts={unreadCounts}
        onSelectRoom={handleSelectRoom}
        onCreatePrivateChat={createPrivateChat}
        onCreateGroup={createGroupChat}
        onLeaveRoom={leaveRoom}
        onUpdateProfile={updateProfile}
        onLogout={logout} 
      />

      <main className="flex-1 flex flex-col relative h-full min-w-0">
        
        {/* Экран звонка */}
        {isCallActive && activeCall && (
           <div className="flex-shrink-0 z-30 shadow-2xl relative">
              <VideoCallScreen 
                 myVideoRef={myVideoRef} 
                 userVideoRef={userVideoRef} // Передаем реф (хоть он может быть null в Mesh)
                 
                 localStream={localStream}
                 remoteStreams={remoteStreams}
                 currentUser={currentUser}
                 
                 onLeave={endCall}
                 onToggleMic={toggleMic}
                 onToggleCam={toggleCam}
                 onShareScreen={handleToggleScreenShare}
                 
                 isMicOn={isMicOn}
                 isCamOn={isCamOn}
                 isScreenSharing={isScreenSharing}
              />
           </div>
        )}

        {/* Чат */}
        {selectedRoom ? (
          <div className="flex-1 flex flex-col min-h-0 relative">
             <Chat 
                currentUser={currentUser!}
                selectedRoom={selectedRoom}
                messages={messages}
                isUploading={isUploading}
                onSendMessage={sendMessage}
                onSendFile={sendFile}
                onDeleteMessage={handleDeleteMessage}
                onStartCall={startCall}
                onImageClick={setSelectedImage}
             />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center relative z-10 text-center animate-in fade-in duration-1000">
              <div className="bg-slate-800/50 p-10 rounded-3xl border border-slate-700 shadow-2xl backdrop-blur-sm">
                  <div className="text-6xl mb-6">👋</div>
                  <h1 className="text-3xl font-black text-white mb-2">Добро пожаловать!</h1>
                  <p className="text-slate-400">Выберите чат, чтобы начать общение</p>
              </div>
          </div>
        )}
      </main>

      {/* Модалки */}
      {isCallModalOpen && activeCall && !isCallActive && (
        <CallModal 
            isCaller={activeCall.caller_id === currentUser?.id} 
            type={activeCall.type} 
            onAccept={acceptCall} 
            onReject={rejectCall} 
            targetUser={
                activeCall.caller_id === currentUser?.id ? null : null // Можно допилить поиск юзера
            }
        />
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
