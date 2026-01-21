'use client'
import { RefObject } from 'react'

interface VideoCallScreenProps {
  isVideo: boolean;
  myVideoRef: React.RefObject<HTMLVideoElement | null>; // Добавлено | null
  userVideoRef: React.RefObject<HTMLVideoElement | null>; // Добавлено | null
  onLeave: () => void;
}

export default function VideoCallScreen({ isVideo, myVideoRef, userVideoRef, onLeave }: VideoCallScreenProps) {
  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in fade-in duration-500">
        <div className="flex-1 relative overflow-hidden">
            {/* Видео собеседника (большое) */}
            {isVideo ? (
                <video ref={userVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900">
                    <div className="w-32 h-32 rounded-full bg-indigo-500 flex items-center justify-center text-5xl animate-pulse shadow-[0_0_50px_rgba(99,102,241,0.5)]">👤</div>
                </div>
            )}

            {/* Мое видео (маленькое в углу) */}
            {isVideo && (
                <div className="absolute bottom-24 right-4 w-32 h-48 bg-black/50 backdrop-blur-sm rounded-xl overflow-hidden shadow-2xl border border-white/10 transition-transform hover:scale-105">
                    <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                </div>
            )}
        </div>

        {/* Панель управления */}
        <div className="h-24 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center gap-8 border-t border-white/5">
            <button className="p-4 rounded-full bg-slate-700/50 hover:bg-slate-600 text-white transition-all hover:scale-110">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            </button>
            
            <button 
                onClick={onLeave} 
                className="p-5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 transition-all hover:scale-110 active:scale-95"
            >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>
            </button>
            
            {isVideo && (
                <button className="p-4 rounded-full bg-slate-700/50 hover:bg-slate-600 text-white transition-all hover:scale-110">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                </button>
            )}
        </div>
    </div>
  )
}
