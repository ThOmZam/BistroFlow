import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share2, Copy, Check, MessageCircle, ExternalLink, Sparkles, Send } from 'lucide-react';
import { MenuItem } from '../types';
import { useCurrency } from '../context/CurrencyContext';

interface ShareDishModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  restaurantName?: string;
  slogan?: string;
  logoUrl?: string;
}

export default function ShareDishModal({
  item,
  isOpen,
  onClose,
  restaurantName = "Q' Sandwich",
  slogan = "Menú Digital & Pedidos",
  logoUrl
}: ShareDishModalProps) {
  const [copied, setCopied] = useState(false);
  const { activeCurrency, currentRateBs, formatPrice, formatBs, toBolivares } = useCurrency();

  if (!isOpen || !item) return null;

  // Generate direct dish link with query param ?dish=ITEM_ID
  const baseUrl = window.location.origin + window.location.pathname;
  const shareUrl = `${baseUrl}?dish=${item.id}`;

  const priceFormatted = formatPrice(item.price);
  const priceBsFormatted = formatBs(toBolivares(item.price));

  const shareTitle = `${item.name} - ${priceFormatted} (${priceBsFormatted})`;
  const shareMessage = `🔥 ¡Mira este delicioso plato en *${restaurantName}*!\n\n` +
    `🍔 *${item.name}*\n` +
    `💰 *Precio:* ${priceFormatted} / ${priceBsFormatted}\n` +
    (item.description ? `📝 ${item.description}\n` : '') +
    `\n👇 Haz tu pedido directo aquí:\n${shareUrl}`;

  // Direct Social Share URLs
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`¡Mira este delicioso plato en ${restaurantName}! ${item.name} - ${priceFormatted}`)}&url=${encodeURIComponent(shareUrl)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      // Fallback copy
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `¡Mira ${item.name} en ${restaurantName}!`,
          url: shareUrl,
        });
      } catch (err) {
        console.log('Share canceled', err);
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          className="bg-white dark:bg-[#121826] rounded-[28px] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden relative"
        >
          {/* Header */}
          <div className="p-5 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Share2 size={16} />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">Compartir Plato</h3>
                <p className="text-[11px] text-slate-400 font-medium">Tarjeta OpenGraph & RRSS</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Live OpenGraph Preview Card */}
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-2">
                Vista previa de la Tarjeta (OpenGraph OP)
              </span>
              <div className="bg-slate-50 dark:bg-[#1b2438] border border-slate-200/80 dark:border-slate-700/80 rounded-2xl overflow-hidden shadow-xs transition-all">
                {item.image ? (
                  <div className="h-40 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 right-2.5 bg-black/75 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-xs font-black shadow-md">
                      {priceFormatted}
                    </div>
                  </div>
                ) : (
                  <div className="h-28 bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center p-4 text-center relative">
                    <div className="font-black text-lg">{item.name}</div>
                    <div className="absolute top-2 right-2 bg-white/20 text-white px-2.5 py-1 rounded-full text-xs font-black">
                      {priceFormatted}
                    </div>
                  </div>
                )}
                <div className="p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    <span>{restaurantName}</span>
                    <span>•</span>
                    <span>{priceBsFormatted}</span>
                  </div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-white line-clamp-1">
                    {item.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {item.description || slogan || 'Descubre este plato en nuestro menú digital.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Share Options */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                Compartir directo en Redes Sociales
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                {/* WhatsApp */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
                >
                  <MessageCircle size={16} />
                  <span>WhatsApp</span>
                </a>

                {/* X / Twitter */}
                <a
                  href={twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-2xl bg-black hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
                >
                  <Send size={15} />
                  <span>X (Twitter)</span>
                </a>

                {/* Facebook */}
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
                >
                  <span className="font-serif font-black text-sm leading-none">f</span>
                  <span>Facebook</span>
                </a>

                {/* Native / Copy */}
                {typeof navigator !== 'undefined' && 'share' in navigator ? (
                  <button
                    onClick={handleNativeShare}
                    className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
                  >
                    <Share2 size={15} />
                    <span>Compartir...</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCopyLink}
                    className={`p-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer ${
                      copied 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-slate-800 hover:bg-slate-900 text-white'
                    }`}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copied ? '¡Copiado!' : 'Copiar Link'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Direct Link Input */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl p-1.5 pl-3">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="bg-transparent border-0 outline-none text-xs text-slate-600 dark:text-slate-300 font-mono w-full select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                    copied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs hover:bg-slate-50'
                  }`}
                >
                  {copied ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
