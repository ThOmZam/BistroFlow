import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, X, Check, Heart, Sparkles, MessageSquare } from 'lucide-react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { playSuccessSound } from '../lib/audio';

import { useRestaurantData } from '../hooks/useRestaurantData';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName?: string;
  customerName?: string;
  orderId?: string;
}

const PRESET_TAGS = [
  '⚡ Servicio Rápido',
  '🍔 Comida Deliciosa',
  '🧹 Limpieza Impecable',
  '🎵 Gran Ambiente',
  '💰 Buen Precio',
  '👨‍🍳 Excelente Presentación'
];

export default function FeedbackModal({ isOpen, onClose, tableName, customerName, orderId }: FeedbackModalProps) {
  const { settings } = useRestaurantData();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>(['🍔 Comida Deliciosa', '⚡ Servicio Rápido']);
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || settings?.feedbackEnabled === false) return null;

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(prev => prev.filter(t => t !== tag));
    } else {
      setSelectedTags(prev => [...prev, tag]);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await addDoc(collection(db, 'feedback'), {
        rating,
        tags: selectedTags,
        comment: comment.trim(),
        tableName: tableName || 'Cliente BistroFlow',
        customerName: customerName || 'Anónimo',
        orderId: orderId || null,
        timestamp: new Date().toISOString()
      });
      playSuccessSound();
      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error saving feedback:', err);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white rounded-[32px] max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative overflow-hidden my-6"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
        >
          <X size={18} />
        </button>

        {isSubmitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md animate-bounce">
              <Heart size={32} className="fill-emerald-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-900">¡Muchas Gracias!</h3>
            <p className="text-xs font-semibold text-slate-500 max-w-xs mx-auto">
              Tu opinión ha sido registrada en el panel gerencial para seguir mejorando nuestro servicio.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 inline-block mb-2">
                Encuesta de Satisfacción Express
              </span>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">¿Cómo estuvo tu experiencia?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Califica nuestro servicio y comida en menos de 10 segundos.
              </p>
            </div>

            {/* Star Rating Bar */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {rating === 5 ? '⭐ ¡Excelente / Espectacular!' :
                 rating === 4 ? '👍 Muy Bueno' :
                 rating === 3 ? '😐 Aceptable' :
                 rating === 2 ? '👎 Regular' : '💔 Mal Servicio'}
              </span>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                    >
                      <Star
                        size={32}
                        className={`transition-colors ${
                          active
                            ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                            : 'text-slate-300 fill-slate-100'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Feedback Tag Pills */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 block">
                Lo más destacado de tu visita:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment Area */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 block">
                Comentario adicional (Opcional):
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Escribe un mensaje directamente para la gerencia de BistroFlow..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-medium outline-none focus:bg-white focus:ring-2 focus:ring-slate-900 resize-none h-20 transition-all"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
              >
                Saltar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="flex-[2] py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Sparkles size={16} className="text-amber-400" />
                <span>Enviar Opinión</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
