'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export const usePresence = (userId: string | undefined) => {
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return;

    // Функция обновления статуса
    const updateStatus = async (status: 'online' | 'offline') => {
      await supabase.from('profiles').update({ 
        status,
        last_seen: new Date().toISOString() // Записываем время
      }).eq('id', userId);
    };

    // 1. Ставим "Онлайн" при входе
    updateStatus('online');

    // 2. Слушаем видимость вкладки (переключился на другую вкладку = оффлайн?)
    // Обычно в мессенджерах статус "Online" висит, пока вкладка открыта, даже в фоне.
    // Но если хочешь строго "ушел - пришел", раскомментируй код ниже:
    /*
    const handleVisibilityChange = () => {
      if (document.hidden) updateStatus('offline');
      else updateStatus('online');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    */

    // 3. Периодический "Heartbeat" (каждые 2 минуты подтверждаем, что мы тут)
    // Это нужно, если браузер упадет и не успеет отправить "offline"
    const interval = setInterval(() => updateStatus('online'), 120000);

    // 4. Ставим "Оффлайн" при закрытии/обновлении
    const handleBeforeUnload = () => {
      // Используем navigator.sendBeacon для надежности при закрытии
      // Но Supabase REST API требует fetch. Попробуем синхронно, но это не гарантировано.
      // Лучше просто положиться на heartbeat и last_seen.
      updateStatus('offline');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // document.removeEventListener('visibilitychange', handleVisibilityChange);
      updateStatus('offline');
    };
  }, [userId, supabase]);
}
