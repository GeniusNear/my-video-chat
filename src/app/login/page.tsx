'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase' // Проверь этот путь, возможно у тебя @/lib/supabase
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // 1. Сначала ВСЕГДА пробуем войти
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (!signInError) {
      // Если вошли — улетаем на главную
      router.push('/')
      router.refresh()
      return
    }

    // 2. Если ошибка входа — проверяем, нужно ли регистрировать
    // Если ошибка говорит, что данных нет в базе — регистрируем
    if (signInError.message.includes("Invalid login credentials")) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: email.split('@')[0],
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
            status: 'online'
          }
        }
      })

      if (signUpError) {
        // Если и тут ошибка (например, пароль слишком короткий)
        setMessage({ type: 'error', text: 'Ошибка: ' + signUpError.message })
      } else {
        // Если регистрация прошла успешно
        if (signUpData.session) {
           router.push('/')
           router.refresh()
        } else {
           setMessage({ type: 'success', text: 'Аккаунт создан! Попробуйте войти.' })
        }
      }
    } else {
      // Если пароль просто неверный для этой почты
      setMessage({ type: 'error', text: 'Неверный пароль или данные' })
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4 relative overflow-hidden">
      {/* Декоративные фоновые элементы */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-md bg-slate-800/40 backdrop-blur-2xl p-8 rounded-[32px] border border-white/10 shadow-2xl z-10">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl rotate-12 flex items-center justify-center text-white text-3xl shadow-xl mx-auto mb-6">
            <span className="-rotate-12">🚀</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Вход в Чат</h1>
          <p className="text-slate-400 mt-2 text-sm">Введите почту и пароль, чтобы начать</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2 ml-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mail.com"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2 ml-1">Пароль</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
            />
          </div>

          {message && (
            <div className={`py-3 px-4 rounded-xl text-sm border ${
              message.type === 'error' 
                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              {message.text}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Загрузка...
              </span>
            ) : 'Войти / Начать общаться'}
          </button>
        </form>

        <p className="text-center text-slate-500 text-[10px] mt-8 uppercase tracking-widest">
          Secure access via Supabase Auth
        </p>
      </div>
    </div>
  )
}