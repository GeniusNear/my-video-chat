'use client'
import { useState } from 'react'
import Image from 'next/image'
import { Profile } from '@/types'

type Props = {
  users: Profile[]; // Список всех, кого можно добавить
  onClose: () => void;
  onCreate: (name: string, userIds: string[]) => void;
}

export default function CreateGroupModal({ users, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleUser = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && selectedIds.length > 0) {
      onCreate(name, selectedIds);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-800 w-full max-w-md p-6 rounded-2xl border border-slate-700 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-4">Новая сходка 😎</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase text-slate-400 font-bold ml-1">Название</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Туса-Джуса"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mt-1 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs uppercase text-slate-400 font-bold ml-1 mb-2 block">Кого зовем?</label>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-600">
              {users.map(user => (
                <div 
                  key={user.id}
                  onClick={() => toggleUser(user.id)}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border ${selectedIds.includes(user.id) ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-700/30 border-transparent hover:bg-slate-700'}`}
                >
                  {/* Чекбокс */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedIds.includes(user.id) ? 'border-indigo-500 bg-indigo-500' : 'border-slate-500'}`}>
                    {selectedIds.includes(user.id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><path d="M20 6L9 17l-5-5"/></svg>}
                  </div>
                  
                  <Image src={user.avatar_url || ''} width={32} height={32} alt="av" className="rounded-full bg-slate-600"/>
                  <span className="text-sm font-medium text-slate-200">{user.username}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-700 rounded-xl text-slate-300 font-medium hover:bg-slate-600 transition-colors">Отмена</button>
            <button 
              type="submit" 
              disabled={!name.trim() || selectedIds.length === 0}
              className="flex-1 py-3 bg-indigo-600 rounded-xl text-white font-bold hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
