'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Profile, Message, Call } from '@/types'

export const useChat = () => {
  const [users, setUsers] = useState<Profile[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isUploading, setIsUploading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  // Инициализация
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      
      const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (myProfile) setCurrentUser(myProfile);
      
      const { data: allUsers } = await supabase.from('profiles').select('*').neq('id', session.user.id);
      if (allUsers) {
        setUsers(allUsers);
        const lastId = localStorage.getItem('lastSelectedUser');
        if (lastId) {
            const u = allUsers.find(u => u.id === lastId);
            if(u) setSelectedUser(u);
        }
      }
      setLoading(false);
    };
    init();
  }, [router, supabase]);

  // Загрузка сообщений и подписка
  useEffect(() => {
    if (!selectedUser || !currentUser) { setMessages([]); return; }
    localStorage.setItem('lastSelectedUser', selectedUser.id);

    const fetchMessages = async () => {
      const { data } = await supabase.from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: true });
        
      if (data) {
        setMessages(data.filter(msg => 
          (msg.sender_id === currentUser.id && msg.receiver_id === selectedUser.id) || 
          (msg.sender_id === selectedUser.id && msg.receiver_id === currentUser.id)
        ));
      }
    };
    fetchMessages();

    const channel = supabase.channel('chat_room')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload: any) => {
            if (payload.eventType === 'INSERT') {
                const m = payload.new as Message;
                if ((m.sender_id === selectedUser.id && m.receiver_id === currentUser.id) || 
                    (m.sender_id === currentUser.id && m.receiver_id === selectedUser.id)) {
                    setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
                }
            } else if (payload.eventType === 'DELETE') {
                setMessages(prev => prev.filter(x => x.id !== payload.old.id));
            }
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedUser, currentUser, supabase]);

  // Методы действий
  const sendMessage = async (text: string) => {
    if (!currentUser || !selectedUser) return;
    await supabase.from('messages').insert({ 
        content: text, sender_id: currentUser.id, receiver_id: selectedUser.id, message_type: 'text' 
    });
  };

  const sendFile = async (file: File, type: 'file' | 'audio') => {
    if (!currentUser || !selectedUser) return;
    try {
      setIsUploading(true);
      const filePath = `${currentUser.id}/${Date.now()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('chat-attachments').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
      await supabase.from('messages').insert({ 
        content: type === 'audio' ? 'Голосовое' : file.name, 
        sender_id: currentUser.id, 
        receiver_id: selectedUser.id, 
        message_type: type, 
        file_url: publicUrl 
      });
    } finally { setIsUploading(false); }
  };

  const deleteMessage = async (id: number) => {
    if(confirm('Удалить?')) await supabase.from('messages').delete().eq('id', id);
  };

  const logout = async () => {
    localStorage.removeItem('lastSelectedUser');
    await supabase.auth.signOut();
    router.push('/login');
  };

  return {
    users, currentUser, loading, selectedUser, setSelectedUser,
    messages, isUploading,
    sendMessage, sendFile, deleteMessage, logout,
    supabase // Экспортируем для WebRTC хука
  };
}
