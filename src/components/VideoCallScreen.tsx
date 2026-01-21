'use client'
import { RefObject, useState } from 'react'

type VideoCallScreenProps = {
  // isVideo убрали, так как теперь видео включается динамически через isCamOn
  myVideoRef: RefObject<HTMLVideoElement | null>; // Исправлен тип
  userVideoRef: RefObject<HTMLVideoElement | null>; // Исправлен тип
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  isMicOn: boolean;
  isCamOn: boolean;
}

export default function VideoCallScreen({ 
  myVideoRef, userVideoRef, onLeave, onToggleMic, onToggleCam, isMicOn, isCamOn 
}: VideoCallScreenProps) {
  
  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <div className={`relative bg-[#0e0e11] flex flex-col transition-all duration-300 ease-in-out border-b border-slate-800 overflow-hidden ${isFullScreen ? 'fixed inset-0 z-[200] h-screen' : 'h-[60vh] min-h-[400px]'}`}>
        
        <button onClick={() => setIsFullScreen(!isFullScreen)} className="absolute top-4 right-4 z-50 p-2 bg-black/40 hover:bg-black/60 rounded-lg text-white/70 hover:text-white transition-colors">
            {isFullScreen ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>}
        </button>

        <div className="flex-1 p-4 flex items-center justify-center overflow-hidden">
            <div className="grid grid-cols-2 gap-4 w-full h-full max-w-6xl max-h-full">
                
                {/* --- 1. СОБЕСЕДНИК --- */}
                <div className="relative bg-[#1e1f22] rounded-2xl overflow-hidden shadow-lg border border-[#2b2d31] flex items-center justify-center group w-full h-full">
                    {/* Видео рендерится ВСЕГДА (для звука), но класс скрывает его, если нет потока? Нет, поток есть всегда, просто черный экран если выкл. */}
                    <video 
                        ref={userVideoRef} 
                        autoPlay 
                        playsInline 
                        className="absolute inset-0 w-full h-full object-cover" 
                    />
                    
                    {/* Заглушка (аватар) поверх видео, если мы хотим показать, что видео нет (показуха, так как реального состояния собеседника "cam off" мы пока не знаем, можно доработать) */}
                    {/* Для простоты показуем видео всегда, если собеседник его включит - оно появится. */}
                    
                    <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg text-sm font-medium text-white flex items-center gap-2 z-10">
                        <span>Собеседник</span>
                    </div>
                </div>

                {/* --- 2. Я --- */}
                <div className="relative bg-[#1e1f22] rounded-2xl overflow-hidden shadow-lg border border-[#2b2d31] flex items-center justify-center w-full h-full">
                    <video 
                        ref={myVideoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] ${!isCamOn ? 'opacity-0' : 'opacity-100'}`}
                    />

                    {!isCamOn && (
                        <div className="w-24 h-24 rounded-full bg-slate-600 flex items-center justify-center text-4xl animate-pulse">
                            You
                        </div>
                    )}

                    <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg text-sm font-medium text-white flex items-center gap-2 z-10">
                        <span>Вы</span>
                        {!isMicOn && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="2"><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}
                    </div>
                </div>

            </div>
        </div>

        {/* ПАНЕЛЬ */}
        <div className="h-20 bg-[#1e1f22] flex items-center justify-center gap-4 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.3)] z-40 relative flex-shrink-0">
            {/* Микрофон */}
            <button onClick={onToggleMic} className={`p-4 rounded-full transition-all ${isMicOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-white text-black hover:bg-gray-200'}`}>
                {isMicOn ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}
            </button>
            
            {/* Отбой */}
            <button onClick={onLeave} className="px-8 py-3 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-red-500/30">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>
            </button>
            
            {/* Камера (теперь всегда доступна) */}
            <button onClick={onToggleCam} className={`p-4 rounded-full transition-all ${isCamOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-white text-black hover:bg-gray-200'}`}>
                {isCamOn ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 8-6 4 6 4V8Z"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M2 6h.01"/><path d="M7 6h9"/><path d="M16 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1"/></svg>}
            </button>
        </div>
    </div>
  )
}
