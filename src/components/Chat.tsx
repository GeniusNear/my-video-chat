'use client'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import AudioPlayer from './AudioPlayer'

// --- ТИПЫ (дублируем необходимые) ---
type Profile = { id: string; username: string; avatar_url: string; status: string; }
type Message = { id: number; created_at: string; content: string; sender_id: string; receiver_id: string; message_type: 'text' | 'file' | 'audio'; file_url?: string; }

const EMOJIS = ['😀', '😂', '😍', '🙌', '👍', '🔥', '✨', '😢', '😡', '🤔', '🎉', '❤️', '😎', '🚀', '👀']

type ChatProps = {
  currentUser: Profile;
  selectedUser: Profile;
  messages: Message[];
  isUploading: boolean;
  onSendMessage: (text: string) => void;
  onSendFile: (file: File, type: 'file' | 'audio') => void;
  onDeleteMessage: (id: number) => void;
  onStartCall: (type: 'audio' | 'video') => void;
  onImageClick: (url: string) => void;
}

export default function Chat({ currentUser, selectedUser, messages, isUploading, onSendMessage, onSendFile, onDeleteMessage, onStartCall, onImageClick }: ChatProps) {
  const [newMessage, setNewMessage] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  
  // Логика записи (перенесена сюда)
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob, url: string } | null>(null)
  
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const animationFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Скролл при наборе текста (опционально)
  const isOnlyEmojis = (text: string) => {
    if (!text) return false;
    const cleanText = text.replace(/\s/g, '');
    return /^(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])+$/.test(cleanText);
  };

  // --- ЗАПИСЬ ---
  const handleMouseDownRecord = () => { recordingTimerRef.current = setTimeout(() => startRecordingProcess(), 500); };
  const handleMouseUpRecord = () => { if (recordingTimerRef.current) { clearTimeout(recordingTimerRef.current); recordingTimerRef.current = null; } };
  const handleStopClick = () => { if (isRecording && mediaRecorderRef.current) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

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
        if (audioContextRef.current) audioContextRef.current.close();
        setAudioLevel(0);
      };
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
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
    } catch(e) { alert("Микрофон недоступен"); }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if(newMessage.trim()) { onSendMessage(newMessage); setNewMessage(''); }
  }

  const handleSendAudio = () => {
    if (recordedAudio) {
       const file = new File([recordedAudio.blob], 'voice.webm', { type: 'audio/webm' });
       onSendFile(file, 'audio');
       setRecordedAudio(null);
    }
  }

  // Paste logic
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items; 
        if(!items) return;
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) onSendFile(file, 'file');
            }
        }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onSendFile]);


  return (
    <main className="flex-1 flex flex-col relative h-full">
      {/* --- HEADER --- */}
      <header className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/60 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
            <Image src={selectedUser.avatar_url} alt={selectedUser.username} width={40} height={40} className="rounded-full shadow-lg"/>
            <div><h2 className="font-bold text-white">{selectedUser.username}</h2><p className="text-sm text-green-400 font-medium">Онлайн</p></div>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => onStartCall('audio')} className="p-2.5 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all active:scale-90"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.79 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></button>
            <button onClick={() => onStartCall('video')} className="p-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-all active:scale-90 shadow-lg shadow-indigo-500/20"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg></button>
        </div>
      </header>

      {/* --- MESSAGES --- */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
        {messages.map(msg => {
            const isMe = msg.sender_id === currentUser.id;
            const onlyEmojis = msg.message_type === 'text' && isOnlyEmojis(msg.content);
            return (
                <div key={msg.id} className={`flex gap-4 items-start justify-start group relative animate-in slide-in-from-left-2 duration-300 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <Image src={(isMe ? currentUser.avatar_url : selectedUser.avatar_url) || ''} alt="avatar" width={40} height={40} className="rounded-full bg-slate-700 h-10 w-10 shadow-md"/>
                    <div className="flex flex-col gap-1 max-w-xl">
                        <div className={`flex items-baseline gap-2 ${isMe ? 'flex-row-reverse' : ''}`}><span className={`text-sm font-bold ${isMe ? 'text-indigo-400' : 'text-slate-300'}`}>{isMe ? currentUser.username : selectedUser.username}</span><span className="text-[10px] text-slate-500 font-mono">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                        <div className={`relative ${onlyEmojis ? "p-0" : `p-3 rounded-2xl rounded-tl-none shadow-md ${isMe ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100' : 'bg-slate-800 border border-slate-700 text-slate-200'}`}`}>
                            {msg.message_type === 'text' && <p className={`${onlyEmojis ? 'text-4xl' : 'text-sm'} leading-relaxed`}>{msg.content}</p>}
                            {msg.message_type === 'file' && msg.file_url && (
                                <div className="space-y-2">
                                {/\.(jpg|jpeg|png|gif|webp)$/i.test(msg.file_url) ? <div className="cursor-pointer hover:opacity-90" onClick={() => onImageClick(msg.file_url!)}><img src={msg.file_url} className="rounded-lg max-w-xs md:max-w-sm h-auto shadow-sm" /></div> : <a href={msg.file_url} download target="_blank" className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-lg hover:bg-slate-900 transition-colors"><div className="p-2 bg-indigo-500 rounded-lg"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div><div><p className="text-xs font-bold truncate w-32">{msg.content}</p><p className="text-[10px] text-slate-400">Нажмите, чтобы скачать</p></div></a>}
                                </div>
                            )}
                            {msg.message_type === 'audio' && msg.file_url && <AudioPlayer src={msg.file_url} />}
                            {isMe && <button onClick={() => onDeleteMessage(msg.id)} className={`absolute -right-8 top-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-500 transition-all p-1 ${isMe ? 'right-auto -left-8' : '-right-8'}`} title="Удалить"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>}
                        </div>
                    </div>
                </div>
            )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* --- INPUT --- */}
      <form onSubmit={handleSendText} className="p-4 bg-slate-800/70 backdrop-blur-sm border-t border-slate-700 relative">
        {recordedAudio ? (
            <div className="flex items-center gap-4 w-full bg-slate-700 rounded-full p-2 px-4 animate-in fade-in slide-in-from-bottom-2">
                <AudioPlayer src={recordedAudio.url} />
                <button type="button" onClick={() => setRecordedAudio(null)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-full"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                <button type="button" onClick={handleSendAudio} disabled={isUploading} className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-colors shadow-lg">{isUploading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}</button>
            </div>
        ) : (
            <>
                {showEmojiPicker && ( <div className="absolute bottom-20 left-4 bg-slate-800 border border-slate-700 p-2 rounded-xl shadow-2xl grid grid-cols-5 gap-2 z-50 animate-in zoom-in-95">{EMOJIS.map(emoji => (<button key={emoji} type="button" onClick={() => { setNewMessage(p => p + emoji); setShowEmojiPicker(false); }} className="text-2xl hover:bg-slate-700 p-1 rounded transition-transform active:scale-125">{emoji}</button>))}</div> )}
                <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => { if(e.target.files?.[0]) onSendFile(e.target.files[0], 'file'); }}/>
                <div className="relative flex items-center gap-2 w-full">
                    {!isRecording && ( <><button type="button" disabled={isUploading} onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full bg-slate-700 text-slate-400 hover:text-white transition-colors">{isUploading ? <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"/> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>}</button><button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`p-2 rounded-full transition-colors ${showEmojiPicker ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg></button></> )}
                    {!isRecording && ( <input type="text" placeholder="Напишите сообщение..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1 bg-slate-700 rounded-full px-5 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"/> )}
                    {isRecording && ( <div className="flex-1 flex items-center justify-center text-red-400 font-bold animate-pulse gap-2"><div className="w-3 h-3 bg-red-500 rounded-full" />Идет запись... (Нажмите стоп)</div> )}
                    {newMessage.trim() === '' && !isRecording ? ( <button type="button" onMouseDown={handleMouseDownRecord} onMouseUp={handleMouseUpRecord} className="p-3 rounded-full bg-slate-700 text-slate-300 active:scale-95 transition-all shadow-md"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg></button> ) : isRecording ? ( <button type="button" onClick={handleStopClick} className="p-3 rounded-full bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all" style={{ transform: `scale(${1 + (audioLevel / 100)})` }}><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg></button> ) : ( <button type="submit" className="p-3 rounded-full bg-indigo-600 text-white shadow-lg disabled:bg-slate-600 transition-all hover:bg-indigo-500" disabled={newMessage.trim() === '' || isUploading}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="m22 2-11 11"/></svg></button> )}
                </div>
            </>
        )}
      </form>
    </main>
  )
}
