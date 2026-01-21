'use client'

import { useEffect, useState, useRef } from 'react' 
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

// --- ТИПЫ ДАННЫХ ---
type Profile = { id: string; username: string; avatar_url: string; status: string; }
type Message = { id: number; created_at: string; content: string; sender_id: string; receiver_id: string; message_type: 'text' | 'file' | 'audio'; file_url?: string; }
type Call = { id: string; caller_id: string; receiver_id: string; type: 'audio' | 'video'; status: 'ringing' | 'accepted' | 'rejected' | 'ended'; signal_data?: any; }

const EMOJIS = ['😀', '😂', '😍', '🙌', '👍', '🔥', '✨', '😢', '😡', '🤔', '🎉', '❤️', '😎', '🚀', '👀']

// --- КОМПОНЕНТ: Кастомный аудиоплеер (Telegram Style) ---
const AudioPlayer = ({ src }: { src: string }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [barHeights, setBarHeights] = useState<number[]>(Array.from({ length: 35 }, (_, i) => Math.sin(i * 0.5) * 30 + 50));

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isPlaying) {
      intervalId = setInterval(() => {
        setBarHeights(prev => prev.map(() => Math.max(15, Math.random() * 90 + 10)));
      }, 100);
    } else {
      setBarHeights(Array.from({ length: 35 }, (_, i) => Math.sin(i * 0.5) * 30 + 50));
    }
    return () => clearInterval(intervalId);
  }, [isPlaying]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };
  
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="flex items-center gap-3 w-full min-w-[240px] max-w-sm">
      <audio 
        ref={audioRef} 
        src={src} 
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime || 0)} 
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)}
      />
      <button type="button" onClick={togglePlay} className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-indigo-500 rounded-full text-white shadow-md hover:bg-indigo-400 transition-colors">
        {isPlaying ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z" /></svg>}
      </button>
      <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
         <div className="flex items-end justify-between w-full h-6 opacity-80 mb-1 px-1">{barHeights.map((h, i) => (<div key={i} className="w-[3px] bg-current rounded-full transition-all duration-100" style={{ height: `${h}%`, opacity: isPlaying ? 1 : 0.5 }} />))}</div>
         <div className="relative w-full h-1 bg-black/20 rounded-lg">
             <div className="absolute h-full bg-current rounded-lg" style={{ width: `${(progress / (duration || 100)) * 100}%` }} />
             <input type="range" min="0" max={duration || 100} value={progress} onChange={(e) => { if(audioRef.current) audioRef.current.currentTime = Number(e.target.value); }} className="absolute top-[-6px] left-0 w-full h-4 opacity-0 cursor-pointer z-10"/>
         </div>
         <div className="flex justify-between text-[10px] opacity-80 font-medium tracking-wide mt-1"><span>{formatTime(progress)}</span><span>{formatTime(duration)}</span></div>
      </div>
    </div>
  );
};

