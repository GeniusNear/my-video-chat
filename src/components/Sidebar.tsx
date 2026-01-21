'use client'
import Image from 'next/image'

type Profile = { id: string; username: string; avatar_url: string; status: string; }

type SidebarProps = {
  currentUser: Profile | null;
  users: Profile[];
  selectedUser: Profile | null;
  // <-- НОВОЕ: Объект с количеством непрочитанных { [userId]: count }
  unreadCounts: Record<string, number>; 
  onSelectUser: (user: Profile) => void;
  onLogout: () => void;
}

export default function Sidebar({ currentUser, users, selectedUser, unreadCounts, onSelectUser, onLogout }: SidebarProps) {
  return (
    <aside className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col flex-shrink-0">
      {/* Шапка профиля */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
        <div className="flex items-center gap-3">
          {currentUser?.avatar_url && (
            <Image 
              src={currentUser.avatar_url} 
              alt="Me" 
              width={40} 
              height={40} 
              className="rounded-full bg-slate-600 ring-2 ring-slate-700"
            />
          )}
          <div>
            <p className="font-bold text-sm text-slate-100">{currentUser?.username}</p>
            <p className="text-xs text-green-400 font-medium">Онлайн</p>
          </div>
        </div>
        <button 
          onClick={onLogout} 
          className="text-xs text-slate-400 hover:text-red-400 transition-colors p-2 hover:bg-slate-700/50 rounded-lg"
        >
          Выйти
        </button>
      </div>

      {/* Список пользователей */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <h3 className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2">
          Пользователи
        </h3>
        
        {users.map((user) => {
          // Получаем количество непрочитанных для этого пользователя
          const unread = unreadCounts[user.id] || 0;

          return (
            <button 
              key={user.id} 
              onClick={() => onSelectUser(user)} 
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group text-left ${
                selectedUser?.id === user.id 
                  ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20 translate-x-1' 
                  : 'hover:bg-slate-700/50 hover:translate-x-1'
              }`}
            >
              <div className="relative">
                <Image 
                  src={user.avatar_url} 
                  alt={user.username} 
                  width={44} 
                  height={44} 
                  className={`rounded-full bg-slate-600 h-11 w-11 transition-all ${
                    selectedUser?.id === user.id ? 'ring-2 ring-white/20' : 'group-hover:ring-2 ring-indigo-500/50'
                  }`}
                />
                <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-slate-800 rounded-full transition-colors duration-300 ${
                  user.status === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-slate-500'
                }`}></span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <p className={`font-semibold text-sm truncate ${
                    selectedUser?.id === user.id ? 'text-white' : 'text-slate-200 group-hover:text-white'
                  }`}>
                    {user.username}
                  </p>
                  
                  {/* <-- НОВОЕ: Кружочек с непрочитанными --> */}
                  {unread > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-red-500/40 animate-in zoom-in min-w-[20px] text-center">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </div>
                
                <p className={`text-[11px] truncate ${
                  selectedUser?.id === user.id ? 'text-indigo-200' : 'text-slate-400 group-hover:text-slate-300'
                }`}>
                  {user.status === 'online' ? 'В сети' : 'Был недавно'}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  )
}
