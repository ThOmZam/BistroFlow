import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Keyboard, 
  Search, 
  Bell, 
  Star, 
  LayoutDashboard, 
  CreditCard, 
  UtensilsCrossed, 
  Flame, 
  TrendingUp, 
  Package, 
  Users, 
  UserCheck, 
  Settings,
  CornerDownLeft,
  ArrowUpDown,
  Clock
} from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewChange?: (view: string) => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose, onViewChange }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const sections = [
    {
      title: 'Búsqueda y Sistema Global',
      color: 'border-amber-500 text-amber-600 bg-amber-50',
      shortcuts: [
        { keys: ['Ctrl', 'K'], label: 'Abrir Buscador Global (Omni-Search)' },
        { keys: ['?'], label: 'Abrir esta Guía de Atajos' },
        { keys: ['Esc'], label: 'Cerrar Buscador, Modales o Paneles' },
      ]
    },
    {
      title: 'Navegación Rápida a Módulos',
      color: 'border-blue-500 text-blue-600 bg-blue-50',
      shortcuts: [
        { keys: ['Alt', '1'], label: 'Ir a Dashboard Principal' },
        { keys: ['Alt', '2'], label: 'Ir a Caja & Punto de Venta (POS)' },
        { keys: ['Alt', '3'], label: 'Ir a Mesero & Salón de Mesas' },
        { keys: ['Alt', '4'], label: 'Ir a Cocina (KDS Pantalla)' },
        { keys: ['Alt', '5'], label: 'Ir a Finanzas (CxC, CxP, P&L)' },
        { keys: ['Alt', '6'], label: 'Ir a Inventario & Insumos' },
        { keys: ['Alt', '7'], label: 'Ir a CRM Clientes & Deudas' },
        { keys: ['Alt', '8'], label: 'Ir a Personal & Asistencia' },
        { keys: ['Alt', '9'], label: 'Ir a Ajustes del Sistema' },
      ]
    },
    {
      title: 'Centro de Control & Monitoreo',
      color: 'border-emerald-500 text-emerald-600 bg-emerald-50',
      shortcuts: [
        { keys: ['Ctrl', 'Shift', 'A'], label: 'Abrir Panel de Notificaciones' },
        { keys: ['Ctrl', 'Shift', 'C'], label: 'Abrir Panel de Casos y Favoritos' },
        { keys: ['Ctrl', 'M'], label: 'Fichaje de Asistencia (Mi Turno)' },
      ]
    },
    {
      title: 'Navegación dentro de Listas y Buscador',
      color: 'border-purple-500 text-purple-600 bg-purple-50',
      shortcuts: [
        { keys: ['↑', '↓'], label: 'Mover selección arriba/abajo' },
        { keys: ['Enter'], label: 'Confirmar y abrir elemento seleccionado' },
      ]
    }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 bg-slate-900 text-white flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
                <Keyboard size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  Atajos de Teclado del Sistema
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    Productividad Express
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Navega y opera BistroPOS a la velocidad de la luz sin levantar las manos del teclado.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors relative z-10"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sections.map((section, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full border-2 ${section.color}`} />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      {section.title}
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    {section.shortcuts.map((sc, sIdx) => (
                      <div 
                        key={sIdx} 
                        className="flex items-center justify-between text-xs py-1 px-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-slate-600 font-medium">
                          {sc.label}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {sc.keys.map((k, kIdx) => (
                            <React.Fragment key={kIdx}>
                              <kbd className="px-2 py-1 bg-slate-100 border border-slate-300 rounded-md font-mono font-bold text-[11px] text-slate-800 shadow-2xs">
                                {k}
                              </kbd>
                              {kIdx < sc.keys.length - 1 && (
                                <span className="text-slate-400 font-bold text-[10px]">+</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Presiona <kbd className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 font-bold">Esc</kbd> en cualquier momento para cerrar.</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors text-xs"
            >
              Entendido
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