// --- ГЛАВНАЯ СТРАНИЦА ---
export default function HomePage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Звонки
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  // Запись голоса
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); 
  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob, url: string } | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Лайтбокс
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter()
  const supabase = createClient()

  // --- ЛОГИКА ОНЛАЙН СТАТУСА ---
  useEffect(() => {
    if (!currentUser?.id) return;

    const updateStatus = async (status: 'online' | 'offline') => {
      await supabase.from('profiles').update({ status }).eq('id', currentUser.id);
    };

    // Устанавливаем онлайн при входе
    updateStatus('online');

    // Оффлайн при закрытии вкладки
    const handleBeforeUnload = () => {
      updateStatus('offline');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      updateStatus('offline');
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser?.id, supabase]);

  // --- ЛОГИКА ЗВОНКОВ ---
  const startCall = async (type: 'audio' | 'video') => {
    if (!selectedUser || !currentUser) return;
    const { data, error } = await supabase.from('calls').insert({ caller_id: currentUser.id, receiver_id: selectedUser.id, type, status: 'ringing' }).select().single();
    if (error) alert('Ошибка вызова'); else { setActiveCall(data); setIsCallModalOpen(true); }
  };

  const handleRejectCall = async () => {
    if (!activeCall) return;
    await supabase.from('calls').update({ status: 'rejected' }).eq('id', activeCall.id);
    setActiveCall(null); setIsCallModalOpen(false);
  };

  const handleAcceptCall = async () => {
    if (!activeCall) return;
    await supabase.from('calls').update({ status: 'accepted' }).eq('id', activeCall.id);
  };

  // --- ЛОГИКА ЗАПИСИ ГОЛОСА ---
  const handleMouseDownRecord = () => {
    recordingTimerRef.current = setTimeout(() => startRecordingProcess(), 500);
  };

  const handleMouseUpRecord = () => {
    if (recordingTimerRef.current) { clearTimeout(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (isRecording) stopRecordingProcess();
  };

  const startRecordingProcess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudio({ blob, url: URL.createObjectURL(blob) });
        stream.getTracks().forEach(t => t.stop());
        if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const animate = () => {
        analyser.getByteFrequencyData(dataArray);
        setAudioLevel(dataArray.reduce((a, b) => a + b) / dataArray.length);
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) { alert("Нет доступа к микрофону"); }
  };
  
  const stopRecordingProcess = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSendRecording = async () => {
    if (recordedAudio) {
        const audioFile = new File([recordedAudio.blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        await uploadAndSendFile(audioFile, 'audio');
    }
  };

  // --- ЛОГИКА СООБЩЕНИЙ ---
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (newMessage.trim() === '' || !currentUser || !selectedUser) return;
    const { error } = await supabase.from('messages').insert({
      content: newMessage.trim(),
      sender_id: currentUser.id,
      receiver_id: selectedUser.id,
      message_type: 'text',
    });
    if (!error) setNewMessage('');
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm('Удалить это сообщение?')) return;
    await supabase.from('messages').delete().eq('id', messageId);
  };

  const uploadAndSendFile = async (file: File, type: 'file' | 'audio') => {
    if (!file || !currentUser || !selectedUser) return;
    try {
      setIsUploading(true);
      const filePath = `${currentUser.id}/${Date.now()}_${file.name}`;
      await supabase.storage.from('chat-attachments').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
      await supabase.from('messages').insert({
        content: type === 'audio' ? 'Голосовое сообщение' : file.name,
        sender_id: currentUser.id,
        receiver_id: selectedUser.id,
        message_type: type,
        file_url: publicUrl,
      });
      setRecordedAudio(null);
    } catch (error) { alert('Ошибка загрузки'); } finally { setIsUploading(false); }
  };

  // ФУНКЦИЯ СКАЧИВАНИЯ
  const downloadFile = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      window.open(url, '_blank');
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) await uploadAndSendFile(file, 'file');
      }
    }
  };

  const isOnlyEmojis = (text: string) => {
    if (!text) return false;
    const cleanText = text.replace(/\s/g, '');
    const emojiRegex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|[\ufe00-\ufe0f])+$/;
    return emojiRegex.test(cleanText);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) setZoomLevel(prev => Math.min(prev + 0.2, 3));
    else setZoomLevel(prev => Math.max(prev - 0.2, 1));
  };

  // --- ЭФФЕКТЫ ---
  useEffect(() => {
    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (myProfile) setCurrentUser(myProfile);
      const { data: allUsers } = await supabase.from('profiles').select('*').neq('id', session.user.id);
      if (allUsers) setUsers(allUsers);
      setLoading(false);
    };
    setup();
  }, [router, supabase]);

  useEffect(() => {
    if (!selectedUser || !currentUser) return;
    
    const fetchMessages = async () => {
      const { data } = await supabase.from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: true });
      if (data) setMessages(data.filter(msg => (msg.sender_id === currentUser.id && msg.receiver_id === selectedUser.id) || (msg.sender_id === selectedUser.id && msg.receiver_id === currentUser.id)));
    };
    fetchMessages();

    const channel = supabase.channel('realtime_chat')
      // Следим за сообщениями
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const m = payload.new as Message;
          if ((m.sender_id === selectedUser.id && m.receiver_id === currentUser.id) || (m.sender_id === currentUser.id && m.receiver_id === selectedUser.id)) {
            setMessages(prev => [...prev, m]);
          }
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(x => x.id !== (payload.old as Message).id));
        }
      })
      // Следим за звонками
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, (payload) => {
        const c = payload.new as Call;
        if (payload.eventType === 'INSERT' && c.receiver_id === currentUser.id) { setActiveCall(c); setIsCallModalOpen(true); }
        if (payload.eventType === 'UPDATE' && c.id === activeCall?.id) {
          if (['ended', 'rejected'].includes(c.status)) { setActiveCall(null); setIsCallModalOpen(false); }
        }
      })
      // СЛЕЖЕНИЕ ЗА СТАТУСОМ ПОЛЬЗОВАТЕЛЕЙ (ОНЛАЙН)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
          const updatedProfile = payload.new as Profile;
          setUsers(prev => prev.map(u => u.id === updatedProfile.id ? updatedProfile : u));
          if (selectedUser?.id === updatedProfile.id) {
            setSelectedUser(updatedProfile);
          }
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [selectedUser, currentUser, supabase, activeCall]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">Загрузка...</div>

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* ЛЕВАЯ ПАНЕЛЬ */}
      <aside className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentUser?.avatar_url && <Image src={currentUser.avatar_url} alt="Me" width={40} height={40} className="rounded-full bg-slate-700"/>}
            <p className="font-bold text-sm truncate w-32">{currentUser?.username}</p>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="text-xs text-slate-400 hover:text-white">Выйти</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {users.map((user) => (
            <button key={user.id} onClick={() => setSelectedUser(user)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${selectedUser?.id === user.id ? 'bg-indigo-600 shadow-lg' : 'hover:bg-slate-700/50'}`}>
              <div className="relative">
                <Image src={user.avatar_url} alt={user.username} width={44} height={44} className="rounded-full bg-slate-600 h-11 w-11 shadow-md"/>
                <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-slate-800 rounded-full transition-colors duration-500 ${user.status === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-500'}`}></span>
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">{user.username}</p>
                <p className={`text-[10px] uppercase tracking-wider font-semibold ${user.status === 'online' ? 'text-green-400' : 'text-slate-500'}`}>
                  {user.status === 'online' ? 'Онлайн' : 'Оффлайн'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ОБЛАСТЬ ЧАТА */}
      <main className="flex-1 flex flex-col relative">
        {selectedUser ? (
          <>
            <header className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/60 backdrop-blur-md z-20">
              <div className="flex items-center gap-4">
                <Image src={selectedUser.avatar_url} alt={selectedUser.username} width={40} height={40} className="rounded-full shadow-lg"/>
                <div>
                  <h2 className="font-bold">{selectedUser.username}</h2>
                  <p className={`text-xs ${selectedUser.status === 'online' ? 'text-green-400' : 'text-slate-500'}`}>
                    {selectedUser.status === 'online' ? 'В сети' : 'Был недавно'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startCall('audio')} className="p-2.5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all active:scale-90">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.79 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </button>
                <button onClick={() => startCall('video')} className="p-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-all active:scale-90 shadow-lg shadow-indigo-500/20">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                </button>
              </div>
            </header>

            <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
              {messages.map((msg) => {
                const isMe = msg.sender_id === currentUser?.id;
                const onlyEmojis = msg.message_type === 'text' && isOnlyEmojis(msg.content);
                return (
                  <div key={msg.id} className={`flex gap-3 group animate-in slide-in-from-bottom-2 duration-300 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <Image src={(isMe ? currentUser?.avatar_url : selectedUser.avatar_url) || ''} alt="av" width={36} height={36} className="rounded-full h-9 w-9 shadow-md self-end mb-1"/>
                    <div className={`max-w-[70%] relative ${onlyEmojis ? 'bg-transparent' : `p-3 rounded-2xl shadow-sm border ${isMe ? 'bg-indigo-600 border-indigo-500 rounded-br-none' : 'bg-slate-800 border-slate-700 rounded-bl-none'}`}`}>
                      {msg.message_type === 'text' && <p className={`${onlyEmojis ? 'text-5xl' : 'text-sm'} leading-relaxed`}>{msg.content}</p>}
                      {msg.message_type === 'audio' && msg.file_url && <AudioPlayer src={msg.file_url} />}
                      {msg.message_type === 'file' && msg.file_url && (
                        /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.file_url) 
                          ? <div className="relative group">
                              <img src={msg.file_url} onClick={() => setSelectedImage(msg.file_url!)} className="rounded-lg max-w-full h-auto cursor-pointer hover:brightness-110 transition-all"/>
                              <button onClick={() => downloadFile(msg.file_url!, `image-${msg.id}.png`)} className="absolute top-2 right-2 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4m4-10 7 7 7-7m-7 7V3"/></svg></button>
                            </div>
                          : <div className="flex items-center gap-3 bg-black/20 p-3 rounded-xl">
                              <span className="text-2xl">📄</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{msg.content}</p>
                                <button onClick={() => downloadFile(msg.file_url!, msg.content)} className="text-[10px] text-indigo-400 hover:underline">Скачать файл</button>
                              </div>
                            </div>
                      )}
                      <div className={`text-[9px] mt-1 opacity-50 font-mono ${isMe ? 'text-right' : ''}`}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      
                      {isMe && (
                        <button onClick={() => handleDeleteMessage(msg.id)} className="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-500 p-1 transition-all">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-slate-800/80 border-t border-slate-700 backdrop-blur-lg">
              {recordedAudio ? (
                <div className="flex items-center gap-3 bg-slate-700/50 p-2 rounded-2xl animate-in fade-in">
                  <AudioPlayer src={recordedAudio.url} />
                  <button type="button" onClick={() => setRecordedAudio(null)} className="text-red-400 p-2 hover:bg-red-500/10 rounded-full">✕</button>
                  <button type="button" onClick={handleSendRecording} className="bg-indigo-500 p-2.5 rounded-full shadow-lg"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m22 2-7 20-4-9-9-4Z"/><path d="m22 2-11 11"/></svg></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 relative">
                  {showEmojiPicker && (
                    <div className="absolute bottom-16 left-0 bg-slate-800 border border-slate-700 p-2 rounded-xl shadow-2xl grid grid-cols-5 gap-2 z-50">
                      {EMOJIS.map(e => <button key={e} type="button" onClick={() => { setNewMessage(p => p + e); setShowEmojiPicker(false); }} className="text-2xl hover:scale-125 transition-transform">{e}</button>)}
                    </div>
                  )}
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-white transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></button>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && uploadAndSendFile(e.target.files[0], 'file')}/>
                  <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-slate-400 hover:text-white transition-colors">😊</button>
                  <input 
                    type="text" 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)} 
                    onPaste={handlePaste}
                    placeholder="Напишите сообщение..." 
                    className="flex-1 bg-slate-700/50 border border-slate-600 rounded-full px-5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                  {newMessage.trim() === '' ? (
                    <button 
                      type="button" 
                      onMouseDown={handleMouseDownRecord} 
                      onMouseUp={handleMouseUpRecord}
                      className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-500 scale-125 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-slate-700 text-slate-300'}`}
                      style={{ transform: isRecording ? `scale(${1 + (audioLevel / 100)})` : 'scale(1)' }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                    </button>
                  ) : (
                    <button type="submit" className="p-3 bg-indigo-600 rounded-full hover:bg-indigo-500 transition-all shadow-lg active:scale-90"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m22 2-7 20-4-9-9-4Z"/><path d="m22 2-11 11"/></svg></button>
                  )}
                </div>
              )}
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 font-medium">Выберите, кому написать...</div>
        )}
      </main>

      {/* МОДАЛКА ЗВОНКА */}
      {isCallModalOpen && activeCall && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl animate-in fade-in">
          <div className="bg-slate-800 p-10 rounded-[40px] border border-slate-700 shadow-2xl flex flex-col items-center gap-6 w-full max-w-xs text-center">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20"></div>
              <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center text-5xl relative z-10 border-2 border-indigo-500">👤</div>
            </div>
            <div>
              <h3 className="text-xl font-bold">{activeCall.caller_id === currentUser?.id ? 'Вызов...' : 'Входящий...'}</h3>
              <p className="text-xs text-indigo-400 mt-2 uppercase tracking-widest">{activeCall.type === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}</p>
            </div>
            <div className="flex gap-4 w-full mt-4">
              {activeCall.caller_id === currentUser?.id ? (
                <button onClick={handleRejectCall} className="w-full bg-red-500 py-4 rounded-3xl font-bold hover:bg-red-600 transition-all">Отмена</button>
              ) : (
                <>
                  <button onClick={handleRejectCall} className="flex-1 bg-slate-700 py-4 rounded-3xl font-bold hover:bg-red-500 transition-all">✕</button>
                  <button onClick={handleAcceptCall} className="flex-1 bg-green-500 py-4 rounded-3xl font-bold hover:bg-green-600 transition-all shadow-lg shadow-green-500/20">✓</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ЛАЙТБОКС */}
      {selectedImage && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in" onClick={() => setSelectedImage(null)} onWheel={handleWheel}>
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <img src={selectedImage} className="max-w-full max-h-full rounded-lg shadow-2xl transition-transform duration-200" style={{ transform: `scale(${zoomLevel})` }} />
            <button className="absolute top-8 right-8 text-white/50 hover:text-white text-4xl">✕</button>
            <button onClick={(e) => { e.stopPropagation(); downloadFile(selectedImage, 'download.png'); }} className="absolute bottom-8 right-8 bg-indigo-600 p-4 rounded-full text-white hover:bg-indigo-500">Скачать оригинал</button>
          </div>
        </div>
      )}
    </div>
  )
}