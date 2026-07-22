import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc,
  collectionGroup
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';
import { 
  Clock, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  TrendingUp, 
  UserCheck, 
  RefreshCw, 
  User as UserIcon,
  Eye,
  CameraOff
} from 'lucide-react';
import { useRestaurantData } from '../hooks/useRestaurantData';
import { motion, AnimatePresence } from 'motion/react';

interface MyShiftViewProps {
  currentUser: User & { employeeId: string };
}

export default function MyShiftView({ currentUser }: MyShiftViewProps) {
  const { settings } = useRestaurantData();
  const requirePhoto = settings?.requirePhotoForShift !== false;
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [activeLog, setActiveLog] = useState<any | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  
  // Camera state
  const isMountedRef = useRef<boolean>(true);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Action status state
  const [pinCode, setPinCode] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // Modal for previewing historical photos
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fetch employees list to check correct PIN
  useEffect(() => {
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubEmployees();
  }, []);

  // Fetch sessions and all orders for employee productivity stats
  useEffect(() => {
    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubOrders = onSnapshot(collectionGroup(db, 'orders'), (snap) => {
      setAllOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubSessions();
      unsubOrders();
    };
  }, []);

  // Determine active employee details dynamically from currentUser
  const selectedEmployee = useMemo(() => {
    const empId = currentUser.employeeId;
    
    // Check if matching custom employee from Firestore
    const matched = employees.find(emp => emp.id === empId);
    if (matched) return matched;

    // Fallback profiles (only if ID starts with fallback-)
    if (empId && empId.startsWith('fallback-')) {
      const role = empId.replace('fallback-', '');
      let name = 'Usuario Demostración';
      if (role === 'admin') name = 'Admin';
      else if (role === 'waiter') name = 'Mesero';
      else if (role === 'cook') name = 'Cocina';
      else if (role === 'finance') name = 'Caja';
      return {
        id: empId,
        name,
        role,
        pin: role === 'admin' ? '1111' : role === 'waiter' ? '2222' : role === 'cook' ? '3333' : role === 'finance' ? '4444' : '0000'
      };
    }

    // Default to current user details but NO fallback PIN (rely on Firestore)
    return {
      id: empId,
      name: currentUser.name,
      role: currentUser.role,
      pin: '' // Don't guess PIN if not found in matched employees
    };
  }, [employees, currentUser]);

  // Fetch attendance logs for this employee
  useEffect(() => {
    const empId = currentUser.employeeId;
    if (!empId) return;
    const q = query(
      collection(db, 'attendance'), 
      where('employeeId', '==', empId)
    );
    const unsubAttendance = onSnapshot(q, (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAttendanceLogs(logs);
      
      // Find active check-in
      const active = logs.find((log: any) => log.status === 'checked_in');
      setActiveLog(active || null);
    });
    return () => unsubAttendance();
  }, [currentUser.employeeId]);

  // Start Camera Stream
  const startCamera = async () => {
    setCameraLoading(true);
    setCameraError('');
    setCapturedPhoto(null);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La cámara no está soportada en este navegador o iframe.');
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      // Crucial race condition fix: if component unmounted while waiting for camera, close immediately!
      if (!isMountedRef.current) {
        mediaStream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraLoading(false);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.warn('Camera access denied or failed:', err);
      setCameraError('No se pudo acceder a la cámara. El fichaje continuará sin foto.');
      setCameraLoading(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
  };

  // Ensure camera stops thoroughly on unmount. 
  // We removed startCamera() from here to prevent auto-start as requested.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, []);

  // Attach stream to video element when it becomes available
  useEffect(() => {
    if (stream && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Trigger camera capture to canvas
  const capturePhoto = (): string | null => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Shutter sound/flash simulation
      setShutterFlash(true);
      setTimeout(() => setShutterFlash(false), 200);

      // Match canvas dimensions to video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      // Flip canvas to match mirrored user camera preview
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      
      // Draw image
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Revert transformation matrix
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(dataUrl);
      return dataUrl;
    }
    return null;
  };

  // Handle number click on keypad
  const handleNumberClick = (num: string) => {
    if (pinCode.length < 4) {
      setPinCode(prev => prev + num);
      setPinError('');
      setActionSuccess('');
    }
  };

  const handleDelete = () => {
    setPinCode(prev => prev.slice(0, -1));
    setPinError('');
    setActionSuccess('');
  };

  const handleClear = () => {
    setPinCode('');
    setPinError('');
    setActionSuccess('');
  };

  // Process clock in or out
  const handleClockAction = async () => {
    setPinError('');
    setActionSuccess('');
    
    if (pinCode.length !== 4) {
      setPinError('Por favor ingresa tu PIN de 4 dígitos.');
      return;
    }

    setIsProcessing(true);

    try {
      const employeePin = selectedEmployee.pin;
      
      if (!employeePin) {
        setPinError('Cargando perfil, o empleado no encontrado. Espera un segundo y reintenta.');
        setPinCode('');
        setIsProcessing(false);
        return;
      }

      const employeeName = selectedEmployee.name;
      const employeeRole = selectedEmployee.role;

      // PIN Verification
      if (pinCode !== employeePin) {
        setPinError(`PIN incorrecto. Inténtalo de nuevo.`);
        setPinCode('');
        setIsProcessing(false);
        return;
      }

      // Capture photo if stream is running
      const verificationPhotoBase64 = capturePhoto();

      if (requirePhoto && !verificationPhotoBase64 && !capturedPhoto) {
        setPinError('La cámara es obligatoria para verificar identidad. Por favor enciende tu cámara y sitúate frente a ella.');
        setPinCode('');
        setIsProcessing(false);
        return;
      }
      
      const finalPhoto = capturedPhoto || verificationPhotoBase64 || null;

      const now = new Date();

      if (activeLog) {
        // Clock OUT
        const checkInTime = new Date(activeLog.checkIn);
        const hours = Math.max(0.1, Number(((now.getTime() - checkInTime.getTime()) / 3600000).toFixed(2)));

        await updateDoc(doc(db, 'attendance', activeLog.id), {
          checkOut: now.toISOString(),
          status: 'checked_out',
          hoursWorked: hours,
          photoOut: finalPhoto
        });

        setActionSuccess(`¡Salida registrada! Trabajaste ${hours} horas en este turno.`);
      } else {
        // Clock IN
        await addDoc(collection(db, 'attendance'), {
          employeeId: selectedEmployee.id,
          employeeName: employeeName,
          employeeRole: employeeRole,
          date: now.toISOString().substring(0, 10),
          checkIn: now.toISOString(),
          checkOut: null,
          status: 'checked_in',
          hoursWorked: 0,
          photoIn: finalPhoto
        });

        setActionSuccess(`¡Entrada registrada! Bienvenido/a a tu turno de hoy, ${employeeName}.`);
      }

      // Reset PIN keypad
      setPinCode('');
    } catch (err) {
      console.error('Error ticking clock:', err);
      setPinError('Ocurrió un error al registrar tu asistencia.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper labels
  const getRoleLabel = (roleStr: string) => {
    switch (roleStr) {
      case 'admin': return 'Administrador';
      case 'waiter': return 'Mesero / Garzón';
      case 'cook': return 'Cocinero / Chef';
      case 'finance': return 'Caja / Finanzas';
      default: return roleStr;
    }
  };

  // Calculate detailed worker stats including roles and month filters
  const employeeStats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const completed = attendanceLogs.filter((log: any) => log.status === 'checked_out');
    const totalHours = completed.reduce((sum: number, log: any) => sum + (log.hoursWorked || 0), 0);
    const avgHours = completed.length > 0 ? (totalHours / completed.length) : 0;
    
    const shiftsThisMonth = attendanceLogs.filter((log: any) => {
      if (!log.checkIn) return false;
      const d = new Date(log.checkIn);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    let tablesServed = 0;
    let dishesPrepared = 0;
    let salesGenerated = 0;

    if (selectedEmployee.role === 'waiter') {
      const handledSessions = sessions.filter(s => s.waiterId === selectedEmployee.id || s.waiterName === selectedEmployee.name || s.createdBy === selectedEmployee.id);
      tablesServed = handledSessions.length;
      salesGenerated = handledSessions.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
    } else if (selectedEmployee.role === 'cook') {
      const handledOrders = allOrders.filter(o => o.status === 'completed' || o.status === 'ready');
      dishesPrepared = handledOrders.reduce((acc, o) => acc + (o.quantity || 1), 0);
    }

    return {
      totalShifts: completed.length,
      totalHours: totalHours.toFixed(1),
      avgHours: avgHours.toFixed(1),
      shiftsThisMonth,
      tablesServed,
      salesGenerated: salesGenerated.toFixed(2),
      dishesPrepared
    };
  }, [selectedEmployee, attendanceLogs, sessions, allOrders]);



  return (
    <div className="max-w-6xl w-full mx-auto pb-20 px-4 min-w-0">
      <header className="mb-8">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Mi Control de Asistencia</h2>
        <p className="text-slate-400 text-sm mt-1">Registra tu jornada de trabajo y revisa tus horarios.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: RELOJ MARCADOR TERMINAL (CÁMERA + PINPAD) */}
        <div className="lg:col-span-6 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black shadow-sm uppercase">
                  {selectedEmployee.name ? selectedEmployee.name.charAt(0) : '?'}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">{selectedEmployee.name}</h3>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {getRoleLabel(selectedEmployee.role)}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-100">
                <span className={`w-2.5 h-2.5 rounded-full ${activeLog ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                <span className="text-xs font-black text-slate-700">
                  {activeLog ? 'Activo en Turno' : 'Fuera de Turno'}
                </span>
              </div>
            </div>
          </div>

          {/* Verification Camera Box */}
          <div className="relative aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex flex-col items-center justify-center">
            {/* Shutter flash screen overlay */}
            <AnimatePresence>
              {shutterFlash && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white z-30"
                />
              )}
            </AnimatePresence>

            {/* Video feed or captured preview */}
            {stream && !capturedPhoto ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover scale-x-[-1]" 
              />
            ) : capturedPhoto ? (
              <img src={capturedPhoto} alt="Verificación capturada" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-6 text-slate-400">
                {cameraLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="animate-spin text-indigo-500" size={32} />
                    <span className="text-xs font-bold text-slate-400">Inicializando cámara de seguridad...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 max-w-xs">
                    <CameraOff size={36} className="text-slate-600 mb-1" />
                    <span className="text-xs font-extrabold text-slate-200">Foto-Verificación Inactiva</span>
                    <span className="text-[10px] text-slate-500">
                      Cámara desactivada o sin permisos. Podrás marcar tu entrada usando tu PIN.
                    </span>
                    <button 
                      onClick={startCamera}
                      className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold tracking-wide transition-all uppercase"
                    >
                      Encender Cámara
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Face guide template outline (only when camera is active) */}
            {stream && !capturedPhoto && !cameraError && (
              <div className="absolute inset-0 pointer-events-none border-[16px] border-black/30 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full border-2 border-dashed border-white/60 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black/70 px-2 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-wider">
                    Ubica tu rostro aquí
                  </div>
                </div>
              </div>
            )}

            {/* Floating Camera Status Bar */}
            {stream && !capturedPhoto && (
              <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur-sm py-1.5 px-3 rounded-xl flex justify-between items-center text-[10px] text-emerald-400 font-bold tracking-wide">
                <span className="flex items-center gap-1.5 uppercase">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Cámara Activa
                </span>
                <button
                  onClick={stopCamera}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-md uppercase text-[9px] transition-colors"
                >
                  Apagar Cámara
                </button>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Keypad and PIN form */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1.5">
                  Ingresa tu PIN Personal
                </label>
                {pinCode && (
                  <button onClick={handleClear} className="text-[10px] font-bold text-rose-500 hover:underline">
                    Limpiar
                  </button>
                )}
              </div>
              
              {/* Dot Indicators */}
              <div className="flex justify-center gap-4 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                {[0, 1, 2, 3].map((i) => (
                  <div 
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border-2 border-slate-900 transition-all ${
                      pinCode.length > i ? 'bg-slate-900 scale-110' : 'bg-transparent scale-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            {pinError && (
              <div className="p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl border border-rose-100 flex items-center gap-2 justify-center">
                <AlertCircle size={14} className="shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            {actionSuccess && (
              <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-extrabold rounded-2xl border border-emerald-100 flex flex-col items-center gap-1 text-center shadow-sm">
                <CheckCircle2 size={20} className="text-emerald-600 mb-1" />
                <span>{actionSuccess}</span>
              </div>
            )}

            {/* Circular Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto pt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  type="button"
                  key={num}
                  onClick={() => handleNumberClick(num)}
                  disabled={isProcessing}
                  className="h-12 w-full text-lg font-black rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 flex items-center justify-center transition-all border border-slate-100"
                >
                  {num}
                </button>
              ))}
              <button 
                type="button"
                onClick={handleDelete}
                disabled={isProcessing || !pinCode}
                className="h-12 w-full text-[10px] font-black uppercase tracking-wider rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 flex items-center justify-center transition-all text-slate-500 disabled:opacity-50"
              >
                Borrar
              </button>
              <button
                type="button"
                onClick={() => handleNumberClick('0')}
                disabled={isProcessing}
                className="h-12 w-full text-lg font-black rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 flex items-center justify-center transition-all border border-slate-100"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleClockAction}
                disabled={pinCode.length < 4 || isProcessing}
                className={`h-12 w-full text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center transition-all ${
                  pinCode.length === 4 && !isProcessing
                    ? activeLog 
                      ? 'bg-rose-600 text-white shadow-md active:scale-95 hover:bg-rose-700'
                      : 'bg-emerald-600 text-white shadow-md active:scale-95 hover:bg-emerald-700' 
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}
              >
                {activeLog ? 'SALIDA' : 'ENTRADA'}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: HISTORIAL DE MARCAJES DEL EMPLEADO & ESTADÍSTICAS */}
        <div className="lg:col-span-6 space-y-6">
          {/* Stats Dashboard cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Turnos Mes</span>
              <span className="text-xl md:text-2xl font-black text-slate-950 tracking-tight mt-2 block">
                {employeeStats.shiftsThisMonth}
              </span>
            </div>
            
            <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Horas Totales</span>
              <span className="text-xl md:text-2xl font-black text-indigo-600 tracking-tight mt-2 block">
                {employeeStats.totalHours} <span className="text-[10px] md:text-xs font-bold text-slate-400">hrs</span>
              </span>
            </div>

            <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Promedio Turno</span>
              <span className="text-xl md:text-2xl font-black text-slate-950 tracking-tight mt-2 block">
                {employeeStats.avgHours} <span className="text-[10px] md:text-xs font-bold text-slate-400">hrs</span>
              </span>
            </div>
          </div>

          {/* Role-specific Metrics Card */}
          {(selectedEmployee.role === 'waiter' || selectedEmployee.role === 'cook') && (
            <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <TrendingUp size={120} />
              </div>
              <div className="relative z-10">
                <span className="text-[10px] uppercase font-black text-indigo-400 tracking-widest block mb-1">Métricas de Desempeño</span>
                <h3 className="text-lg font-black tracking-tight text-white">Mi Productividad y Aporte</h3>
                <p className="text-slate-400 text-xs mt-1 mb-6">Estadísticas en tiempo real basadas en tu actividad en el sistema.</p>
                
                <div className="grid grid-cols-2 gap-4">
                  {selectedEmployee.role === 'waiter' && (
                    <>
                      <div className="bg-slate-800/80 backdrop-blur-sm p-4 rounded-xl border border-slate-700/50">
                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Mesas Atendidas</span>
                        <span className="text-2xl font-black text-indigo-300 mt-1 block">
                          {employeeStats.tablesServed}
                        </span>
                      </div>
                      <div className="bg-slate-800/80 backdrop-blur-sm p-4 rounded-xl border border-slate-700/50">
                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Ventas Generadas</span>
                        <span className="text-2xl font-black text-emerald-400 mt-1 block">
                          ${employeeStats.salesGenerated}
                        </span>
                      </div>
                    </>
                  )}
                  {selectedEmployee.role === 'cook' && (
                    <div className="bg-slate-800/80 backdrop-blur-sm p-4 rounded-xl border border-slate-700/50 col-span-2">
                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">Platos Preparados</span>
                      <span className="text-2xl font-black text-rose-400 mt-1 block">
                        {employeeStats.dishesPrepared} <span className="text-xs font-bold text-slate-400">platos</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Historical Log list */}
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h4 className="text-sm font-black text-slate-900">Mi Historial de Turnos</h4>
              <p className="text-slate-400 text-[10px] mt-0.5">Control de registros de tus entradas y salidas.</p>
            </div>

            <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-50">
              {attendanceLogs.length > 0 ? (
                [...attendanceLogs]
                  .sort((a,b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime())
                  .map((log: any) => {
                    const checkInTime = new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const checkOutTime = log.checkOut 
                      ? new Date(log.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                      : null;
                    return (
                      <div key={log.id} className="p-4 hover:bg-slate-50/30 transition-colors flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar size={13} className="text-slate-400" />
                            <span className="font-extrabold text-xs text-slate-800">{log.date}</span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 text-slate-600 text-[11px] font-semibold">
                            <span className="flex items-center gap-1">
                              🟢 <span className="font-bold">{checkInTime}</span>
                              {log.photoIn && (
                                <button 
                                  onClick={() => setPreviewPhoto({ url: log.photoIn, title: `Foto Entrada - ${log.date} ${checkInTime}` })}
                                  className="ml-1 p-0.5 hover:bg-slate-100 text-indigo-600 rounded"
                                  title="Ver foto de entrada"
                                >
                                  <Camera size={12} />
                                </button>
                              )}
                            </span>
                            
                            <span>•</span>
                            
                            <span className="flex items-center gap-1">
                              {checkOutTime ? (
                                <>
                                  🔴 <span className="font-bold">{checkOutTime}</span>
                                  {log.photoOut && (
                                    <button 
                                      onClick={() => setPreviewPhoto({ url: log.photoOut, title: `Foto Salida - ${log.date} ${checkOutTime}` })}
                                      className="ml-1 p-0.5 hover:bg-slate-100 text-rose-500 rounded"
                                      title="Ver foto de salida"
                                    >
                                      <Camera size={12} />
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[8px] font-black rounded tracking-wider uppercase">
                                  En Curso
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-sm text-slate-900 block font-mono">
                            {log.hoursWorked ? `${log.hoursWorked.toFixed(1)} hrs` : '-'}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">Duración</span>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="py-16 text-center text-slate-400">
                  <Clock size={36} className="mx-auto text-slate-200 mb-2" />
                  <span className="font-bold text-xs block text-slate-500">Aún no tienes marcas registradas</span>
                  <span className="text-[10px] text-slate-400">Tus turnos se listarán en este panel.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox photo verification preview modal */}
      <AnimatePresence>
        {previewPhoto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl overflow-hidden max-w-sm w-full border border-slate-100 shadow-2xl"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h5 className="font-extrabold text-xs text-slate-900 tracking-tight leading-none">
                  {previewPhoto.title}
                </h5>
                <button 
                  onClick={() => setPreviewPhoto(null)}
                  className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-black px-2.5 py-1 rounded-xl transition-all"
                >
                  Cerrar
                </button>
              </div>
              
              <div className="aspect-[4/3] w-full bg-slate-950 overflow-hidden relative">
                <img src={previewPhoto.url} alt="Foto de Verificación de Turno" className="w-full h-full object-cover" />
                <div className="absolute bottom-3 right-3 bg-black/65 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                  Verificación Facial OK
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 text-[10px] text-slate-500 font-semibold flex items-center gap-2">
                <UserCheck size={14} className="text-slate-400" />
                <span>Foto tomada automáticamente en el momento del fichaje.</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
