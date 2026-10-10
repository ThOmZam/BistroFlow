import React, { useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { ArrowRight, ShieldCheck, Lock, Mail, KeyRound, Eye, EyeOff } from 'lucide-react';

export default function AuthView({ onOfflineLogin }: { onOfflineLogin?: (role: string) => void }) {
  const [authMode, setAuthMode] = useState<'credentials' | 'pin'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [lockoutInfo, setLockoutInfo] = useState<{ isLocked: boolean; remainingMinutes?: number } | null>(null);

  const handleNumberClick = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const loginWithServer = async (type: 'credentials' | 'pin') => {
    setError('');
    setIsLoading(true);

    try {
      const payload: any = { type };
      if (type === 'credentials') {
        if (!email.trim() || !password) {
          setError('Ingresa tu correo y contraseña.');
          setIsLoading(false);
          return;
        }
        payload.email = email.trim();
        payload.password = password;
      } else {
        if (!pin || pin.length < 4) {
          setError('Ingresa un PIN de al menos 4 dígitos.');
          setIsLoading(false);
          return;
        }
        payload.pin = pin;
      }

      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.status === 429 || data.isLocked) {
        setLockoutInfo({
          isLocked: true,
          remainingMinutes: data.remainingMinutes || 15
        });
        setError(data.error || 'Acceso bloqueado por seguridad.');
        setIsLoading(false);
        return;
      }

      if (!res.ok || !data.success) {
        setError(data.error || 'Credenciales inválidas.');
        if (typeof data.attemptsRemaining === 'number') {
          setAttemptsRemaining(data.attemptsRemaining);
        }
        if (type === 'pin') setPin('');
        setIsLoading(false);
        return;
      }

      // Success
      const user = data.user;
      localStorage.setItem('demo_role', user.role);
      localStorage.setItem('demo_employee_id', user.employeeId || user.id);
      localStorage.setItem('demo_user_name', user.name);

      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        if (onOfflineLogin) {
          onOfflineLogin(user.role);
        } else {
          localStorage.setItem('demo_fallback_role', user.role);
        }
      }

      window.location.reload();
    } catch (err: any) {
      console.error('Auth error:', err);
      setError('Error al conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsClient = () => {
    localStorage.setItem('demo_role', 'client');
    localStorage.removeItem('demo_employee_id');
    localStorage.removeItem('demo_user_name');
    window.location.reload();
  };

  return (
    <div className="min-h-screen w-full bg-[#F8F9FA] flex flex-col items-center justify-center font-sans p-0 sm:p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full sm:max-w-md p-6 sm:p-8 bg-white rounded-none sm:rounded-[36px] shadow-none sm:shadow-2xl shadow-black/5 border-0 sm:border sm:border-slate-100 min-h-[100dvh] sm:min-h-0 flex flex-col justify-between sm:justify-start"
      >
        <div>
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-md">
              <ShieldCheck size={28} className="text-emerald-400" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 inline-block mb-1">
              Sistema RestoFlow
            </span>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Acceso de Personal</h2>
            <p className="text-slate-400 text-xs mt-0.5">Autenticación segura para colaboradores y administración</p>
          </div>

        {/* Lockout Warning */}
        {lockoutInfo?.isLocked && (
          <div className="bg-rose-50 text-rose-700 text-xs p-4 rounded-2xl text-center mb-5 font-bold border border-rose-200">
            <div className="flex items-center justify-center gap-1.5 text-rose-800 mb-1">
              <Lock size={15} />
              <span>Acceso Temporalmente Bloqueado</span>
            </div>
            <p className="text-[11px] font-medium text-rose-600">
              Se detectaron 5 intentos fallidos. Bloqueo activo durante {lockoutInfo.remainingMinutes || 15} min.
            </p>
          </div>
        )}

        {/* Mode Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-5 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setAuthMode('credentials');
              setError('');
            }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              authMode === 'credentials'
                ? 'bg-white text-black shadow-xs font-black'
                : 'text-slate-500 hover:text-black'
            }`}
          >
            <Mail size={13} />
            <span>Correo y Clave</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('pin');
              setError('');
            }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              authMode === 'pin'
                ? 'bg-white text-black shadow-xs font-black'
                : 'text-slate-500 hover:text-black'
            }`}
          >
            <KeyRound size={13} />
            <span>PIN de Turno</span>
          </button>
        </div>

        {error && !lockoutInfo?.isLocked && (
          <div className="bg-rose-50 text-rose-600 text-[11px] p-3 rounded-xl text-center mb-5 font-bold border border-rose-100">
            {error}
          </div>
        )}

        {/* Tab 1: Form Correo y Clave */}
        {authMode === 'credentials' ? (
          <form onSubmit={(e) => { e.preventDefault(); loginWithServer('credentials'); }} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-3 text-slate-400" />
                <input 
                  type="email"
                  required
                  disabled={isLoading || lockoutInfo?.isLocked}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@bistroflow.com"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black focus:bg-white transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Contraseña / Clave
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-3 text-slate-400" />
                <input 
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isLoading || lockoutInfo?.isLocked}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black focus:bg-white transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-black cursor-pointer"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || lockoutInfo?.isLocked || !email || !password}
              className="w-full mt-2 py-3 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>Ingresar al Sistema</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* Tab 2: PIN de Turno */
          <div>
            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map((i) => (
                <div 
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 border-black transition-all ${
                    pin.length > i ? 'bg-black scale-110 shadow-sm' : 'bg-transparent'
                  }`}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={isLoading || lockoutInfo?.isLocked}
                  onClick={() => handleNumberClick(num)}
                  className="h-12 w-full text-xl font-bold rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
                >
                  {num}
                </button>
              ))}
              <button 
                type="button"
                disabled={isLoading || lockoutInfo?.isLocked}
                onClick={handleDelete}
                className="h-12 w-full text-[10px] font-bold rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-all text-slate-400 uppercase tracking-widest cursor-pointer disabled:opacity-40"
              >
                Borrar
              </button>
              <button
                type="button"
                disabled={isLoading || lockoutInfo?.isLocked}
                onClick={() => handleNumberClick('0')}
                className="h-12 w-full text-xl font-bold rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
              >
                0
              </button>
              <button
                type="button"
                disabled={pin.length < 4 || isLoading || lockoutInfo?.isLocked}
                onClick={() => loginWithServer('pin')}
                className={`h-12 w-full text-[11px] uppercase tracking-widest font-black rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                  pin.length >= 4 && !isLoading && !lockoutInfo?.isLocked
                    ? 'bg-black text-white shadow-md' 
                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Entrar'
                )}
              </button>
            </div>
          </div>
        )}

        {attemptsRemaining !== null && !lockoutInfo?.isLocked && (
          <div className="mt-4 text-center text-[10px] text-slate-400 font-mono">
            Protección de fuerza bruta: {attemptsRemaining} intentos restantes
          </div>
        )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100">
          <button 
            type="button"
            onClick={loginAsClient}
            className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 p-3.5 rounded-2xl font-bold flex items-center justify-between transition-all cursor-pointer"
          >
            <span className="flex flex-col text-left">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Portal Público</span>
              <span className="text-xs font-black">¿Eres Cliente? Pedir Delivery o Ver Menú</span>
            </span>
            <ArrowRight size={16} className="text-slate-400" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
