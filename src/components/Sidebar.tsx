'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { Room, Profile } from '@/types'
import CreateGroupModal from './CreateGroupModal'
import ProfileSettingsModal from './ProfileSettingsModal'

type SidebarProps = {
  currentUser: Profile | null;
  rooms: Room[];
  selectedRoom: Room | null;
  unreadCounts: Record<string, number>;
  onSelectRoom: (room: Room) => void;
  onCreatePrivateChat: (userId: string) => void;
  onCreateGroup: (name: string, userIds: string[]) => void;
  onUpdateProfile: (name: string, file: File | null) => Promise<void>;
  onLogout: () => void;
  onLeaveRoom: (roomId: string) => void;
}

export default function Sidebar({ currentUser, rooms, selectedRoom, unreadCounts, onSelectRoom, onCreatePrivateChat, onCreateGroup, onUpdateProfile, onLogout, onLeaveRoom }: SidebarProps) {
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchUsers = async () => {
        if(!currentUser) return;
        const { data } = await supabase.from('profiles').select('*').neq('id', currentUser.id);
        if (data) setAllUsers(data);
    };
    fetchUsers();
  }, [currentUser, supabase]);

  const getRoomName = (room: Room) => {
      if (room.type === 'group') return room.name;
      const partner = room.participants?.find(p => p.user_id !== currentUser?.id)?.user;
      return partner ? partner.username : 'Личный чат';
  };

  return (
    <div className={`h-full flex flex-col bg-[#1e1f22] transition-all duration-500 ease-in-out border-r border-black/40 relative shadow-2xl flex-shrink-0 ${isCollapsed ? 'w-20' : 'w-80'}`}>
      
      {/* КНОПКА СВОРАЧИВАНИЯ */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-10 z-50 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center border-2 border-[#0f172a] hover:bg-indigo-400 transition-all shadow-lg text-[10px] text-white"
      >
        {isCollapsed ? '▶' : '◀'}
      </button>

      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-black italic text-white shadow-lg">С</div>
        {!isCollapsed && <h2 className="font-black text-2xl tracking-tighter text-indigo-500 italic uppercase">Сходка</h2>}
      </div>

      {/* ТВОЙ ПРОФИЛЬ */}
      <div className="px-4 mb-8">
        <div className={`bg-slate-800/40 p-2 rounded-2xl border border-white/5 flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="relative cursor-pointer group flex-shrink-0" onClick={() => setIsSettingsOpen(true)}>
            {currentUser?.avatar_url ? (
                <Image src={currentUser.avatar_url} alt="me" width={44} height={44} className="rounded-full ring-2 ring-indigo-500/50 object-cover" />
            ) : (
                <div className="w-11 h-11 bg-slate-600 rounded-full flex items-center justify-center">👤</div>
            )}
            <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs transition-all text-white">⚙️</div>
          </div>
          
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm truncate text-white">{currentUser?.username}</p>
              <button onClick={onLogout} className="text-[10px] text-red-400 font-black uppercase tracking-widest hover:text-red-300 transition-colors">Выход</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-8 scrollbar-hide">
        
        {/* КНОПКА СОЗДАНИЯ */}
        <button 
            onClick={() => setIsGroupModalOpen(true)}
            className={`w-full bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 active:scale-95 group ${isCollapsed ? 'p-3 aspect-square' : 'py-3.5'}`}
            title="Создать сходку"
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:rotate-90 transition-transform"><path d="M12 5v14M5 12h14"/></svg>
            {!isCollapsed && <span>Создать</span>}
        </button>

        {/* ГРУППЫ И ЧАТЫ */}
        {rooms.length > 0 && (
            <div>
                {!isCollapsed && <h3 className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Чаты</h3>}
                <div className="space-y-2">
                    {rooms.map((room) => {
                        const unread = unreadCounts[room.id] || 0;
                        const name = getRoomName(room);
                        return (
                        <div key={room.id} className="relative group">
                            <button key={room.id} onClick={() => onSelectRoom(room)} className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${selectedRoom?.id === room.id ? 'bg-indigo-600 shadow-xl' : 'hover:bg-slate-700/50 text-slate-400'}`}>
                                <div className="w-10 h-10 rounded-xl bg-indigo-500 flex-shrink-0 flex items-center justify-center font-black text-white shadow-inner text-lg">
                                    {room.type === 'group' ? name?.charAt(0).toUpperCase() : '👤'}
                                </div>
                                {!isCollapsed && (
                                    <div className="flex-1 min-w-0 flex justify-between items-center">
                                        <span className={`font-bold text-sm truncate ${selectedRoom?.id === room.id ? 'text-white' : ''}`}>{name}</span>
                                        {unread > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-pulse">{unread}</span>}
                                    </div>
                                )}
                            </button>
                            {/* Кнопка выхода (только если развернуто) */}
                            {!isCollapsed && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onLeaveRoom(room.id); }} 
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Покинуть"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        )
                    })}
                </div>
            </div>
        )}

        {/* КОНТАКТЫ */}
        <div>
            {!isCollapsed && <h3 className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Люди</h3>}
            <div className="space-y-1">
                {allUsers.map((user) => (
                <button key={user.id} onClick={() => onCreatePrivateChat(user.id)} className="w-full flex items-center gap-3 p-3 rounded-2xl transition-all hover:bg-slate-700/40 group relative">
                    <div className="relative flex-shrink-0">
                        {user.avatar_url ? (
                            <Image src={user.avatar_url} alt="av" width={40} height={40} className="rounded-full group-hover:ring-2 ring-indigo-500 transition-all object-cover h-10 w-10" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">👤</div>
                        )}
                        <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-[#1e1f22] rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-slate-500'}`} />
                    </div>
                    {!isCollapsed && <p className="font-bold text-sm text-slate-300 group-hover:text-white truncate transition-colors">{user.username}</p>}
                </button>
                ))}
            </div>
        </div>

      </div>

      {isGroupModalOpen && <CreateGroupModal users={allUsers} onClose={() => setIsGroupModalOpen(false)} onCreate={onCreateGroup} />}
      {isSettingsOpen && currentUser && <ProfileSettingsModal currentUser={currentUser} onClose={() => setIsSettingsOpen(false)} onUpdate={onUpdateProfile} />}
    </div>
  )
}
