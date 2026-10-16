import React, { useState } from 'react';
import { 
  Printer, 
  Copy, 
  Check, 
  MessageCircle, 
  X, 
  Share2
} from 'lucide-react';

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  note?: string;
  image?: string;
}

export interface ThermalReceiptData {
  id: string;
  timestamp: string | number;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  deliveryType?: 'delivery' | 'pickup' | 'dinein' | string;
  deliveryZoneName?: string;
  deliveryFee?: number;
  deliveryReference?: string;
  whatsappLocation?: string;
  waiterName?: string;
  tableName?: string;
  items: ReceiptItem[];
  subtotalAmount?: number;
  discountAmount?: number;
  taxAmount?: number;
  taxRate?: number;
  isFiscal?: boolean;
  fiscalInvoice?: string;
  serviceChargeAmount?: number;
  totalAmount: number;
  paymentMethod?: string;
  paymentReference?: string;
  concept?: string;
  category?: string;
  note?: string;
}

interface ThermalReceiptTicketProps {
  data: ThermalReceiptData;
  settings?: {
    restaurantName?: string;
    slogan?: string;
    logoUrl?: string;
    rif?: string;
    restaurantPhone?: string;
    whatsappPhone?: string;
    restaurantAddress?: string;
  };
  exchangeRate?: number;
  onClose?: () => void;
  showActions?: boolean;
}

