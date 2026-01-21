'use client'
import { useEffect, useState, useRef } from 'react'

export default function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [barHeights, setBarHeights] = useState<number[]>(Array.from({ length: 35 }, (_, i) => Math.sin(i * 0.5) * 30 + 50));

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => setBarHeights(prev => prev.map(() => Math.max(15, Math.random() * 90 + 10))), 100);
    } else {
      setBarHeights(Array.from({ length: 35 }, (_, i) => Math.sin(i * 0.5) * 30 + 50));
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    isPlaying ? audioRef.current.pause() : audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="flex items-center gap-3 w-full min-w-[240px] max-w-sm">
      <audio 
        ref={audioRef} 
        src={src} 
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime || 0)} 
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)} 
        onEnded={() => setIsPlaying(false)}
      />
      <button type="button" onClick={togglePlay} className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-indigo-500 rounded-full text-white shadow-md hover:bg-indigo-400 transition-colors">
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z" /></svg>
        )}
      </button>
      <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
         <div className="flex items-end justify-between w-full h-6 opacity-80 mb-1 px-1">
            {barHeights.map((h, i) => (
                <div key={i} className="w-[3px] bg-current rounded-full transition-all duration-100" style={{ height: `${h}%`, opacity: isPlaying ? 1 : 0.5 }} />
            ))}
         </div>
         <div className="relative w-full h-1 bg-black/20 rounded-lg">
             <div className="absolute h-full bg-current rounded-lg" style={{ width: `${(progress / (duration || 100)) * 100}%` }} />
             <input type="range" min="0" max={duration || 100} value={progress} onChange={(e) => { if(audioRef.current) audioRef.current.currentTime = Number(e.target.value); }} className="absolute top-[-6px] left-0 w-full h-4 opacity-0 cursor-pointer z-10"/>
         </div>
         <div className="flex justify-between text-[10px] opacity-80 font-medium tracking-wide mt-1">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
         </div>
      </div>
    </div>
  );
}
