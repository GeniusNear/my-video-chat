'use client'
import Image from 'next/image'
import { Profile } from '@/types'

type CallModalProps = {
  isCaller: boolean;
  type: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
  targetUser: Profile | null; // Добавили, чтобы видеть кому звоним
}

export default function CallModal({ isCaller, type, onAccept, onReject, targetUser }: CallModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-800 p-8 rounded-[32px] border border-white/10 shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full text-center">
        
        {/* Аватарка с красной пульсацией */}
        <div className="relative">
          {/* Внешние кольца пульсации */}
          <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20"></div>
          <div className="absolute inset-[-10px] bg-red-500/10 rounded-full animate-pulse"></div>
          
          <div className="w-24 h-24 rounded-full relative z-10 overflow-hidden border-4 border-indigo-500 shadow-xl bg-slate-700">
            {targetUser?.avatar_url ? (
                <Image src={targetUser.avatar_url} alt="avatar" fill className="object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>
            )}
          </div>
        </div>
        
        <div>
          <h3 className="text-2xl font-bold text-white tracking-tight">
            {isCaller ? `Звоним ${targetUser?.username || '...'}` : 'Входящий звонок'}
          </h3>
          <p className="text-red-400 text-sm mt-2 font-bold uppercase tracking-widest animate-pulse">
            {isCaller ? 'Ожидание ответа...' : `Вызывает: ${targetUser?.username || 'Неизвестный'}`}
          </p>
        </div>

        <div className="flex items-center gap-4 mt-4 w-full">
          {isCaller ? (
            <button 
              onClick={onReject} 
              className="w-full bg-red-500/10 border border-red-500/50 hover:bg-red-500 text-red-500 hover:text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Отменить
            </button>
          ) : (
            <>
              <button onClick={onReject} className="flex-1 bg-slate-700 hover:bg-red-500/20 text-red-400 py-4 rounded-2xl font-bold transition-all border border-red-500/10 active:scale-95">
                Отклонить
              </button>
              <button 
                onClick={onAccept} 
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/></svg>
                Принять
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