export default function ThermalReceiptTicket({
  data,
  settings,
  exchangeRate = 40,
  onClose,
  showActions = true
}: ThermalReceiptTicketProps) {
  const [copied, setCopied] = useState(false);

  const restName = settings?.restaurantName || "Q' Sandwich";
  const slogan = settings?.slogan || "Menú Digital & POS";
  const rif = settings?.rif || "J-12345678-9";
  const phone = settings?.restaurantPhone || settings?.whatsappPhone || "+58 412 123 4567";
  const address = settings?.restaurantAddress || "";

  // Format date
  const formattedDate = typeof data.timestamp === 'number'
    ? new Date(data.timestamp).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })
    : data.timestamp || new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });

  // Order Code / Clean ID
  const rawId = data.id.startsWith('#') ? data.id.slice(1) : data.id;
  const orderCode = `#OP_${rawId.slice(-5).toUpperCase()}`;

  // Calculated totals
  const subtotal = data.subtotalAmount ?? data.items.reduce((acc, it) => acc + (it.price * it.qty), 0);
  const totalUsd = data.totalAmount ?? subtotal + (data.deliveryFee || 0) + (data.taxAmount || 0);
  const totalBs = totalUsd * exchangeRate;

  // Payment method label
  const getPaymentLabel = (method?: string) => {
    if (!method) return 'PUNTO DE VENTA';
    const m = method.toLowerCase();
    if (m.includes('pagomovil') || m.includes('pago móvil')) return 'PAGO MÓVIL';
    if (m.includes('zelle')) return 'ZELLE';
    if (m.includes('punto') || m.includes('card') || m.includes('tarjeta')) return 'TARJETA DE DÉBITO/CRÉDITO';
    if (m.includes('cash') || m.includes('efectivo')) return 'EFECTIVO ($ USD)';
    return method.toUpperCase();
  };

  // Delivery type label
  const getDeliveryLabel = (type?: string) => {
    if (!type) return 'CONSUMO PRESENCIAL';
    if (type === 'delivery') return 'DELIVERY EXPRESS';
    if (type === 'dinein') return 'CONSUMO EN MESA';
    if (type === 'pickup') return 'RETIRO EN TIENDA';
    return type.toUpperCase();
  };

  // WhatsApp share
  const handleWhatsAppShare = () => {
    const targetPhone = settings?.whatsappPhone || phone;
    const cleanPhone = targetPhone.replace(/[^0-9]/g, '');

    const itemsSummary = data.items
      .map(it => `• *${it.qty}x* ${it.name} - $${(it.price * it.qty).toFixed(2)}`)
      .join('\n');

    const msg = 
      `🧾 *COMPROBANTE DE COMPRA - ${orderCode}*\n` +
      `*${restName.toUpperCase()}*\n` +
      `RIF: ${rif}\n` +
      `------------------------------------\n` +
      `*Fecha:* ${formattedDate}\n` +
      (data.customerName ? `*Cliente:* ${data.customerName}\n` : '') +
      `*Servicio:* ${getDeliveryLabel(data.deliveryType)}\n` +
      `------------------------------------\n` +
      `*PRODUCTOS:*\n${itemsSummary}\n` +
      `------------------------------------\n` +
      `*TOTAL A PAGAR:* *$${totalUsd.toFixed(2)} USD* (Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})\n` +
      `*Método:* ${getPaymentLabel(data.paymentMethod)}` +
      (data.paymentReference ? ` (Ref: ${data.paymentReference})` : '') +
      `\n\n¡Gracias por su compra!`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Copy helper
  const handleCopySummary = async () => {
    const itemsSummary = data.items
      .map(it => `${it.qty}x ${it.name} - $${(it.price * it.qty).toFixed(2)}`)
      .join('\n');

    const summaryText = 
      `COMPROBANTE DE COMPRA ${orderCode}\n` +
      `${restName.toUpperCase()}\n` +
      `RIF: ${rif}\n` +
      `FECHA: ${formattedDate}\n` +
      `CLIENTE: ${data.customerName || 'Consumidor Final'}\n` +
      `--------------------------------\n` +
      `${itemsSummary}\n` +
      `--------------------------------\n` +
      `TOTAL: $${totalUsd.toFixed(2)} USD (Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})\n` +
      `MÉTODO: ${getPaymentLabel(data.paymentMethod)}\n` +
      (data.paymentReference ? `REFERENCIA: ${data.paymentReference}\n` : '');

    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  // Print helper
  const handlePrint = () => {
    const printContent = document.getElementById(`thermal-receipt-printable-${data.id}`);
    if (!printContent) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ticket ${orderCode} - ${restName}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 78mm; 
              margin: 0 auto; 
              padding: 10px; 
              color: #000;
              background: #fff;
              font-size: 12px;
              line-height: 1.3;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .flex-between { display: flex; justify-content: space-between; align-items: center; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 300);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="w-full max-w-sm mx-auto select-text font-sans">
      
      {/* FLOATING ACTION TOOLBAR */}
      {showActions && (
        <div className="mb-3 flex items-center justify-between gap-2 bg-slate-900/90 text-white p-2.5 rounded-2xl backdrop-blur-md shadow-xl border border-slate-800">
          <div className="flex items-center gap-1.5 pl-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-200">{orderCode}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleWhatsAppShare}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
              title="Compartir por WhatsApp"
            >
              <MessageCircle size={14} />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              onClick={handleCopySummary}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
              title="Copiar texto"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? '¡Listo!' : 'Copiar'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-blue-600/30 active:scale-95"
              title="Imprimir o guardar PDF"
            >
              <Printer size={14} />
              <span>Imprimir</span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
                title="Cerrar ticket"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* THERMAL TICKET PAPER BODY */}
      <div 
        id={`thermal-receipt-printable-${data.id}`}
        className="bg-white text-slate-900 p-6 sm:p-7 rounded-2xl shadow-2xl border border-slate-200/90 relative overflow-hidden font-mono text-xs leading-relaxed"
        style={{
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)'
        }}
      >
        
        {/* TOP ZIGZAG DECORATIVE TEAR LINE */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200" />

        {/* 1. RESTAURANT BRANDING HEADER */}
        <div className="text-center space-y-1 pb-3">
          {settings?.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt={restName} 
              className="w-16 h-16 rounded-full object-cover mx-auto mb-2 border border-slate-200 shadow-2xs"
            />
          ) : null}

          <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase font-sans">
            {restName}
          </h2>

          {slogan && (
            <p className="text-[10px] text-slate-500 font-sans italic font-medium">
              "{slogan}"
            </p>
          )}

          {rif && (
            <p className="text-[11px] text-slate-700 font-bold tracking-wider">
              RIF: {rif}
            </p>
          )}

          {phone && (
            <p className="text-[10px] text-slate-500">
              Telf: {phone}
            </p>
          )}

          {address && (
            <p className="text-[10px] text-slate-500 max-w-[220px] mx-auto leading-tight">
              {address}
            </p>
          )}
        </div>

        {/* DASHED DIVIDER */}
        <div className="border-t-2 border-dashed border-slate-300 my-3" />

        {/* 2. TICKET METADATA */}
        <div className="space-y-1 text-[11px] text-slate-800">
          <div className="flex justify-between items-center font-bold font-sans">
            <span className="uppercase text-slate-500 text-[10px]">COMPROBANTE DE COMPRA</span>
            <span className="text-blue-600">{orderCode}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-slate-500">FECHA:</span>
            <span className="font-semibold">{formattedDate}</span>
          </div>

          {data.customerName && (
            <div className="flex justify-between">
              <span className="text-slate-500">CLIENTE:</span>
              <span className="font-bold text-slate-900 uppercase">{data.customerName}</span>
            </div>
          )}

          {data.customerPhone && (
            <div className="flex justify-between">
              <span className="text-slate-500">TELÉFONO:</span>
              <span>{data.customerPhone}</span>
            </div>
          )}

          {data.waiterName && (
            <div className="flex justify-between">
              <span className="text-slate-500">MESERO:</span>
              <span>{data.waiterName}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-slate-500">SERVICIO:</span>
            <span className="font-bold text-slate-900">{getDeliveryLabel(data.deliveryType)}</span>
          </div>

          {data.customerAddress && (
            <div className="pt-1 text-[10px] text-slate-600">
              <span className="text-slate-500 block">DIRECCIÓN DE ENTREGA:</span>
              <span className="font-medium italic leading-tight">{data.customerAddress}</span>
            </div>
          )}
        </div>

        {/* DASHED DIVIDER */}
        <div className="border-t-2 border-dashed border-slate-300 my-3" />

        {/* 3. ITEM TABLE */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase pb-1 border-b border-slate-200">
            <span>CANT / DESCRIPCIÓN</span>
            <span>TOTAL</span>
          </div>

          <div className="space-y-2 pt-1">
            {data.items.map((it, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between items-start gap-2 text-xs">
                  <span className="font-bold text-slate-900 flex-1 leading-tight">
                    {it.qty}x {it.name}
                  </span>
                  <span className="font-bold text-slate-900 shrink-0">
                    ${(it.price * it.qty).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-[10px] text-slate-500 pl-4">
                  <span>Precio Un.: ${it.price.toFixed(2)}</span>
                </div>

                {it.note && (
                  <p className="text-[10px] text-amber-700 italic pl-4 font-sans">
                    * {it.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* DASHED DIVIDER */}
        <div className="border-t-2 border-dashed border-slate-300 my-3" />

        {/* 4. TOTALS & CURRENCY CONVERSION */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal Productos:</span>
            <span className="font-semibold">${subtotal.toFixed(2)} USD</span>
          </div>

          {data.deliveryFee ? (
            <div className="flex justify-between text-slate-600">
              <span>Costo Envío / Delivery:</span>
              <span className="font-semibold">+${data.deliveryFee.toFixed(2)} USD</span>
            </div>
          ) : null}

          {data.taxAmount ? (
            <div className="flex justify-between text-slate-600">
              <span>Impuesto IVA ({data.taxRate || 16}%):</span>
              <span className="font-semibold">+${data.taxAmount.toFixed(2)} USD</span>
            </div>
          ) : (
            <div className="flex justify-between text-[10px] text-slate-500 italic">
              <span>Condición Fiscal:</span>
              <span>Venta Exenta de IVA</span>
            </div>
          )}

          {/* TOTAL IN USD */}
          <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-sans">
            <span className="font-extrabold text-slate-900 text-sm">
              TOTAL A PAGAR:
            </span>
            <span className="font-black text-lg text-blue-600">
              ${totalUsd.toFixed(2)} USD
            </span>
          </div>

          {/* CONVERSION IN BOLÍVARES (BS) */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1 mt-1 font-sans">
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>Tasa Oficial BCV:</span>
              <span className="font-bold text-slate-800">Bs. {exchangeRate.toFixed(2)} / $</span>
            </div>
            <div className="flex justify-between items-baseline pt-1 border-t border-slate-200">
              <span className="font-bold text-slate-900 text-xs">TOTAL EN BOLÍVARES:</span>
              <span className="font-extrabold text-sm text-slate-900">
                Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* DASHED DIVIDER */}
        <div className="border-t-2 border-dashed border-slate-300 my-3" />

        {/* 5. PAYMENT METHOD & REFERENCE */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">MÉTODO DE PAGO:</span>
            <span className="font-bold text-slate-900">{getPaymentLabel(data.paymentMethod)}</span>
          </div>

          {data.paymentReference && (
            <div className="flex justify-between">
              <span className="text-slate-500">N° REFERENCIA:</span>
              <span className="font-bold font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                {data.paymentReference}
              </span>
            </div>
          )}

          {(data.note || data.concept) && (
            <div className="pt-1.5 text-[10px] text-slate-600 font-sans italic">
              <span className="font-bold text-slate-500 not-italic block uppercase text-[9px]">
                Concepto / Nota:
              </span>
              "{data.note || data.concept}"
            </div>
          )}
        </div>

        {/* DASHED DIVIDER */}
        <div className="border-t-2 border-dashed border-slate-300 my-4" />

        {/* 6. TICKET FOOTER & BARCODE */}
        <div className="text-center space-y-2 pt-1 font-sans">
          <p className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
            ¡Gracias por su preferencia!
          </p>
          <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto leading-tight">
            Conserve este ticket como comprobante digital oficial de compra.
          </p>

          {/* SIMULATED BARCODE */}
          <div className="pt-2 flex flex-col items-center justify-center opacity-80">
            <div className="h-9 w-48 bg-[repeating-linear-gradient(90deg,#000_0px,#000_2px,transparent_2px,transparent_4px,#000_4px,#000_7px,transparent_7px,transparent_9px)]" />
            <span className="text-[9px] font-mono tracking-widest text-slate-500 mt-1">
              *OP-{data.id.slice(-6).toUpperCase()}*
            </span>
          </div>
        </div>

        {/* BOTTOM ZIGZAG DECORATIVE TEAR LINE */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200" />

      </div>
    </div>
  );
}
