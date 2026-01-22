'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Profile, Message, Room } from '@/types'

const MSG_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3';

export const useChat = () => {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [rooms, setRooms] = useState<Room[]>([]) 
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null) 
  const [messages, setMessages] = useState<Message[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const router = useRouter()
  const supabase = createClient()

  // 1. Инициализация
  useEffect(() => {
    const init = async () => {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      
      const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (myProfile) setCurrentUser(myProfile);
      setLoading(false);
    };
    init();
  }, [router, supabase]);

  // 2. Загрузка комнат
  useEffect(() => {
    if (!currentUser) return;

    const fetchRooms = async () => {
      const { data: myParticipations } = await supabase
        .from('room_participants')
        .select('room_id')
        .eq('user_id', currentUser.id);
      
      if (myParticipations && myParticipations.length > 0) {
        const roomIds = myParticipations.map(p => p.room_id);
        const { data: myRooms } = await supabase.from('rooms').select(`*, participants:room_participants(user_id, user:profiles(*))`).in('id', roomIds);
        if (myRooms) setRooms(myRooms as any);
      }
    };
    
    fetchRooms();

    const channel = supabase.channel('my_rooms')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_participants', filter: `user_id=eq.${currentUser.id}` }, 
        async (payload) => {
            const { data: newRoom } = await supabase.from('rooms').select(`*, participants:room_participants(user_id, user:profiles(*))`).eq('id', payload.new.room_id).single();
            if (newRoom) {
                setRooms(prev => {
                    if (prev.some(r => r.id === newRoom.id)) return prev;
                    return [...prev, newRoom as any];
                });
            }
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser, supabase]);

  // 3. Загрузка сообщений
  useEffect(() => {
    if (!selectedRoom) { setMessages([]); return; }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select(`*, sender:profiles(*)`)
        .eq('room_id', selectedRoom.id)
        .order('created_at', { ascending: true });
        
      if (data) setMessages(data as any);
    };
    fetchMessages();

    const channel = supabase.channel(`room:${selectedRoom.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${selectedRoom.id}` }, 
        async (payload) => {
            const newMsg = payload.new as Message;
            const { data: sender } = await supabase.from('profiles').select('*').eq('id', newMsg.sender_id).single();
            const msgWithSender = { ...newMsg, sender };
            
            setMessages(prev => [...prev, msgWithSender as any]);

            if (newMsg.sender_id !== currentUser?.id) {
                new Audio(MSG_SOUND_URL).play().catch(() => {});
                if (Notification.permission === 'granted' && document.hidden) {
                    new Notification('Новое сообщение', { body: newMsg.content || 'Файл', icon: '/icon.png' });
                }
            }
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedRoom, currentUser, supabase]);

  // --- ДЕЙСТВИЯ ---

  const sendMessage = async (text: string) => {
    if (!currentUser || !selectedRoom) return;
    await supabase.from('messages').insert({ 
        content: text, sender_id: currentUser.id, room_id: selectedRoom.id, message_type: 'text' 
    });
  };

  const sendFile = async (file: File, type: 'file' | 'audio') => {
    if (!currentUser || !selectedRoom) return;
    try {
      setIsUploading(true);
      const filePath = `${selectedRoom.id}/${Date.now()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('chat-attachments').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
      await supabase.from('messages').insert({ 
        content: type === 'audio' ? 'Голосовое' : file.name, sender_id: currentUser.id, room_id: selectedRoom.id, message_type: type, file_url: publicUrl 
      });
    } finally { setIsUploading(false); }
  };

  const deleteMessage = async (id: number) => {
    if(confirm('Удалить?')) await supabase.from('messages').delete().eq('id', id);
  };

  const createPrivateChat = async (otherUserId: string) => {
    if (!currentUser) return;

    const existingRoom = rooms.find(r => r.type === 'private' && r.participants?.some(p => p.user_id === otherUserId));
    if (existingRoom) { setSelectedRoom(existingRoom); return; }

    const { data: room } = await supabase.from('rooms').insert({ type: 'private', created_by: currentUser.id }).select().single();
    if (!room) return;

    await supabase.from('room_participants').insert([
        { room_id: room.id, user_id: currentUser.id },
        { room_id: room.id, user_id: otherUserId }
    ]);

    const { data: fullRoom } = await supabase.from('rooms').select(`*, participants:room_participants(user_id, user:profiles(*))`).eq('id', room.id).single();
    if (fullRoom) {
        setRooms(prev => [...prev, fullRoom as any]);
        setSelectedRoom(fullRoom as any);
    }
  };

  const createGroupChat = async (name: string, userIds: string[]) => {
    if (!currentUser) return;

    const { data: room, error } = await supabase.from('rooms').insert({
        name,
        type: 'group',
        created_by: currentUser.id,
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${name}`
    }).select().single();

    if (error || !room) return;

    const participants = [currentUser.id, ...userIds].map(uid => ({ room_id: room.id, user_id: uid }));
    await supabase.from('room_participants').insert(participants);
    await supabase.from('messages').insert({ content: `Сходка "${name}" создана!`, sender_id: currentUser.id, room_id: room.id, message_type: 'text' });
  };

  const addMemberToGroup = async (userId: string) => {
      if (!selectedRoom || !currentUser) return;
      await supabase.from('room_participants').insert({ room_id: selectedRoom.id, user_id: userId });
      await supabase.from('messages').insert({ content: 'Новый участник залетел на сходку!', sender_id: currentUser.id, room_id: selectedRoom.id, message_type: 'text' });
  };

  const leaveRoom = async (roomId: string) => {
      if (!confirm('Выйти из чата?')) return;
      await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', currentUser?.id);
      setRooms(prev => prev.filter(r => r.id !== roomId));
      if (selectedRoom?.id === roomId) setSelectedRoom(null);
  };

  // <-- НОВОЕ: Обновление профиля
  const updateProfile = async (name: string, file: File | null) => {
    if (!currentUser) return;
    let avatarUrl = currentUser.avatar_url;

    if (file) {
        const filePath = `avatars/${currentUser.id}/${Date.now()}`;
        const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(filePath, file);
        if (!uploadError) {
            const { data } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
            avatarUrl = data.publicUrl;
        }
    }

    const { error } = await supabase.from('profiles').update({ username: name, avatar_url: avatarUrl }).eq('id', currentUser.id);
    if (!error) {
        setCurrentUser(prev => prev ? { ...prev, username: name, avatar_url: avatarUrl } : null);
    }
  };

  const logout = async () => {
    localStorage.removeItem('lastSelectedUser');
    await supabase.auth.signOut();
    router.push('/login');
  };

  return {
    currentUser, loading, 
    rooms, selectedRoom, setSelectedRoom, 
    createPrivateChat, createGroupChat, addMemberToGroup, leaveRoom, updateProfile,
    messages, isUploading,
    sendMessage, sendFile, deleteMessage, logout,
    supabase
  };
}
