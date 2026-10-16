import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Lock, Mail, KeyRound, Eye, EyeOff } from 'lucide-react';
import { loginStaff } from '../lib/authService';

export default function AuthView({ onOfflineLogin }: { onOfflineLogin?: (role: string) => void }) {
  const brandColor = localStorage.getItem('restaurant_brand_color') || '#2563eb';
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
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

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    const cleanPin = pin.trim();

    if (!cleanEmail) {
      setError('Ingresa tu correo electrónico.');
      return;
    }

    if (!cleanPin || cleanPin.length < 4) {
      setError('Ingresa un PIN de al menos 4 dígitos.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await loginStaff(cleanEmail, cleanPin);

      if (res.isLocked) {
        setLockoutInfo({
          isLocked: true,
          remainingMinutes: res.remainingMinutes || 15
        });
        setError(res.error || 'Acceso bloqueado por seguridad.');
        setIsLoading(false);
        return;
      }

      if (!res.success) {
        setError(res.error || 'Credenciales inválidas. Verifica tu correo y PIN.');
        if (typeof res.attemptsRemaining === 'number') {
          setAttemptsRemaining(res.attemptsRemaining);
        }
        setIsLoading(false);
        return;
      }

      // Success
      if (onOfflineLogin && res.user?.role) {
        onOfflineLogin(res.user.role);
      }
      window.dispatchEvent(new Event('storage'));
      window.location.reload();
    } catch (err: any) {
      console.error('Auth error:', err);
      setError('Error al conectar con el servidor de autenticación.');
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsClient = () => {
    localStorage.setItem('demo_role', 'client');
    localStorage.removeItem('demo_employee_id');
    localStorage.removeItem('demo_user_name');
    localStorage.removeItem('demo_user_email');
    localStorage.removeItem('demo_user_pin');
    window.location.reload();
  };

  return (
    <div className="min-h-screen w-full bg-[#F8F9FA] flex flex-col items-center justify-center font-sans p-0 sm:p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full sm:max-w-md p-6 sm:p-8 bg-white rounded-none sm:rounded-[36px] shadow-none sm:shadow-2xl shadow-black/5 border-0 sm:border sm:border-slate-100 min-h-screen sm:min-h-0 flex flex-col justify-between sm:justify-start pb-8 sm:pb-8"
      >
        <div>
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-slate-100 text-slate-800 rounded-2xl mx-auto flex items-center justify-center mb-3 border border-slate-200 shadow-xs">
              <KeyRound size={22} className="text-slate-800" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Iniciar Sesión</h2>
            <p className="text-slate-400 text-xs mt-0.5">Ingresa tu correo y PIN para acceder</p>
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

          {error && !lockoutInfo?.isLocked && (
            <div className="bg-rose-50 text-rose-600 text-[11px] p-3 rounded-xl text-center mb-4 font-bold border border-rose-100 animate-shake">
              {error}
            </div>
          )}

          {/* Form Correo y PIN */}
          <form onSubmit={handleLogin} className="space-y-3.5">
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
                  placeholder="ej: usuario@restaurante.com"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-black focus:bg-white transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-600">
                  PIN de Acceso
                </label>
                <span className="text-[10px] text-slate-400 font-medium">4 a 6 dígitos</span>
              </div>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3.5 top-3 text-slate-400" />
                <input 
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  disabled={isLoading || lockoutInfo?.isLocked}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold tracking-widest focus:outline-none focus:border-black focus:bg-white transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-black cursor-pointer"
                >
                  {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Quick numeric pad */}
            <div className="pt-1">
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    disabled={isLoading || lockoutInfo?.isLocked}
                    onClick={() => handleNumberClick(num)}
                    className="h-10 w-full text-base font-bold rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer text-slate-800 disabled:opacity-40"
                  >
                    {num}
                  </button>
                ))}
                <button 
                  type="button"
                  disabled={isLoading || lockoutInfo?.isLocked}
                  onClick={handleDelete}
                  className="h-10 w-full text-[10px] font-bold rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-all text-slate-400 uppercase tracking-wider cursor-pointer disabled:opacity-40"
                >
                  Borrar
                </button>
                <button
                  type="button"
                  disabled={isLoading || lockoutInfo?.isLocked}
                  onClick={() => handleNumberClick('0')}
                  className="h-10 w-full text-base font-bold rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer text-slate-800 disabled:opacity-40"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={isLoading || lockoutInfo?.isLocked}
                  onClick={() => setPin('')}
                  className="h-10 w-full text-[10px] font-bold rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-all text-slate-400 uppercase tracking-wider cursor-pointer disabled:opacity-40"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || lockoutInfo?.isLocked || !email.trim() || pin.length < 4}
              style={{ backgroundColor: brandColor, color: '#ffffff' }}
              className="w-full mt-2 py-3 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:scale-[1.01] active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verificando Credenciales...</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Ingresar al Sistema</span>
                </>
              )}
            </button>
          </form>

          {attemptsRemaining !== null && !lockoutInfo?.isLocked && (
            <div className="mt-4 text-center text-[10px] text-slate-400 font-mono">
              Protección anti-fuerza bruta: {attemptsRemaining} intentos restantes
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
