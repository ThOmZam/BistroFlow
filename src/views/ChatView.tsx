import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Send, 
  Users, 
  MessageSquare, 
  Flame, 
  Receipt, 
  Smartphone, 
  ShieldCheck,
  Clock,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';

export default function ChatView({ currentUser }: { currentUser: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested quick messages based on role/area to save time in a fast-paced kitchen/dining environment
  const quickReplies = [
    '¡Pedido listo para entregar!',
    'Favor validar pago en caja.',
    'Mesa solicita asistencia inmediata.',
    'Se requiere cambio de efectivo en caja.',
    'Ingredientes de hamburguesa con bajo stock.',
    '¿Cómo va el pedido de la Mesa 5?',
    'Entendido, copiado.'
  ];

  useEffect(() => {
    // Limit to last 100 messages for speed
    const q = query(collection(db, 'chats'), orderBy('timestamp', 'asc'), limit(100));
    
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  // Scroll to bottom whenever messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;
    
    // Map role to visual work area name
    let areaName = 'Administración';
    if (currentUser.role === 'waiter') areaName = 'Mesero / Salón';
    else if (currentUser.role === 'cook') areaName = 'Cocina';
    else if (currentUser.role === 'finance') areaName = 'Caja';

    try {
      await addDoc(collection(db, 'chats'), {
        senderName: currentUser.name || 'Trabajador',
        senderRole: currentUser.role,
        senderArea: areaName,
        text: messageText.trim(),
        timestamp: new Date().toISOString() // Fallback sorting
      });
      setText('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const formatDateHeader = (date: Date) => {
    const now = new Date();
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = todayDay.getTime() - msgDay.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'short'
    });
  };

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return timeStr;

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isYesterday) return `Ayer ${timeStr}`;

    return `${date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} • ${timeStr}`;
  };

  const getAreaIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <ShieldCheck size={14} className="text-amber-500" />;
      case 'cook':
        return <Flame size={14} className="text-rose-500" />;
      case 'finance':
        return <Receipt size={14} className="text-indigo-500" />;
      default:
        return <Smartphone size={14} className="text-sky-500" />;
    }
  };

  const getAreaBg = (role: string, isSelf: boolean) => {
    if (isSelf) return 'bg-black text-white';
    switch (role) {
      case 'admin':
        return 'bg-amber-50 text-amber-900 border-amber-100';
      case 'cook':
        return 'bg-rose-50 text-rose-900 border-rose-100';
      case 'finance':
        return 'bg-indigo-50 text-indigo-900 border-indigo-100';
      default:
        return 'bg-sky-50 text-sky-900 border-sky-100';
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full h-[calc(100dvh-170px)] md:h-[80vh] flex flex-col bg-white rounded-[24px] sm:rounded-[40px] border border-slate-100 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 sm:p-6 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/10 rounded-xl sm:rounded-2xl flex items-center justify-center">
            <MessageSquare size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-black text-sm sm:text-base text-white">Chat Interno del Personal</h3>
            <p className="text-slate-400 text-[10px] sm:text-xs">Canal directo entre áreas</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-white/10 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold font-mono">
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Sincronizado</span>
        </div>
      </div>

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3 sm:space-y-4 bg-slate-50/50">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center max-w-sm mx-auto space-y-2">
            <MessageSquare size={36} className="text-slate-300" />
            <p className="font-bold text-sm text-slate-700">Canal de Chat Vacío</p>
            <p className="text-xs">¡Inicia la conversación! Envía un mensaje o usa una de las respuestas rápidas inferiores.</p>
          </div>
        ) : (
          (() => {
            let lastDateStr = '';
            return messages.map((msg, index) => {
              const isSelf = msg.senderName === currentUser.name && msg.senderRole === currentUser.role;
              const msgDate = msg.timestamp ? new Date(msg.timestamp) : null;
              const hasValidDate = msgDate && !isNaN(msgDate.getTime());
              const dateHeaderStr = hasValidDate ? formatDateHeader(msgDate!) : '';
              const showDateSeparator = hasValidDate && dateHeaderStr && dateHeaderStr !== lastDateStr;
              if (showDateSeparator) {
                lastDateStr = dateHeaderStr;
              }

              const formattedTime = formatMessageTime(msg.timestamp);

              return (
                <React.Fragment key={msg.id || index}>
                  {showDateSeparator && (
                    <div className="flex items-center justify-center my-3">
                      <div className="bg-slate-200/90 text-slate-700 text-[10px] font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs border border-slate-300/60 flex items-center gap-1">
                        <span>📅 {dateHeaderStr}</span>
                      </div>
                    </div>
                  )}

                  <div 
                    className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isSelf ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                  >
                    {/* Meta info block */}
                    <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-slate-400 font-bold mb-1">
                      {!isSelf && getAreaIcon(msg.senderRole)}
                      <span className={`${isSelf ? 'text-slate-600' : 'text-slate-700'}`}>
                        {msg.senderArea} • <strong className="text-slate-900">{msg.senderName}</strong>
                      </span>
                      <Clock size={9} className="ml-0.5 opacity-55" />
                      <span className="text-slate-500 font-mono">{formattedTime}</span>
                    </div>

                    {/* Bubble */}
                    <div className={`p-3 sm:p-4 rounded-[20px] sm:rounded-[24px] border shadow-sm text-xs leading-relaxed flex flex-col gap-1 ${
                      isSelf 
                        ? 'bg-black text-white border-black rounded-tr-none' 
                        : `${getAreaBg(msg.senderRole, false)} rounded-tl-none`
                    }`}>
                      {/* Workspace Origin Indicator */}
                      <div className={`flex items-center gap-1 text-[8px] sm:text-[9px] font-black tracking-widest uppercase pb-1 border-b ${
                        isSelf 
                          ? 'text-indigo-300 border-white/10' 
                          : msg.senderRole === 'cook' ? 'text-rose-600 border-rose-200/50' :
                            msg.senderRole === 'finance' ? 'text-indigo-600 border-indigo-200/50' :
                            msg.senderRole === 'admin' ? 'text-amber-600 border-amber-200/50' :
                            'text-sky-600 border-sky-200/50'
                      }`}>
                        {msg.senderRole === 'cook' ? '🔥 Cocina' :
                         msg.senderRole === 'finance' ? '💵 Caja / Finanzas' :
                         msg.senderRole === 'admin' ? '🛡️ Administración' : '🛎️ Salón / Mesero'}
                      </div>
                      <p className="font-semibold">{msg.text}</p>
                    </div>
                  </div>
                </React.Fragment>
              );
            });
          })()
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies Panel */}
      <div className="px-4 sm:px-6 py-2.5 border-t border-slate-100 bg-white shrink-0 overflow-x-auto whitespace-nowrap flex gap-2 scrollbar-none select-none touch-pan-x -webkit-overflow-scrolling-touch">
        {quickReplies.map((reply, index) => (
          <button
            key={index}
            onClick={() => sendMessage(reply)}
            className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-full text-[10px] sm:text-[11px] font-bold text-slate-700 transition-colors inline-flex items-center gap-1 shrink-0"
          >
            <Sparkles size={11} className="text-amber-500 shrink-0" />
            {reply}
          </button>
        ))}
      </div>

      {/* Message input */}
      <div className="p-3 sm:p-4 border-t border-slate-100 bg-white shrink-0 flex gap-2 sm:gap-3">
        <input 
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              sendMessage(text);
            }
          }}
          placeholder="Escribe un mensaje aquí..."
          className="flex-1 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:border-black rounded-xl sm:rounded-2xl px-3 sm:px-5 text-xs outline-none transition-all placeholder:text-slate-400 font-medium"
        />
        <button 
          onClick={() => sendMessage(text)}
          className="bg-black hover:bg-slate-800 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all hover:scale-[1.03] active:scale-95 shrink-0 shadow-lg shadow-black/10"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
