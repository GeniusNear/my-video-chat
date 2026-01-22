'use client'
import { useState, useRef } from 'react'
import Image from 'next/image'
import { Profile } from '@/types'

type Props = {
  currentUser: Profile;
  onClose: () => void;
  onUpdate: (name: string, file: File | null) => Promise<void>;
}

export default function ProfileSettingsModal({ currentUser, onClose, onUpdate }: Props) {
  const [username, setUsername] = useState(currentUser.username || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(currentUser.avatar_url || '');
  const [isLoading, setIsLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file)); // Показываем превью сразу
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await onUpdate(username, avatarFile);
    setIsLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-800 w-full max-w-sm p-8 rounded-3xl border border-slate-700 shadow-2xl flex flex-col items-center">
        <h2 className="text-2xl font-bold text-white mb-6">Настройки профиля</h2>
        
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
          
          {/* Аватарка с кнопкой загрузки */}
          <div className="relative self-center group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <Image 
              src={previewUrl} 
              alt="Avatar" 
              width={100} 
              height={100} 
              className="rounded-full w-24 h-24 object-cover border-4 border-slate-700 shadow-lg group-hover:opacity-50 transition-opacity"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*"/>
          </div>

          {/* Поле имени */}
          <div>
            <label className="text-xs uppercase text-slate-400 font-bold ml-1 mb-1 block">Имя пользователя</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-700 rounded-xl text-slate-300 font-medium hover:bg-slate-600 transition-colors">Отмена</button>
            <button 
              type="submit" 
              disabled={isLoading}
              className="flex-1 py-3 bg-indigo-600 rounded-xl text-white font-bold hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
