'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase' 
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

    // 1. Пытаемся войти
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (!signInError) {
      router.push('/')
      router.refresh()
      return
    }

    // 2. Если войти не удалось (неверный пароль или юзера нет)
    if (signInError.message.includes("Invalid login credentials")) {
      
      // Пробуем создать новый аккаунт
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
        // Если база говорит, что юзер ЕСТЬ, значит в 1-м шаге был просто неверный пароль
        if (signUpError.message.includes("User already registered")) {
          setMessage({ type: 'error', text: 'Этот email занят. Неверный пароль?' })
        } else {
          setMessage({ type: 'error', text: signUpError.message })
        }
      } else {
        // Успешная регистрация
        if (signUpData.session) {
          router.push('/')
          router.refresh()
        } else {
          setMessage({ type: 'success', text: 'Аккаунт создан! Можно входить.' })
        }
      }
    } else {
      setMessage({ type: 'error', text: signInError.message })
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4 relative overflow-hidden text-white">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
      <div className="w-full max-w-md bg-slate-800/40 backdrop-blur-2xl p-8 rounded-[32px] border border-white/10 shadow-2xl z-10">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl rotate-12 flex items-center justify-center text-3xl shadow-xl mx-auto mb-6">
            <span className="-rotate-12">🚀</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Вход в Чат</h1>
          <p className="text-slate-400 mt-2 text-sm text-balance">Введите данные, чтобы войти или зарегистрироваться</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2 ml-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
              placeholder="student@gmail.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2 ml-1">Пароль</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {message && (
            <div className={`py-3 px-4 rounded-xl text-sm border ${
              message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              {message.text}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 mt-4"
          >
            {loading ? 'Секунду...' : 'Войти / Начать'}
          </button>
        </form>
      </div>
    </div>
  )
}