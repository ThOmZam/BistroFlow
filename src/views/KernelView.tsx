import React, { useState, useEffect } from 'react';
import { Terminal, Clock, User, Filter, Search, Activity, Shield, Code, Server, FileDown, FileText } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';

export default function KernelView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Assuming we have an 'activity_logs' collection.
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(500));
    const unsub = onSnapshot(q, (snap) => {
      const parsedLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(parsedLogs);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filterType !== 'all' && log.type !== filterType) return false;
    if (searchTerm && !JSON.stringify(log).toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No hay registros de kernel para exportar.');
      return;
    }

    const headers = ['Timestamp', 'Tipo', 'Actor', 'Cargo', 'Acción', 'Detalles', 'Metadatos'];
    const rows = filteredLogs.map(log => {
      const timestamp = new Date(log.timestamp).toISOString();
      const type = log.type || 'system';
      const actor = log.actorName || 'System';
      const role = log.actorRole || '';
      const action = log.action || '';
      const details = log.details || '';
      const metadata = log.metadata ? JSON.stringify(log.metadata) : '';

      return [timestamp, type, actor, role, action, details, metadata].map(field => {
        const escaped = String(field).replace(/"/g, '""');
        return `"${escaped}"`;
      });
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Kernel_Audit_Log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    if (filteredLogs.length === 0) {
      alert('No hay registros de kernel para exportar.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    let y = margin;
    let pageNum = 1;

    const addHeader = () => {
      // Header Background
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, pageWidth, 40, 'F');

      // Title
      doc.setTextColor(52, 211, 153); // emerald-400
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(18);
      doc.text("SYSTEM KERNEL AUDIT REPORT", margin, 15);

      // Metadata
      doc.setTextColor(241, 245, 249); // slate-100
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, margin, 23);
      doc.text(`Filtro Activo: ${filterType.toUpperCase()} | Total Registros: ${filteredLogs.length}`, margin, 28);

      // Table Headers
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(margin, 35, contentWidth, 8, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);

      doc.text("FECHA/HORA", margin + 2, 40);
      doc.text("CATEGORÍA", margin + 37, 40);
      doc.text("ACTOR / CARGO", margin + 59, 40);
      doc.text("ACCIÓN & DETALLES", margin + 96, 40);

      y = 48;
    };

    addHeader();

    filteredLogs.forEach((log) => {
      if (y > pageHeight - margin - 15) {
        doc.setTextColor(148, 163, 184);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.text(`Página ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

        doc.addPage();
        pageNum++;
        addHeader();
      }

      const timestampStr = new Date(log.timestamp).toLocaleString('es-ES', {
        month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      const typeStr = (log.type || 'system').toUpperCase();
      
      const actorStr = log.actorRole && log.actorRole.toLowerCase() !== (log.actorName || '').toLowerCase()
        ? `${log.actorName || 'System'} (${log.actorRole})`
        : (log.actorName || 'System');
      const actionDetailsStr = `${log.action || ''} - ${log.details || ''}`;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);

      const textLines = doc.splitTextToSize(actionDetailsStr, 80);
      const rowHeight = Math.max(6, textLines.length * 4 + 2);

      // Faint alternating backgrounds
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(margin, y - 3, contentWidth, rowHeight, 'F');

      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(timestampStr, margin + 2, y + 1);

      // Category color coding
      if (log.type === 'auth') doc.setTextColor(147, 51, 234); // purple-600
      else if (log.type === 'order') doc.setTextColor(5, 150, 105); // emerald-600
      else if (log.type === 'finance') doc.setTextColor(217, 119, 6); // amber-600
      else if (log.type === 'system') doc.setTextColor(225, 29, 72); // rose-600
      else doc.setTextColor(71, 85, 105);
      doc.text(typeStr, margin + 37, y + 1);

      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFont("Helvetica", "bold");
      doc.text(actorStr, margin + 59, y + 1);

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(51, 65, 85); // slate-700
      textLines.forEach((line: string, index: number) => {
        doc.text(line, margin + 96, y + 1 + (index * 4));
      });

      // Bottom boundary line for row
      doc.setDrawColor(241, 245, 249); // slate-100
      doc.line(margin, y - 3 + rowHeight, margin + contentWidth, y - 3 + rowHeight);

      y += rowHeight;
    });

    // Final page footer
    doc.setTextColor(148, 163, 184);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Página ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    doc.save(`Kernel_Audit_Log_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'auth': return <Shield size={14} className="text-purple-400" />;
      case 'order': return <Activity size={14} className="text-emerald-400" />;
      case 'finance': return <Activity size={14} className="text-amber-400" />;
      case 'system': return <Server size={14} className="text-rose-400" />;
      default: return <Code size={14} className="text-slate-400" />;
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'auth': return 'text-purple-400';
      case 'order': return 'text-emerald-400';
      case 'finance': return 'text-amber-400';
      case 'system': return 'text-rose-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="max-w-7xl w-full mx-auto pb-16 px-4 sm:px-6 flex-1 flex flex-col">
      <header className="mb-8 border-b border-slate-200/60 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:pr-40">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-emerald-400 shadow-sm shrink-0">
            <Terminal size={24} />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 inline-block mb-1">
              Consola de Auditoría y Eventos
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">System Kernel</h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5 font-medium">Libro de Acciones y Registros de Seguridad del Sistema</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            <FileDown size={14} />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <FileText size={14} />
            <span>Exportar PDF</span>
          </button>
        </div>
      </header>

      <div className="bg-slate-900 rounded-[24px] overflow-hidden shadow-2xl border border-slate-800 flex flex-col flex-1 h-[calc(100vh-190px)] md:h-[calc(100vh-200px)] min-h-[450px]">
        {/* Terminal Header */}
        <div className="bg-slate-950 px-6 py-4 flex justify-between items-center border-b border-slate-800">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          </div>
          <div className="flex gap-4">
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-900 text-slate-300 text-xs font-mono border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">TODOS_LOS_EVENTOS</option>
              <option value="order">PEDIDOS_Y_MESAS</option>
              <option value="finance">FINANZAS_Y_CAJA</option>
              <option value="auth">SESIONES_Y_ACCESO</option>
              <option value="system">CONFIGURACION_SISTEMA</option>
            </select>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="grep..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-900 text-emerald-400 text-xs font-mono border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600 w-48"
              />
            </div>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="flex-1 overflow-y-auto p-6 font-mono text-xs bg-slate-900/50">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <span className="text-emerald-500 animate-pulse">Initializing kernel logs...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex justify-center items-center h-full">
              <span className="text-slate-600">No matching logs found in buffer.</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 hover:bg-slate-800/50 p-1.5 rounded transition-colors group">
                  <span className="text-slate-500 shrink-0 mt-0.5 whitespace-nowrap">
                    [{new Date(log.timestamp).toLocaleString('es-ES', { 
                      month: 'short', day: '2-digit', 
                      hour: '2-digit', minute:'2-digit', second:'2-digit' 
                    })}]
                  </span>
                  
                  <div className="shrink-0 mt-0.5">
                    {getLogIcon(log.type || 'system')}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className={`font-bold ${getLogColor(log.type || 'system')}`}>
                        {log.actorName || 'System'}
                        {log.actorRole && log.actorRole.toLowerCase() !== (log.actorName || '').toLowerCase() && (
                          <span className="text-slate-400 font-medium ml-1.5 text-[10px] uppercase tracking-wider bg-slate-800 border border-slate-700/50 px-1.5 py-0.5 rounded-md">
                            {log.actorRole}
                          </span>
                        )}
                      </span>
                      <span className="text-slate-400">
                        {log.action}
                      </span>
                      <span className="text-slate-300">
                        {log.details}
                      </span>
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-1 text-slate-500 text-[10px] break-all hidden group-hover:block">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
