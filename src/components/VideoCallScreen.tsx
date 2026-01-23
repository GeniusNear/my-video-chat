'use client'
import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { Profile } from '@/types'

type VideoCallScreenProps = {
  myVideoRef: React.RefObject<HTMLVideoElement | null>;
  userVideoRef?: React.RefObject<HTMLVideoElement | null> | null;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>; 
  currentUser: Profile | null;
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onShareScreen: () => void;
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
}

// --- КОНТЕКСТНОЕ МЕНЮ (Красивое) ---
const ContextMenu = ({ x, y, onClose, onVolumeChange }: { x: number, y: number, onClose: () => void, onVolumeChange: (val: number) => void }) => {
    // Вычисляем позицию, чтобы не улетело за экран
    const style = { top: Math.min(y, window.innerHeight - 200), left: Math.min(x, window.innerWidth - 250) };

    return (
        <>
            <div className="fixed inset-0 z-[300]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
            <div 
                className="fixed z-[301] bg-[#111214] border border-[#2b2d31] w-64 rounded-xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-100"
                style={style}
            >
                <div className="px-3 py-3">
                    <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                        <span>Громкость</span>
                        <span>100%</span>
                    </div>
                    <input 
                        type="range" min="0" max="1" step="0.05" defaultValue="1"
                        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                    />
                </div>
                <div className="h-px bg-[#2b2d31] my-1" />
                <button className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors flex items-center gap-3">
                    <span>💬</span> Написать сообщение
                </button>
                <button className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors flex items-center gap-3">
                    <span>👤</span> Открыть профиль
                </button>
                <button className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors flex items-center gap-3">
                    <span>🖥️</span> Развернуть стрим
                </button>
                <div className="h-px bg-[#2b2d31] my-1" />
                <button className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors font-bold flex items-center gap-3">
                    <span>🚫</span> Выгнать участника
                </button>
            </div>
        </>
    )
}

