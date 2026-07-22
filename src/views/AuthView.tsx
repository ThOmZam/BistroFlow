import React, { useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { logAction } from '../lib/logger';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

export default function AuthView({ onOfflineLogin }: { onOfflineLogin?: (role: string) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const loginAs = async (role: string, name?: string) => {
    try {
      localStorage.setItem('demo_role', role);
      if (name) {
        localStorage.setItem('demo_user_name', name);
      } else {
        localStorage.removeItem('demo_user_name');
      }
      await signInAnonymously(auth);
      await logAction('auth', name || 'Cliente', 'Inició sesión', `Rol: ${role.toUpperCase()}`);
    } catch (err: any) {
      console.warn("Firebase Auth bypassed");
      if (onOfflineLogin) {
        onOfflineLogin(role);
      } else {
        if (err.code === 'auth/operation-not-allowed') {
          setError('⚠️ ERROR: Debes habilitar "Anónimo" en Firebase Console -> Authentication -> Sign-in method');
        } else {
          setError('Error al iniciar sesión con Firebase.');
        }
        setPin('');
      }
    }
  };

  const handleSubmit = async () => {
    setError('');
    
    // Check custom employees from Firestore
    try {
      const q = query(collection(db, 'employees'), where('pin', '==', pin));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const employeeDoc = snap.docs[0];
        const employee = employeeDoc.data();
        if (employee.status === 'inactive') {
          setError('Usuario inactivo en nómina.');
          setPin('');
          return;
        }
        localStorage.setItem('demo_employee_id', employeeDoc.id);
        // Save name and login
        loginAs(employee.role, employee.name);
        return;
      }
    } catch (err) {
      console.error('Error checking employees collection:', err);
    }

    // Default hardcoded pins fallback
    let role: string | null = null;
    let name: string | undefined = undefined;
    let fallbackId: string = 'fallback-admin';
    if (pin === '1111') {
      role = 'admin';
      name = 'Admin';
      fallbackId = 'fallback-admin';
    } else if (pin === '2222') {
      role = 'waiter';
      name = 'Mesero';
      fallbackId = 'fallback-waiter';
    } else if (pin === '3333') {
      role = 'cook';
      name = 'Cocina';
      fallbackId = 'fallback-cook';
    } else if (pin === '4444') {
      role = 'finance';
      name = 'Caja';
      fallbackId = 'fallback-finance';
    }

    if (role) {
      localStorage.setItem('demo_employee_id', fallbackId);
      loginAs(role, name);
    } else {
      setError('PIN no válido.');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F8F9FA] flex flex-col items-center justify-center font-sans p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm p-8 bg-white rounded-[40px] shadow-2xl shadow-black/5 border border-slate-100 mb-6"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-black rounded-[24px] mx-auto flex items-center justify-center mb-4">
            <div className="w-8 h-8 border-4 border-white rounded-xl" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">BistroFlow</h2>
          <p className="text-slate-400 text-sm mt-1">Ingresa PIN de Empleado</p>
        </div>

        <div className="flex justify-center gap-4 mb-10">
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i}
              className={`w-4 h-4 rounded-full border-2 border-black transition-all ${
                pin.length > i ? 'bg-black' : 'bg-transparent'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-500 text-[11px] p-3 rounded-xl text-center mb-6 font-bold uppercase tracking-wider border border-rose-100">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num)}
              className="h-14 w-full text-2xl font-medium rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              {num}
            </button>
          ))}
          <button 
            onClick={handleDelete}
            className="h-14 w-full text-sm font-medium rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-400 uppercase tracking-wider text-[10px] font-bold"
          >
            Borrar
          </button>
          <button
            onClick={() => handleNumberClick('0')}
            className="h-14 w-full text-2xl font-medium rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={pin.length < 4}
            className={`h-14 w-full text-[10px] uppercase tracking-widest font-bold rounded-2xl flex items-center justify-center transition-all ${
              pin.length === 4 ? 'bg-black text-white shadow-lg shadow-black/10' : 'bg-slate-50 text-slate-300 cursor-not-allowed'
            }`}
          >
            OK
          </button>
        </div>
        
        <div className="mt-8 text-center text-xs text-slate-400 font-mono flex flex-col gap-1">
          <span>Admin: 1111</span>
          <span>Mesero: 2222</span>
          <span>Cocina: 3333</span>
          <span>Caja: 4444</span>
        </div>
      </motion.div>

      <motion.button 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        onClick={() => loginAs('client')}
        className="w-full max-w-sm bg-black text-white p-5 rounded-2xl font-bold flex items-center justify-between shadow-xl shadow-black/10 hover:scale-[1.02] transition-transform"
      >
        <span className="flex flex-col text-left">
          <span className="text-xs text-slate-400 uppercase tracking-widest">¿Eres Cliente?</span>
          <span className="text-lg">Pedir Delivery</span>
        </span>
        <ArrowRight className="opacity-50" />
      </motion.button>
    </div>
  );
}
