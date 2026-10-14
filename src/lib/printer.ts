export interface KitchenTicketItem {
  itemName: string;
  quantity: number;
  note?: string;
  course?: string;
  seatNumber?: number;
  excludedIngredients?: string[];
  extras?: Array<{ name: string; price?: number }>;
}

export interface KitchenTicketData {
  tableName: string; // e.g., "Mesa 02" or "Llevar - Juan"
  waiterName: string;
  orderNumber?: string | number;
  timestamp?: string;
  items: KitchenTicketItem[];
  paperWidth?: '80mm' | '58mm';
  restaurantName?: string;
}

export function printKitchenTicket(data: KitchenTicketData) {
  const paperWidth = data.paperWidth || '80mm';
  const is58 = paperWidth === '58mm';

  const timeStr = data.timestamp 
    ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const dateStr = new Date().toLocaleDateString();

  const printWindow = window.open('', '_blank', 'width=450,height=650');
  if (!printWindow) {
    alert('⚠️ Por favor permite las ventanas emergentes (popups) para la impresión automática de comanda.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Comanda Cocina - ${data.tableName}</title>
        <style>
          @page {
            margin: 0;
            size: ${is58 ? '58mm' : '80mm'} auto;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Courier New', Courier, monospace, sans-serif;
            font-size: ${is58 ? '11px' : '13px'};
            width: ${is58 ? '54mm' : '72mm'};
            margin: 0 auto;
            padding: 4px;
            color: #000;
            background: #fff;
            line-height: 1.25;
          }
          .header {
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 6px;
            margin-bottom: 6px;
          }
          .title {
            font-size: ${is58 ? '14px' : '17px'};
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .subtitle {
            font-size: ${is58 ? '10px' : '11px'};
            font-weight: bold;
            margin-top: 2px;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            font-size: ${is58 ? '10px' : '12px'};
            font-weight: bold;
            margin-top: 3px;
          }
          .target-banner {
            font-size: ${is58 ? '15px' : '18px'};
            font-weight: 900;
            text-align: center;
            background: #000;
            color: #fff;
            padding: 3px 0;
            margin: 6px 0;
            text-transform: uppercase;
          }
          .items-container {
            border-bottom: 2px dashed #000;
            padding-bottom: 6px;
            margin-bottom: 6px;
          }
          .item-row {
            border-bottom: 1px dotted #888;
            padding: 5px 0;
          }
          .item-row:last-child {
            border-bottom: none;
          }
          .item-main {
            display: flex;
            align-items: baseline;
            gap: 6px;
            font-size: ${is58 ? '13px' : '16px'};
            font-weight: 900;
          }
          .qty {
            font-size: ${is58 ? '15px' : '18px'};
            font-weight: 900;
            min-width: 24px;
          }
          .item-details {
            margin-left: 26px;
            font-size: ${is58 ? '10px' : '12px'};
            font-weight: bold;
            margin-top: 2px;
          }
          .tag-no {
            color: #000;
            background: #e2e2e2;
            padding: 1px 4px;
            border-radius: 2px;
            display: inline-block;
            font-weight: 900;
          }
          .tag-extra {
            display: inline-block;
            font-weight: bold;
          }
          .note {
            font-style: italic;
            margin-top: 3px;
            border-left: 3px solid #000;
            padding-left: 4px;
            font-weight: 900;
          }
          .footer {
            text-align: center;
            margin-top: 8px;
            font-size: ${is58 ? '10px' : '11px'};
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">*** COMANDA COCINA ***</div>
          <div class="subtitle">${data.restaurantName || 'BISTROFLOW'}</div>
          
          <div class="target-banner">
            ${data.tableName}
          </div>

          <div class="meta-row">
            <span>MESERO: ${data.waiterName || 'Caja'}</span>
            <span>${timeStr}</span>
          </div>
          <div class="meta-row">
            <span>FECHA: ${dateStr}</span>
            ${data.orderNumber ? `<span>ORDEN: #${data.orderNumber}</span>` : ''}
          </div>
        </div>

        <div class="items-container">
          ${data.items.map(item => `
            <div class="item-row">
              <div class="item-main">
                <span class="qty">${item.quantity}x</span>
                <span>${item.itemName}</span>
              </div>

              ${(item.seatNumber || item.course) ? `
                <div class="item-details">
                  ${item.seatNumber ? `[Asiento ${item.seatNumber}] ` : ''}
                  ${item.course ? `[${item.course.toUpperCase()}]` : ''}
                </div>
              ` : ''}

              ${item.excludedIngredients && item.excludedIngredients.length > 0 ? `
                <div class="item-details">
                  ${item.excludedIngredients.map(ing => `<span class="tag-no">SIN ${ing.toUpperCase()}</span>`).join(' ')}
                </div>
              ` : ''}

              ${item.extras && item.extras.length > 0 ? `
                <div class="item-details">
                  ${item.extras.map(e => `<span class="tag-extra">+ ${e.name.toUpperCase()}</span>`).join(', ')}
                </div>
              ` : ''}

              ${item.note ? `
                <div class="item-details note">
                  NOTA: ${item.note.toUpperCase()}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div class="footer">
          <div>TOTAL ITEMS: ${data.items.reduce((acc, i) => acc + i.quantity, 0)}</div>
          <div style="margin-top: 4px; font-weight: 900;">*** IMPRESIÓN DIRECTA COCINA ***</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 600);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