// --- ПЛИТКА (УМНАЯ) ---
const SingleVideo = ({ videoTrack, audioStream, isLocal, profile, isWaiting, isScreenShare, onClick, isPinned }: any) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [menuPos, setMenuPos] = useState<{x: number, y: number} | null>(null);

    // Привязка видео
    useEffect(() => {
        if (videoRef.current && videoTrack) {
            const mediaStream = new MediaStream([videoTrack]); 
            videoRef.current.srcObject = mediaStream;
            setIsVideoEnabled(videoTrack.enabled);
            const checkEnabled = setInterval(() => setIsVideoEnabled(videoTrack.enabled), 500);
            return () => clearInterval(checkEnabled);
        } else { setIsVideoEnabled(false); }
    }, [videoTrack]);

    // Анализ звука
    useEffect(() => {
        if (!audioStream) return;
        let audioCtx: AudioContext;
        let animationId: number;
        try {
            audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyser = audioCtx.createAnalyser();
            const source = audioCtx.createMediaStreamSource(new MediaStream(audioStream.getAudioTracks()));
            source.connect(analyser);
            analyser.fftSize = 64;
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const check = () => {
                analyser.getByteFrequencyData(dataArray);
                setIsSpeaking((dataArray.reduce((a, b) => a + b) / dataArray.length) > 10);
                animationId = requestAnimationFrame(check);
            };
            check();
        } catch (e) {}
        return () => { if (audioCtx) audioCtx.close(); if (animationId) cancelAnimationFrame(animationId); };
    }, [audioStream]);

    const handleVolume = (val: number) => { 
        if (videoRef.current) {
            videoRef.current.volume = val; 
        }
    };
    
    const isMirror = isLocal && !isScreenShare; 
    const showVideo = isVideoEnabled && videoTrack;

    // Логика клика (Pin)
    const handleContainerClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (showVideo && !isWaiting) onClick();
    };

    const containerClasses = isPinned 
        ? "fixed inset-0 z-[150] w-full h-full bg-black rounded-none cursor-default"
        : `relative overflow-hidden flex items-center justify-center transition-all duration-500 ease-in-out shadow-2xl flex-shrink-0
           ${showVideo && !isWaiting
               ? 'w-[480px] h-[270px] rounded-[24px] bg-black border border-white/10 cursor-pointer hover:scale-[1.02] hover:border-white/20' 
               : 'w-[180px] h-[180px] rounded-full bg-[#1e1f22] border-4 cursor-default ' + (isSpeaking ? 'border-green-500 scale-110 shadow-[0_0_30px_rgba(34,197,94,0.6)]' : 'border-[#2b2d31]')
           }
           ${isWaiting ? 'border-red-500 animate-pulse' : ''}`;

    return (
        <div 
            className={containerClasses}
            onClick={handleContainerClick}
            onContextMenu={(e) => {
                // Разрешаем меню для всех
                e.preventDefault(); 
                e.stopPropagation();
                setMenuPos({ x: e.clientX, y: e.clientY });
            }}
        >
            {showVideo ? (
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted={isLocal} 
                    className={`absolute inset-0 w-full h-full ${isScreenShare ? 'object-contain bg-[#0e0e11]' : 'object-cover'} ${isMirror ? 'transform scale-x-[-1]' : ''}`}
                />
            ) : (
                <div className="flex flex-col items-center gap-4 z-10 animate-in fade-in zoom-in-95 duration-300">
                    <div className={`w-32 h-32 rounded-full border-4 relative bg-slate-700 overflow-hidden shadow-xl border-transparent`}>
                        {profile?.avatar_url ? <Image src={profile.avatar_url} alt="av" fill className="object-cover" /> : <div className="text-5xl flex items-center justify-center h-full text-slate-400">👤</div>}
                    </div>
                    {isWaiting && <span className="text-red-400 text-xs font-black uppercase tracking-widest animate-pulse bg-black/50 px-2 py-1 rounded">Ожидание...</span>}
                </div>
            )}
            
            {/* Имя */}
            <div className={`absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-bold text-white z-20 flex gap-2 items-center border border-white/10 transition-opacity ${!showVideo && !isPinned ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                {isScreenShare ? '🖥️ Экран' : (isLocal ? 'Вы' : profile?.username || 'Участник')}
                {isSpeaking && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"/>}
            </div>

            {menuPos && <ContextMenu x={menuPos.x} y={menuPos.y} onClose={() => setMenuPos(null)} onVolumeChange={handleVolume} />}
            
            {isPinned && (
                <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="absolute top-6 right-6 p-3 bg-black/50 hover:bg-black/80 rounded-full text-white z-[160]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            )}
        </div>
    )
}

const VideoTile = ({ stream, isLocal, profile, isWaiting, pinnedId, onPin }: any) => {
    const [videoTracks, setVideoTracks] = useState<MediaStreamTrack[]>([]);
    
    useEffect(() => {
        if (stream) {
            const update = () => setVideoTracks([...stream.getVideoTracks()]);
            update();
            stream.addEventListener('addtrack', update);
            stream.addEventListener('removetrack', update);
            return () => { stream.removeEventListener('addtrack', update); stream.removeEventListener('removetrack', update); };
        } else setVideoTracks([]);
    }, [stream]);

    if (videoTracks.length === 0) return <SingleVideo videoTrack={null} audioStream={stream} isLocal={isLocal} profile={profile} isWaiting={isWaiting} onClick={() => onPin(stream?.id || 'local')} isPinned={false} />;

    return (
        <>
            {videoTracks.map((track, idx) => (
                <SingleVideo 
                    key={track.id} 
                    videoTrack={track} 
                    audioStream={stream} 
                    isLocal={isLocal} 
                    profile={profile} 
                    isScreenShare={idx > 0} 
                    onClick={() => onPin(track.id)}
                    isPinned={pinnedId === track.id}
                />
            ))}
        </>
    );
};

export default function VideoCallScreen({ 
  localStream, remoteStreams, currentUser, onLeave, onToggleMic, onToggleCam, onShareScreen, isMicOn, isCamOn, isScreenSharing 
}: VideoCallScreenProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const participants = Array.from(remoteStreams.entries());
  const showWaitingScreen = participants.length === 0;

  const handlePin = (id: string) => { setPinnedId(prev => prev === id ? null : id); };

  return (
    <div className={`relative bg-[#0e0e11] flex flex-col transition-all duration-500 ease-in-out border-b border-slate-800 overflow-hidden shadow-2xl ${isFullScreen ? 'fixed inset-0 z-[200] h-screen' : 'h-[75vh] min-h-[600px]'}`}>
        
        <button onClick={() => setIsFullScreen(!isFullScreen)} className="absolute top-6 right-6 z-50 p-3 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl text-white/70 transition-all active:scale-95 hover:text-white">
            {isFullScreen ? 'Свернуть' : 'Развернуть'}
        </button>

        <div className="flex-1 p-8 flex items-center justify-center overflow-y-auto custom-scrollbar relative">
            {/* ОГРАНИЧЕНИЕ ПО ШИРИНЕ 75% и FLEX-WRAP */}
            <div className="flex flex-wrap items-center justify-center gap-8 w-3/4 max-w-[1600px] content-center py-10 transition-all duration-500">
                
                {/* 1. Я */}
                <div className="flex justify-center">
                    <VideoTile stream={localStream} isLocal={true} profile={currentUser} pinnedId={pinnedId} onPin={handlePin} />
                </div>

                {/* 2. Ожидание */}
                {showWaitingScreen && (
                    <div className="flex justify-center">
                        <VideoTile stream={null} isWaiting={true} pinnedId={pinnedId} onPin={handlePin} />
                    </div>
                )}

                {/* 3. Участники */}
                {participants.map(([id, stream]) => (
                    <div key={id} className="flex justify-center">
                        <VideoTile key={id} stream={stream} isLocal={false} pinnedId={pinnedId} onPin={handlePin} />
                    </div>
                ))}

            </div>
        </div>

        {/* Панель */}
        {!pinnedId && (
            <div className="h-28 flex items-center justify-center gap-6 bg-gradient-to-t from-black/90 via-[#0e0e11]/80 to-transparent backdrop-blur-sm z-50 relative pb-4 flex-shrink-0">
                <button onClick={onToggleMic} className={`p-5 rounded-[24px] transition-all transform hover:scale-110 active:scale-95 shadow-xl border ${isMicOn ? 'bg-slate-800/80 text-white border-white/5 hover:bg-slate-700' : 'bg-white text-black border-white'}`}>
                    {isMicOn ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}
                </button>

                <button onClick={onLeave} className="px-10 py-4 rounded-[28px] bg-red-600 hover:bg-red-500 text-white font-black transition-all transform hover:scale-105 active:scale-95 shadow-red-600/40 shadow-2xl flex items-center gap-3 uppercase tracking-wider text-sm">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>
                    Завершить
                </button>
                
                <button onClick={onToggleCam} className={`p-5 rounded-[24px] transition-all transform hover:scale-110 active:scale-95 shadow-xl border ${isCamOn ? 'bg-slate-800/80 text-white border-white/5 hover:bg-slate-700' : 'bg-white text-black border-white'}`}>
                    {isCamOn ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="2"><path d="m22 8-6 4 6 4V8Z"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M2 6h.01"/><path d="M7 6h9"/><path d="M16 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1"/></svg>}
                </button>

                <button onClick={onShareScreen} className={`p-5 rounded-[24px] transition-all transform hover:scale-110 active:scale-95 shadow-xl border ${isScreenSharing ? 'bg-green-500 text-white border-green-400 shadow-green-500/40' : 'bg-slate-800/80 text-slate-400 border-white/5 hover:text-white hover:bg-slate-700'}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
                </button>
            </div>
        )}
    </div>
  )
}
