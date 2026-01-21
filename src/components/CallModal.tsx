'use client'

type CallModalProps = {
  isCaller: boolean;
  type: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export default function CallModal({ isCaller, type, onAccept, onReject }: CallModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full text-center">
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20"></div>
          <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center text-4xl relative z-10 overflow-hidden border-2 border-indigo-500 shadow-xl">👤</div>
        </div>
        
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">
            {isCaller ? 'Исходящий звонок...' : 'Входящий звонок...'}
          </h3>
          <p className="text-slate-400 text-sm mt-1 font-medium uppercase tracking-widest">
            {type === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}
          </p>
        </div>

        <div className="flex items-center gap-4 mt-4 w-full">
          {isCaller ? (
            <button onClick={onReject} className="w-full bg-red-500/10 border border-red-500/50 hover:bg-red-500 text-red-500 hover:text-white py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2">
              Отменить
            </button>
          ) : (
            <>
              <button onClick={onReject} className="flex-1 bg-slate-700 hover:bg-red-500/20 text-red-400 py-3 rounded-2xl font-bold transition-all border border-red-500/30">
                Отклонить
              </button>
              <button onClick={onAccept} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-2xl font-bold transition-colors shadow-lg shadow-green-500/20 flex items-center justify-center gap-2">
                Ответить
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
