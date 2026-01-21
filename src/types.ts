export type Profile = { 
  id: string; 
  username: string; 
  avatar_url: string; 
  status: string; 
}

export type Message = { 
  id: number; 
  created_at: string; 
  content: string; 
  sender_id: string; 
  receiver_id: string; 
  message_type: 'text' | 'file' | 'audio'; 
  file_url?: string; 
}

export type Call = { 
  id: string; 
  caller_id: string; 
  receiver_id: string; 
  type: 'audio' | 'video'; 
  status: 'ringing' | 'accepted' | 'rejected' | 'ended'; 
  signal_data?: any; 
}
