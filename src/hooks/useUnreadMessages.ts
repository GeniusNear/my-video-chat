'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export const useUnreadMessages = (userId: string | undefined) => {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({}) // { [contactId]: count }
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return;

    const fetchUnread = async () => {
      // 1. Получаем ID последних прочитанных сообщений для каждого чата
      const { data: readStatus } = await supabase.from('last_read').select('contact_id, last_read_message_id').eq('user_id', userId);
      
      const readMap = new Map(readStatus?.map(r => [r.contact_id, r.last_read_message_id]) || []);

      // 2. Получаем ВСЕ сообщения, где получатель = Я
      const { data: messages } = await supabase
        .from('messages')
        .select('sender_id, id')
        .eq('receiver_id', userId);

      if (!messages) return;

      // 3. Считаем
      const counts: Record<string, number> = {};
      messages.forEach(msg => {
        const lastRead = readMap.get(msg.sender_id) || 0;
        if (msg.id > lastRead) {
          counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
        }
      });
      setUnreadCounts(counts);
    };

    fetchUnread();

    // 4. Слушаем новые сообщения, чтобы увеличивать счетчик
    const channel = supabase.channel('unread_counter')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            const msg = payload.new;
            if (msg.receiver_id === userId) {
                setUnreadCounts(prev => ({
                    ...prev,
                    [msg.sender_id]: (prev[msg.sender_id] || 0) + 1
                }));
            }
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, supabase]);

  // --- НОВАЯ ФУНКЦИЯ (для исправления ошибки) ---
  // Просто сбрасываем счетчик визуально при входе в комнату
  const resetUnreadCount = (contactId: string) => {
      setUnreadCounts(prev => ({ ...prev, [contactId]: 0 }));
  };

  // Функция: "Я прочитал чат с этим пользователем" (обнуляет UI + пишет в базу)
  const markAsRead = async (contactId: string, lastMessageId: number) => {
    // Оптимистично обнуляем счетчик в UI
    setUnreadCounts(prev => ({ ...prev, [contactId]: 0 }));

    // Сохраняем в базу (upsert = обновить или создать)
    await supabase.from('last_read').upsert({
        user_id: userId,
        contact_id: contactId,
        last_read_message_id: lastMessageId
    }, { onConflict: 'user_id, contact_id' });
  };

  // Не забудь вернуть resetUnreadCount здесь!
  return { unreadCounts, markAsRead, resetUnreadCount };
}