export type Profile = { 
  id: string; 
  username: string; 
  avatar_url: string; 
  status: string;
  last_seen?: string;
}

export type Room = {
  id: string;
  name: string | null;
  type: 'private' | 'group';
  created_by: string;
  avatar_url?: string;
  participants?: { user_id: string; user: Profile }[]; // <-- НОВОЕ
}

export type Message = { 
  id: number; 
  created_at: string; 
  content: string; 
  sender_id: string; 
  room_id: string; // <-- ТЕПЕРЬ ТУТ ROOM_ID
  message_type: 'text' | 'file' | 'audio'; 
  file_url?: string; 
  sender?: Profile; // (Для удобства будем подгружать профиль отправителя)
}

export type Call = { 
  id: string; 
  room_id: string; // <-- Звонок привязан к комнате
  caller_id: string; 
  type: 'audio' | 'video'; 
  status: 'ringing' | 'accepted' | 'rejected' | 'ended'; 
  signal_data?: any; 
}
