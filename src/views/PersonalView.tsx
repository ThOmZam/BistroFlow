import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Briefcase, 
  Shield, 
  UserPlus, 
  Trash2, 
  Clock, 
  DollarSign, 
  Key, 
  Lock,
  Unlock,
  AlertCircle,
  Search,
  Plus,
  CheckCircle,
  TrendingUp,
  Calendar,
  Clipboard,
  Check,
  Edit,
  Save,
  X,
  ArrowUpDown,
  ArrowLeft,
  Phone,
  Mail,
  Star,
  FileText,
  Award,
  Activity,
  CheckCircle2,
  Camera
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, collectionGroup } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useBookmarks } from '../lib/bookmarks';

export default function PersonalView() {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Directory UI State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive' | 'admin' | 'waiter' | 'cook' | 'finance'>('all');
  const [orderByField, setOrderByField] = useState<'name' | 'salary' | 'date'>('name');
  const [activeTab, setActiveTab] = useState<'stats' | 'contract' | 'notes' | 'payroll'>('stats');

  // Listen for global search selection
  useEffect(() => {
    const handleSelectEmployee = (e: any) => {
      if (e.detail?.employeeId) {
        setSelectedEmployeeId(e.detail.employeeId);
      }
    };
    window.addEventListener('select_employee', handleSelectEmployee);
    return () => window.removeEventListener('select_employee', handleSelectEmployee);
  }, []);

  // Registration Modal State
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState<'admin' | 'waiter' | 'cook' | 'finance'>('waiter');
  const [empSchedule, setEmpSchedule] = useState('08:00 - 16:00');
  const [empSalary, setEmpSalary] = useState(250);
  const [empPin, setEmpPin] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empNotes, setEmpNotes] = useState('');
  const [empError, setEmpError] = useState('');

  // Editing UI State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'waiter' | 'cook' | 'finance'>('waiter');
  const [editSchedule, setEditSchedule] = useState('');
  const [editSalary, setEditSalary] = useState(0);
  const [editPin, setEditPin] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // PIN Visibility State
  const [revealPin, setRevealPin] = useState(false);

  // Load employees list from Firebase
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [isAddingBonus, setIsAddingBonus] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(50);
  const [bonusReason, setBonusReason] = useState('Bono por desempeño extraordinario');

  // PREDEFINED SHIFTS & ATTENDANCE LOGS
  const [schedules, setSchedules] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [topLevelTab, setTopLevelTab] = useState<'employees' | 'schedules' | 'attendance'>('employees');

  // Schedule Management States
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState<any | null>(null);
  const [schedName, setSchedName] = useState('');
  const [schedStart, setSchedStart] = useState('08:00');
  const [schedEnd, setSchedEnd] = useState('16:00');
  const [schedDays, setSchedDays] = useState<string[]>(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']);

  // PIN check-in/out Terminal States
  const [pinEmployeeId, setPinEmployeeId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [adminPreviewPhoto, setAdminPreviewPhoto] = useState<{ url: string; title: string } | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);


  useEffect(() => {

    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });
    const unsubPayrolls = onSnapshot(collection(db, 'payrolls'), (snap) => {
      setPayrolls(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubSchedules = onSnapshot(collection(db, 'schedules'), (snap) => {
      setSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snap) => {
      setAttendanceLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubOrders = onSnapshot(collectionGroup(db, 'orders'), (snap) => {
      setAllOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubEmployees();
      unsubPayrolls();
      unsubSchedules();
      unsubAttendance();
      unsubSessions();
      unsubOrders();
    };

  }, []);

  // Pre-seed default schedules if collection is empty
  useEffect(() => {
    if (!isLoading && schedules.length === 0) {
      const seedDefaults = async () => {
        try {
          const defaults = [
            { name: 'Turno Mañana', timeStart: '08:00', timeEnd: '16:00', days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'], createdAt: new Date().toISOString() },
            { name: 'Turno Tarde', timeStart: '12:00', timeEnd: '20:00', days: ['Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'], createdAt: new Date().toISOString() },
            { name: 'Turno Noche', timeStart: '16:00', timeEnd: '00:00', days: ['Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Lunes'], createdAt: new Date().toISOString() },
            { name: 'Turno Completo', timeStart: '08:00', timeEnd: '18:00', days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'], createdAt: new Date().toISOString() }
          ];
          for (const s of defaults) {
            await addDoc(collection(db, 'schedules'), s);
          }
        } catch (e) {
          console.error("Error seeding schedules:", e);
        }
      };
      seedDefaults();
    }
  }, [isLoading, schedules]);

  // Pre-seed base staff and admin if employees collection is empty
  useEffect(() => {
    if (!isLoading && employees.length === 0) {
      const seedEmployees = async () => {
        try {
          const defaultStaff = [
            {
              name: 'Gerencia General',
              role: 'admin',
              email: 'admin@bistroflow.com',
              pin: '1234',
              schedule: 'Dirección General (08:00 - 22:00)',
              salary: 1000,
              phone: '+58 412 0000000',
              notes: 'Administración Principal',
              status: 'active',
              createdAt: new Date().toISOString()
            },
            {
              name: 'Carlos Mesero',
              role: 'waiter',
              email: 'mesero@bistroflow.com',
              pin: '1234',
              schedule: 'Turno Mañana (08:00 - 16:00)',
              salary: 250,
              phone: '+58 414 1111111',
              status: 'active',
              createdAt: new Date().toISOString()
            },
            {
              name: 'Elena Cocinera',
              role: 'cook',
              email: 'cocina@bistroflow.com',
              pin: '5678',
              schedule: 'Turno Completo (10:00 - 20:00)',
              salary: 300,
              phone: '+58 414 2222222',
              status: 'active',
              createdAt: new Date().toISOString()
            },
            {
              name: 'Roberto Cajero',
              role: 'finance',
              email: 'caja@bistroflow.com',
              pin: '4321',
              schedule: 'Turno Tarde (12:00 - 21:00)',
              salary: 350,
              phone: '+58 414 3333333',
              status: 'active',
              createdAt: new Date().toISOString()
            }
          ];
          for (const s of defaultStaff) {
            await addDoc(collection(db, 'employees'), s);
          }
        } catch (e) {
          console.error('Error seeding employees in PersonalView:', e);
        }
      };
      seedEmployees();
    }
  }, [isLoading, employees.length]);

  const handleToggleSchedDay = (day: string) => {
    setSchedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedName.trim()) return;
    try {
      await addDoc(collection(db, 'schedules'), {
        name: schedName.trim(),
        timeStart: schedStart,
        timeEnd: schedEnd,
        days: schedDays,
        createdAt: new Date().toISOString()
      });
      setIsAddingSchedule(false);
      setSchedName('');
      setSchedStart('08:00');
      setSchedEnd('16:00');
      setSchedDays(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']);
    } catch (err) {
      console.error('Error adding schedule:', err);
    }
  };

  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingSchedule) return;
    try {
      await updateDoc(doc(db, 'schedules', isEditingSchedule.id), {
        name: schedName.trim(),
        timeStart: schedStart,
        timeEnd: schedEnd,
        days: schedDays
      });
      setIsEditingSchedule(null);
      setSchedName('');
      setSchedStart('08:00');
      setSchedEnd('16:00');
      setSchedDays(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']);
    } catch (err) {
      console.error('Error updating schedule:', err);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar esta plantilla de horario? Los colaboradores asignados mantendrán la descripción anterior pero no se podrá seleccionar nuevamente.')) {
      try {
        await deleteDoc(doc(db, 'schedules', id));
      } catch (err) {
        console.error('Error deleting schedule:', err);
      }
    }
  };

  const handlePinAction = async () => {
    setPinError('');
    setPinSuccess('');
    if (!pinEmployeeId) {
      setPinError('Selecciona tu nombre primero.');
      return;
    }
    if (pinCode.length !== 4) {
      setPinError('Ingresa tu PIN de 4 dígitos.');
      return;
    }

    const employee = employees.find(emp => emp.id === pinEmployeeId);
    if (!employee) {
      setPinError('Colaborador no encontrado.');
      return;
    }

    if (employee.pin !== pinCode) {
      setPinError('PIN incorrecto. Inténtalo de nuevo.');
      setPinCode('');
      return;
    }

    // PIN is correct! Find if currently checked in
    const activeLog = attendanceLogs.find(log => log.employeeId === pinEmployeeId && log.status === 'checked_in');

    try {
      if (activeLog) {
        // Clock out
        const now = new Date();
        const checkInTime = new Date(activeLog.checkIn);
        const hours = Math.max(0.1, Number(((now.getTime() - checkInTime.getTime()) / 3600000).toFixed(2)));

        await updateDoc(doc(db, 'attendance', activeLog.id), {
          checkOut: now.toISOString(),
          status: 'checked_out',
          hoursWorked: hours
        });

        setPinSuccess(`¡Salida registrada! Trabajaste ${hours} horas hoy.`);
      } else {
        // Clock in
        const now = new Date();
        await addDoc(collection(db, 'attendance'), {
          employeeId: employee.id,
          employeeName: employee.name,
          employeeRole: employee.role,
          date: now.toISOString().substring(0, 10),
          checkIn: now.toISOString(),
          checkOut: null,
          status: 'checked_in',
          hoursWorked: 0
        });

        setPinSuccess(`¡Entrada registrada! Bienvenido/a, ${employee.name}.`);
      }
      setPinCode('');
      setPinEmployeeId('');
    } catch (err) {
      console.error('Error clocking in/out:', err);
      setPinError('Error al guardar el registro de asistencia.');
    }
  };

  const selectedEmployee = useMemo(() => {
    return employees.find(emp => emp.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  
  const employeeStats = useMemo(() => {
    if (!selectedEmployee) return null;
    
    // Shifts/hours calculation from attendanceLogs
    const empLogs = attendanceLogs.filter(log => log.employeeId === selectedEmployee.id);
    let totalHours = 0;
    empLogs.forEach(log => {
      if (log.clockIn && log.clockOut) {
        const inTime = new Date(log.clockIn);
        const outTime = new Date(log.clockOut);
        const diffMs = outTime.getTime() - inTime.getTime();
        totalHours += diffMs / (1000 * 60 * 60);
      }
    });

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const shiftsThisMonth = empLogs.filter(log => {
      if (!log.clockIn) return false;
      const d = new Date(log.clockIn);
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
      totalHours: totalHours.toFixed(1),
      shiftsThisMonth,
      tablesServed,
      salesGenerated: salesGenerated.toFixed(2),
      dishesPrepared
    };
  }, [selectedEmployee, attendanceLogs, sessions, allOrders]);

  const employeePayrolls = useMemo(() => {
    return payrolls.filter(p => p.employeeId === selectedEmployeeId);
  }, [payrolls, selectedEmployeeId]);

  const employeeBonuses = useMemo(() => {
    return employeePayrolls.filter(p => p.type === 'bonus');
  }, [employeePayrolls]);

  const handlePaySalary = async (monthName: string, amount: number) => {
    if (!selectedEmployee) return;
    try {
      // 1. Save payroll in Firestore
      await addDoc(collection(db, 'payrolls'), {
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        month: monthName,
        amount: amount,
        status: 'paid',
        type: 'salary',
        paidAt: new Date().toISOString(),
        date: new Date().toLocaleDateString('es-ES')
      });

      // 2. Automatically register expense in Finance
      await addDoc(collection(db, 'finance_entries'), {
        type: 'expense',
        category: 'Nómina',
        amount: amount,
        description: `Pago de Nómina: ${monthName} - ${selectedEmployee.name} (${getRoleLabel(selectedEmployee.role)})`,
        timestamp: new Date().toISOString(),
        isFiscal: false,
        paymentMethod: 'cash'
      });

      alert(`Se ha registrado con éxito el pago de sueldo de ${monthName} por $${amount.toFixed(2)} USD para ${selectedEmployee.name} y se ha reflejado en el control de Finanzas.`);
    } catch (err) {
      console.error(err);
      alert('Error registrando el pago de nómina.');
    }
  };

  const handleRegisterBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || bonusAmount <= 0 || !bonusReason.trim()) return;

    try {
      const monthName = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      // capitalize month
      const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

      // 1. Save payroll in Firestore
      await addDoc(collection(db, 'payrolls'), {
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        month: formattedMonth,
        amount: Number(bonusAmount),
        status: 'paid',
        type: 'bonus',
        reason: bonusReason.trim(),
        paidAt: new Date().toISOString(),
        date: new Date().toLocaleDateString('es-ES')
      });

      // 2. Automatically register expense in Finance
      await addDoc(collection(db, 'finance_entries'), {
        type: 'expense',
        category: 'Nómina',
        amount: Number(bonusAmount),
        description: `Bono Extra: ${bonusReason.trim()} - ${selectedEmployee.name} (${getRoleLabel(selectedEmployee.role)})`,
        timestamp: new Date().toISOString(),
        isFiscal: false,
        paymentMethod: 'cash'
      });

      alert(`Bono de $${Number(bonusAmount).toFixed(2)} USD registrado con éxito para ${selectedEmployee.name}. Se ha guardado como egreso en Finanzas.`);
      setIsAddingBonus(false);
      setBonusAmount(50);
      setBonusReason('Bono por desempeño extraordinario');
    } catch (err) {
      console.error(err);
      alert('Error registrando el bono extra.');
    }
  };

  // Sync edit form fields when selecting an employee or starting edit
  useEffect(() => {
    if (selectedEmployee) {
      setEditName(selectedEmployee.name || '');
      setEditRole(selectedEmployee.role || 'waiter');
      setEditSchedule(selectedEmployee.schedule || '08:00 - 16:00');
      setEditSalary(selectedEmployee.salary || 250);
      setEditPin(selectedEmployee.pin || '');
      setEditPassword(selectedEmployee.password || '');
      setEditPhone(selectedEmployee.phone || '');
      setEditEmail(selectedEmployee.email || '');
      setEditNotes(selectedEmployee.notes || '');
    }
  }, [selectedEmployee, isEditing]);

  // Handle Add Employee Form
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpError('');
    
    if (!empName.trim() || !empPin.trim() || empPin.length < 4 || empPin.length > 6) {
      setEmpError('Completa todos los campos requeridos. El PIN debe constar de 4 a 6 dígitos.');
      return;
    }

    if (empRole === 'admin' && (!empEmail.trim() || !empPassword.trim())) {
      setEmpError('El rol de Administrador requiere obligatoriamente correo y contraseña.');
      return;
    }

    if (empPassword.trim() && empPassword.trim().length < 6) {
      setEmpError('La contraseña debe tener un mínimo de 6 caracteres.');
      return;
    }

    const pinExists = employees.some(emp => emp.pin === empPin);
    if (pinExists || ['1111', '2222', '3333', '4444', '0000', '1234', '123456', '000000'].includes(empPin)) {
      setEmpError('Este PIN ya está registrado o es considerado de riesgo.');
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'employees'), {
        name: empName.trim(),
        role: empRole,
        schedule: empSchedule.trim(),
        salary: Number(empSalary),
        pin: empPin,
        password: empPassword.trim(),
        phone: empPhone.trim(),
        email: empEmail.trim(),
        notes: empNotes.trim(),
        status: 'active',
        createdAt: new Date().toISOString()
      });

      // Automatically select the new employee in the detail view
      setSelectedEmployeeId(docRef.id);
      
      // Reset & close
      setEmpName('');
      setEmpPin('');
      setEmpPassword('');
      setEmpSchedule('08:00 - 16:00');
      setEmpSalary(250);
      setEmpPhone('');
      setEmpEmail('');
      setEmpNotes('');
      setIsAddingEmployee(false);
    } catch (err) {
      console.error('Error adding employee:', err);
      setEmpError('No se pudo completar el registro del personal.');
    }
  };

  // Handle Update Employee Details
  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) return;

    if (!editName.trim() || !editPin.trim() || editPin.length < 4 || editPin.length > 6) {
      alert('Completa los campos obligatorios. El PIN debe ser de 4 a 6 dígitos.');
      return;
    }

    // Check PIN uniqueness excluding the current employee
    const pinExists = employees.some(emp => emp.id !== selectedEmployeeId && emp.pin === editPin);
    if (pinExists) {
      alert('Error: Este PIN ya está siendo utilizado por otro colaborador.');
      return;
    }

    try {
      await updateDoc(doc(db, 'employees', selectedEmployeeId), {
        name: editName.trim(),
        role: editRole,
        schedule: editSchedule.trim(),
        salary: Number(editSalary),
        pin: editPin,
        password: editPassword.trim() || selectedEmployee.password || '',
        phone: editPhone.trim(),
        email: editEmail.trim(),
        notes: editNotes.trim()
      });
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating employee:', err);
      alert('Error al guardar los cambios.');
    }
  };

  // Quick save comments/notes in the tab view
  const handleSaveNotesOnly = async () => {
    if (!selectedEmployeeId) return;
    try {
      await updateDoc(doc(db, 'employees', selectedEmployeeId), {
        notes: editNotes.trim()
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving comments:', err);
    }
  };

  const toggleEmployeeStatus = async (emp: any) => {
    try {
      await updateDoc(doc(db, 'employees', emp.id), {
        status: emp.status === 'active' ? 'inactive' : 'active'
      });
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (confirm('¿Seguro que deseas eliminar a este colaborador y revocar sus accesos PIN de forma inmediata?')) {
      try {
        await deleteDoc(doc(db, 'employees', id));
        setSelectedEmployeeId(null);
      } catch (err) {
        console.error('Error deleting employee:', err);
      }
    }
  };

  // Directory Filtering & Sorting
  const filteredEmployees = useMemo(() => {
    let list = employees.filter(emp => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        (emp.name || '').toLowerCase().includes(query) ||
        (emp.role || '').toLowerCase().includes(query) ||
        (emp.phone || '').toLowerCase().includes(query);

      if (!matchesSearch) return false;

      switch (activeFilter) {
        case 'active':
          return emp.status === 'active';
        case 'inactive':
          return emp.status === 'inactive';
        case 'admin':
          return emp.role === 'admin';
        case 'waiter':
          return emp.role === 'waiter';
        case 'cook':
          return emp.role === 'cook';
        case 'finance':
          return emp.role === 'finance';
        case 'all':
        default:
          return true;
      }
    });

    return [...list].sort((a, b) => {
      switch (orderByField) {
        case 'salary':
          return b.salary - a.salary;
        case 'date':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'name':
        default:
          return (a.name || '').localeCompare(b.name || '');
      }
    });
  }, [employees, searchQuery, activeFilter, orderByField]);

  // Global Dashboard Metrics
  const globalMetrics = useMemo(() => {
    const totalCount = employees.length;
    const activeStaff = employees.filter(emp => emp.status === 'active').length;
    const totalPayroll = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
    const averageSalary = totalCount > 0 ? totalPayroll / totalCount : 0;
    
    // Role distribution counts
    const waiters = employees.filter(e => e.role === 'waiter').length;
    const cooks = employees.filter(e => e.role === 'cook').length;
    const cajeros = employees.filter(e => e.role === 'finance').length;

    return {
      totalCount,
      activeStaff,
      totalPayroll,
      averageSalary,
      distribution: `${waiters} M / ${cooks} C / ${cajeros} B`
    };
  }, [employees]);

  // Visual avatar color generator based on employee name initials
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-indigo-100 text-indigo-700 border-indigo-200',
      'bg-emerald-100 text-emerald-700 border-emerald-200',
      'bg-amber-100 text-amber-700 border-amber-200',
      'bg-rose-100 text-rose-700 border-rose-200',
      'bg-sky-100 text-sky-700 border-sky-200',
      'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
      'bg-slate-100 text-slate-700 border-slate-200'
    ];
    const code = (name || 'E').charCodeAt(0) + ((name || 'E').charCodeAt(1) || 0);
    return colors[code % colors.length];
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'cook': return 'Cocinero';
      case 'finance': return 'Cajero / Finance';
      case 'waiter': return 'Mesero / Salon';
      default: return role;
    }
  };

  const getAssignedCount = (sched: any) => {
    const matchStr = `${sched.name} (${sched.timeStart} - ${sched.timeEnd})`;
    return employees.filter(emp => emp.schedule === matchStr).length;
  };

  return (
    <div className="w-full space-y-6 pb-20" id="personal-dashboard-view">
      
      {/* SECTION HEADER */}
      <div className="border-b border-slate-200/60 pb-5 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:pr-40">
        <div>
          <span className="text-[10px] uppercase font-black tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 inline-block mb-1.5">
            Módulo Administrativo de Capital Humano
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Personal & Nómina</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Supervisión integrada de colaboradores, salarios, horarios de trabajo y credenciales rápidas de acceso.</p>
        </div>
        
        {/* Register employee trigger */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button 
            onClick={() => setIsAddingEmployee(true)}
            className="bg-black hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <UserPlus size={16} />
            <span>Registrar Colaborador</span>
          </button>
        </div>
      </div>

      {/* GLOBAL METRICS BENTO GRID (Visible when no specific employee is selected) */}
      {!selectedEmployee ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Users size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider truncate">Plantilla Total</span>
              <span className="text-xl font-black text-slate-900 tracking-tight mt-0.5">{globalMetrics.totalCount} ({globalMetrics.activeStaff} activos)</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <DollarSign size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider truncate">Costo de Nómina</span>
              <span className="text-xl font-black text-emerald-600 tracking-tight mt-0.5">${globalMetrics.totalPayroll.toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Activity size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider truncate">Distribución de Roles</span>
              <span className="text-sm font-extrabold text-slate-700 tracking-tight mt-1 block">{globalMetrics.distribution}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Shield size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider truncate">Filtros de Seguridad</span>
              <span className="text-xl font-black text-slate-900 tracking-tight mt-0.5">PIN Activos</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* MAIN CONTENT WORKSPACE */}
      <div className="w-full space-y-6">
        {!selectedEmployee ? (
          <>
            {/* TOP-LEVEL NAVIGATION TABS - STANDALONE ROOMY TAB BUTTONS */}
            <div className="flex items-center gap-3 mb-6 overflow-x-auto whitespace-nowrap w-full scrollbar-none pb-1 shrink-0">
              <button
                onClick={() => setTopLevelTab('employees')}
                className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
                  topLevelTab === 'employees'
                    ? 'bg-slate-950 text-white shadow-md scale-[1.01]'
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 shadow-xs'
                }`}
              >
                <Users size={16} className={topLevelTab === 'employees' ? 'text-indigo-400' : 'text-slate-400'} />
                <span>Colaboradores &amp; Directorio</span>
              </button>
              
              <button
                onClick={() => setTopLevelTab('schedules')}
                className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
                  topLevelTab === 'schedules'
                    ? 'bg-slate-950 text-white shadow-md scale-[1.01]'
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 shadow-xs'
                }`}
              >
                <Clock size={16} className={topLevelTab === 'schedules' ? 'text-amber-400' : 'text-slate-400'} />
                <span>Gestión de Horarios</span>
              </button>
              
              <button
                onClick={() => setTopLevelTab('attendance')}
                className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
                  topLevelTab === 'attendance'
                    ? 'bg-slate-950 text-white shadow-md scale-[1.01]'
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 shadow-xs'
                }`}
              >
                <Calendar size={16} className={topLevelTab === 'attendance' ? 'text-emerald-400' : 'text-slate-400'} />
                <span>Reloj Marcador &amp; Asistencia</span>
              </button>
            </div>

            {topLevelTab === 'employees' && (
              <>
                {/* SEARCH AND FILTERING PANEL */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 mb-6 shrink-0">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                
                {/* Search Bar */}
                <div className="relative w-full md:max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    placeholder="Buscar colaborador por nombre, rol, teléfono..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-10 py-3 bg-slate-50/80 border border-slate-200/80 focus:border-black outline-none rounded-2xl text-xs sm:text-sm font-semibold placeholder:text-slate-400 transition-colors"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black font-extrabold text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Sort dropdown */}
                <div className="flex items-center gap-2 self-end md:self-auto text-xs font-bold text-slate-600">
                  <ArrowUpDown size={15} className="text-slate-400" />
                  <span className="text-slate-500">Ordenar por:</span>
                  <select
                    value={orderByField}
                    onChange={e => setOrderByField(e.target.value as any)}
                    className="bg-slate-50 px-3.5 py-2 border border-slate-200/80 rounded-xl text-slate-800 outline-none cursor-pointer hover:border-slate-300 font-extrabold text-xs"
                  >
                    <option value="name">Nombre A-Z</option>
                    <option value="salary">Sueldo Base Mensual</option>
                    <option value="date">Fecha de Ingreso</option>
                  </select>
                </div>

              </div>

              {/* Filtering tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide text-xs">
                  {[
                    { id: 'all', label: 'Todos los Colaboradores' },
                    { id: 'active', label: '🟢 Activos' },
                    { id: 'inactive', label: '🔴 Inactivos' },
                    { id: 'waiter', label: '🛒 Meseros' },
                    { id: 'cook', label: '🍳 Cocina' },
                    { id: 'finance', label: '💵 Cajeros' },
                    { id: 'admin', label: '🛡️ Admins' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFilter(tab.id as any)}
                      className={`px-4 py-2 rounded-xl font-extrabold border tracking-wide whitespace-nowrap transition-all text-xs cursor-pointer ${
                        activeFilter === tab.id
                          ? 'bg-slate-950 text-white border-slate-950 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <span className="text-xs font-black text-slate-500">
                  {filteredEmployees.length} {filteredEmployees.length === 1 ? 'colaborador encontrado' : 'colaboradores encontrados'}
                </span>
              </div>
            </div>

            {/* DIRECTORY LIST TABLE - BALANCED & ELEGANT */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden w-full flex flex-col mb-8">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-400 select-none">
                      <th className="py-3.5 px-5">Colaborador</th>
                      <th className="py-3.5 px-5">Cargo / Rol</th>
                      <th className="py-3.5 px-5">Horario de Trabajo</th>
                      <th className="py-3.5 px-5 text-right">Sueldo Base</th>
                      <th className="py-3.5 px-5 text-center">PIN de Acceso</th>
                      <th className="py-3.5 px-5 text-center">Estado de Acceso</th>
                      <th className="py-3.5 px-5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredEmployees.map(emp => {
                      const initials = (emp.name || 'E').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
                      const isStarred = isBookmarked(emp.id, 'employee');
                      return (
                        <tr 
                          key={emp.id}
                          onClick={() => {
                            setSelectedEmployeeId(emp.id);
                            setIsEditing(false);
                            setRevealPin(false);
                          }}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                        >
                          {/* Colaborador Avatar & Info */}
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleBookmark({
                                    id: emp.id,
                                    type: 'employee',
                                    name: emp.name || 'Empleado',
                                    details: `Cargo: ${getRoleLabel(emp.role)}`
                                  });
                                }}
                                className={`p-1.5 rounded-lg transition-all shrink-0 ${
                                  isStarred 
                                    ? 'text-amber-500 bg-amber-50' 
                                    : 'text-slate-300 hover:text-amber-400 opacity-40 group-hover:opacity-100 hover:bg-slate-100'
                                }`}
                                title={isStarred ? "Quitar de Marcadores" : "Añadir a Marcadores"}
                              >
                                <Star size={14} className={isStarred ? "fill-amber-400 text-amber-500" : ""} />
                              </button>
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs border shadow-2xs shrink-0 ${getAvatarColor(emp.name)}`}>
                                {initials}
                              </div>
                              <div>
                                <span className="font-extrabold text-slate-900 text-xs sm:text-sm block group-hover:text-indigo-600 transition-colors">{emp.name}</span>
                                <span className="text-[11px] text-slate-400 font-medium block">{emp.phone || 'Sin número registrado'}</span>
                              </div>
                            </div>
                          </td>

                          {/* Role Pill */}
                          <td className="py-3.5 px-5">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider inline-block ${
                              emp.role === 'admin' ? 'bg-amber-50 text-amber-800 border border-amber-200/60' :
                              emp.role === 'cook' ? 'bg-rose-50 text-rose-800 border border-rose-200/60' :
                              emp.role === 'finance' ? 'bg-indigo-50 text-indigo-800 border border-indigo-200/60' : 'bg-sky-50 text-sky-800 border border-sky-200/60'
                            }`}>
                              {getRoleLabel(emp.role)}
                            </span>
                          </td>

                          {/* Schedule */}
                          <td className="py-3.5 px-5 font-bold text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Clock size={13} className="text-slate-400 shrink-0" />
                              <span className="text-xs">{emp.schedule || 'No definido'}</span>
                            </div>
                          </td>

                          {/* Base Salary */}
                          <td className="py-3.5 px-5 text-right font-black text-slate-900 text-xs sm:text-sm">
                            ${(emp.salary || 0).toFixed(2)}
                          </td>

                          {/* Pin Code */}
                          <td className="py-3.5 px-5 text-center">
                            <span className="font-mono bg-slate-100 text-slate-800 font-extrabold px-2.5 py-1 rounded-lg text-xs select-none border border-slate-200/60 inline-block">
                              ••••
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-5 text-center">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide inline-block ${
                              emp.status === 'active' 
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60' 
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              {emp.status === 'active' ? 'Acceso Activo' : 'Revocado'}
                            </span>
                          </td>

                          {/* Action quick buttons */}
                          <td className="py-3.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button 
                                onClick={() => toggleEmployeeStatus(emp)}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  emp.status === 'active'
                                    ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                }`}
                                title={emp.status === 'active' ? 'Suspender Acceso' : 'Habilitar Acceso'}
                              >
                                {emp.status === 'active' ? <Lock size={14} /> : <Unlock size={14} />}
                              </button>
                              <button 
                                onClick={() => handleDeleteEmployee(emp.id)}
                                className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Dar de Baja"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredEmployees.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-20 text-slate-400 bg-slate-50/20">
                          <Users size={44} className="mx-auto text-slate-200 mb-3" />
                          <p className="font-extrabold text-slate-600 text-sm">No se encontraron colaboradores</p>
                          <p className="text-xs text-slate-400 mt-1">Ajusta los filtros de búsqueda o registra un nuevo empleado.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
              </>
            )}

            {/* SCHEDULES TAB CONTENT */}
            {topLevelTab === 'schedules' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Plantillas de Horarios y Turnos</h2>
                    <p className="text-slate-400 text-xs mt-0.5">Define los turnos operativos del restaurante para rotarlos y asignarlos fácilmente a los colaboradores.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setSchedName('');
                      setSchedStart('08:00');
                      setSchedEnd('16:00');
                      setSchedDays(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']);
                      setIsEditingSchedule(null);
                      setIsAddingSchedule(true);
                    }}
                    className="bg-black hover:bg-slate-950 text-white font-bold text-xs px-5 py-3.5 rounded-2xl flex items-center gap-2.5 shadow-md shadow-black/10 transition-all active:scale-[0.98] shrink-0"
                  >
                    <Plus size={16} />
                    Crear Nuevo Horario
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {schedules.map((s) => {
                    const assigned = getAssignedCount(s);
                    return (
                      <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all flex flex-col justify-between gap-6">
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase rounded-lg tracking-wider">
                                Plantilla
                              </span>
                              <h3 className="text-base font-black text-slate-900 mt-2">{s.name}</h3>
                            </div>
                            <div className="flex gap-1">
                              <button 
                                onClick={() => {
                                  setIsEditingSchedule(s);
                                  setSchedName(s.name);
                                  setSchedStart(s.timeStart);
                                  setSchedEnd(s.timeEnd);
                                  setSchedDays(s.days || []);
                                }}
                                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-black rounded-lg transition-colors"
                              >
                                <Edit size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteSchedule(s.id)}
                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <Clock size={16} className="text-slate-400" />
                              <span className="text-xs font-bold text-slate-700">Entrada / Salida</span>
                            </div>
                            <span className="text-xs font-black text-slate-900 font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-100">
                              {s.timeStart} - {s.timeEnd}
                            </span>
                          </div>

                          {/* Days of the week circles */}
                          <div>
                            <span className="text-[10px] uppercase font-black text-slate-400 block mb-2">Días Operativos</span>
                            <div className="flex gap-1.5">
                              {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day) => {
                                const initialsMap = {
                                  'Lunes': 'L', 'Martes': 'M', 'Miércoles': 'M', 'Jueves': 'J', 'Viernes': 'V', 'Sábado': 'S', 'Domingo': 'D'
                                };
                                const isActive = s.days?.includes(day);
                                return (
                                  <div 
                                    key={day}
                                    title={day}
                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border transition-colors ${
                                      isActive 
                                        ? 'bg-indigo-600 border-indigo-600 text-white' 
                                        : 'bg-slate-50 border-slate-200/60 text-slate-400'
                                    }`}
                                  >
                                    {initialsMap[day] || day[0]}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-400">Colaboradores asignados</span>
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-xs font-black rounded-xl">
                            {assigned} {assigned === 1 ? 'persona' : 'personas'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ATTENDANCE TAB CONTENT */}
            {topLevelTab === 'attendance' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Attendance quick stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Personal Activo Hoy</span>
                      <span className="text-2xl font-black text-slate-900 tracking-tight mt-1.5 block">
                        {attendanceLogs.filter(log => log.status === 'checked_in').length} en turno
                      </span>
                    </div>
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-black">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Horas Totales (Mes)</span>
                      <span className="text-2xl font-black text-indigo-600 tracking-tight mt-1.5 block">
                        {attendanceLogs.reduce((sum, log) => sum + (log.hoursWorked || 0), 0).toFixed(1)} hrs
                      </span>
                    </div>
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black">
                      <Clock size={20} />
                    </div>
                  </div>
                </div>

                {/* Attendance Log Table */}
                <div className="bg-white rounded-[32px] border border-slate-200/80 shadow-xs overflow-hidden flex flex-col mb-8">
                  <div className="p-6 border-b border-slate-200/80 flex justify-between items-center bg-slate-50/70">
                    <div>
                      <h4 className="text-base font-black text-slate-900">Historial de Marcajes y Auditoría</h4>
                      <p className="text-slate-500 text-xs mt-0.5">Control de entradas, salidas, horas calculadas y verificación fotográfica anti-fraude.</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-left border-collapse min-w-[850px]">
                      <thead>
                        <tr className="border-b border-slate-200/80 text-xs font-black uppercase tracking-wider text-slate-500 bg-slate-100/80">
                          <th className="py-4.5 px-6">Colaborador</th>
                          <th className="py-4.5 px-5">Fecha</th>
                          <th className="py-4.5 px-5">Entrada</th>
                          <th className="py-4.5 px-5">Salida</th>
                          <th className="py-4.5 px-5 text-center">Fotos de Seguridad</th>
                          <th className="py-4.5 px-6 text-right">Duración</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                        {attendanceLogs.length > 0 ? (
                          [...attendanceLogs].sort((a,b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime()).map((log) => {
                            const checkInTime = new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const checkOutTime = log.checkOut 
                              ? new Date(log.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                              : null;
                            return (
                              <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-4.5 px-6">
                                  <span className="font-extrabold text-slate-900 text-sm block">{log.employeeName}</span>
                                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wide block mt-0.5">{getRoleLabel(log.employeeRole)}</span>
                                </td>
                                <td className="py-4.5 px-5 font-mono text-slate-600 text-xs sm:text-sm font-bold">
                                  {log.date}
                                </td>
                                <td className="py-4.5 px-5 text-slate-900 font-bold text-xs sm:text-sm">
                                  🟢 {checkInTime}
                                </td>
                                <td className="py-4.5 px-5">
                                  {checkOutTime ? (
                                    <span className="text-slate-700 font-bold text-xs sm:text-sm">🔴 {checkOutTime}</span>
                                  ) : (
                                    <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black rounded-lg tracking-wider inline-block">
                                      EN TURNO
                                    </span>
                                  )}
                                </td>
                                <td className="py-4.5 px-5">
                                  <div className="flex items-center justify-center gap-2">
                                    {log.photoIn ? (
                                      <button 
                                        onClick={() => setAdminPreviewPhoto({ url: log.photoIn, title: `Foto Entrada - ${log.employeeName} (${log.date} ${checkInTime})` })}
                                        className="py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200/80 transition-all flex items-center gap-1.5 text-xs font-extrabold cursor-pointer"
                                        title="Ver foto tomada en entrada"
                                      >
                                        <Camera size={14} />
                                        <span>Entrada</span>
                                      </button>
                                    ) : (
                                      <span className="text-xs text-slate-400 font-medium">Sin foto entrada</span>
                                    )}
                                    
                                    {log.photoOut ? (
                                      <button 
                                        onClick={() => setAdminPreviewPhoto({ url: log.photoOut, title: `Foto Salida - ${log.employeeName} (${log.date} ${checkOutTime})` })}
                                        className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200/80 transition-all flex items-center gap-1.5 text-xs font-extrabold cursor-pointer"
                                        title="Ver foto tomada en salida"
                                      >
                                        <Camera size={14} />
                                        <span>Salida</span>
                                      </button>
                                    ) : log.checkOut ? (
                                      <span className="text-xs text-slate-400 font-medium">Sin foto salida</span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="py-4.5 px-6 text-right font-black text-slate-900 font-mono text-sm">
                                  {log.hoursWorked ? `${log.hoursWorked.toFixed(1)} hrs` : '-'}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-16 text-center text-slate-400">
                              <Clock size={36} className="mx-auto text-slate-200 mb-2" />
                              <span className="font-bold text-sm block text-slate-600">Sin registros de asistencia</span>
                              <span className="text-xs text-slate-400 font-medium mt-0.5 block">Las marcas registradas por los colaboradores se verán aquí.</span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Lightbox Photo Preview Modal for Admins */}
                {adminPreviewPhoto && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white rounded-3xl overflow-hidden max-w-sm w-full border border-slate-100 shadow-2xl"
                    >
                      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h5 className="font-extrabold text-xs text-slate-900 tracking-tight leading-none">
                          {adminPreviewPhoto.title}
                        </h5>
                        <button 
                          onClick={() => setAdminPreviewPhoto(null)}
                          className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-black px-2.5 py-1 rounded-xl transition-all"
                        >
                          Cerrar
                        </button>
                      </div>
                      
                      <div className="aspect-[4/3] w-full bg-slate-950 overflow-hidden relative">
                        <img src={adminPreviewPhoto.url} alt="Foto de Verificación" className="w-full h-full object-cover" />
                        <div className="absolute bottom-3 right-3 bg-black/65 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                          Captura Biométrica OK
                        </div>
                      </div>
                      
                      <div className="p-4 bg-slate-50 text-[10px] text-slate-500 font-semibold flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        <span>Validación de seguridad correcta para evitar suplantaciones.</span>
                      </div>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )}
          </>
        ) : (
          /* DETAILED EMPLOYEE PROFILE VIEW */
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Go back breadcrumb */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 shrink-0">
              <button 
                onClick={() => setSelectedEmployeeId(null)}
                className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-black transition-all bg-white py-2 px-4 rounded-xl border border-slate-200/60 shadow-sm active:scale-[0.98]"
              >
                <ArrowLeft size={14} />
                <span>Volver al Directorio</span>
              </button>

              {saveSuccess && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl"
                >
                  <CheckCircle2 size={14} />
                  <span>Configuración del colaborador guardada correctamente</span>
                </motion.div>
              )}
            </div>

            {/* Profile split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
              
              {/* LEFT SIDEBAR: PROFILE OVERVIEW */}
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col h-fit lg:max-h-full lg:overflow-y-auto gap-6">
                
                {/* Header Profile card */}
                <div className="text-center pb-6 border-b border-slate-100">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center font-black text-2xl mx-auto border ${getAvatarColor(selectedEmployee.name)} mb-3 shadow-sm`}>
                    {(selectedEmployee.name || 'E').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <h2 className="text-xl font-black text-slate-900 leading-tight">{selectedEmployee.name}</h2>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider inline-block mt-2.5 ${
                    selectedEmployee.role === 'admin' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                    selectedEmployee.role === 'cook' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                    selectedEmployee.role === 'finance' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-sky-50 text-sky-700 border border-sky-100'
                  }`}>
                    {getRoleLabel(selectedEmployee.role)}
                  </span>
                </div>

                {/* Status toggle and Admin controls */}
                <div className="space-y-3">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Control de Accesos</span>
                  
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100/80">
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">Estatus en Sistema</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Determina si puede iniciar sesión</span>
                    </div>
                    <button 
                      onClick={() => toggleEmployeeStatus(selectedEmployee)}
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${selectedEmployee.status === 'active' ? 'bg-emerald-500' : 'bg-slate-200'}`}
                    >
                      <div className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform duration-200 ${selectedEmployee.status === 'active' ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="flex-1 bg-slate-900 hover:bg-black text-white font-bold text-xs p-3.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                    >
                      <Edit size={14} />
                      Editar Ficha
                    </button>
                    <button 
                      onClick={() => handleDeleteEmployee(selectedEmployee.id)}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 p-3.5 rounded-xl transition-all active:scale-[0.98]"
                      title="Eliminar permanentemente de nómina"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Contact info list */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Información de Contacto</span>
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                        <Phone size={13} className="text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Teléfono / Celular</span>
                        <span className="text-xs font-bold text-slate-800 break-words">{selectedEmployee.phone || 'No registrado'}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                        <Mail size={13} className="text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Correo Electrónico</span>
                        <span className="text-xs font-bold text-slate-800 break-all">{selectedEmployee.email || 'No registrado'}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                        <Calendar size={13} className="text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Fecha de Registro</span>
                        <span className="text-xs font-bold text-slate-800">
                          {selectedEmployee.createdAt ? new Date(selectedEmployee.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'No definida'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT CONTENT PANEL: TABBED FOLDERS */}
              <div className="lg:col-span-2 flex flex-col bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden min-h-0">
                
                {/* Tab selectors */}
                <div className="flex border-b border-slate-100 bg-slate-50/50 p-4 gap-2 shrink-0">
                  {[
                    { id: 'stats', label: 'Desempeño y Stats', icon: Activity },
                    { id: 'contract', label: 'Contrato y Seguridad', icon: Award },
                    { id: 'notes', label: 'Comentarios e Incidencias', icon: FileText },
                    { id: 'payroll', label: 'Estatus de Pagos / Nómina', icon: DollarSign }
                  ].map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id as any);
                          if (tab.id === 'notes') {
                            setEditNotes(selectedEmployee.notes || '');
                          }
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                          activeTab === tab.id
                            ? 'bg-white text-black shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Icon size={14} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Tab Contents */}
                <div className="p-6 flex-1 overflow-y-auto">
                  <AnimatePresence mode="wait">
                    
                    
                    {/* Tab 0: Stats */}
                    {activeTab === 'stats' && employeeStats && (
                      <motion.div 
                        key="stats-tab"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="space-y-6"
                      >
                        <div>
                          <h3 className="text-base font-black text-slate-900">Métricas de Desempeño</h3>
                          <p className="text-slate-400 text-xs mt-0.5">Actividad, asistencias y aporte productivo del colaborador.</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Horas Acumuladas</span>
                            <div className="text-3xl font-black text-slate-900">{employeeStats.totalHours} <span className="text-sm font-bold text-slate-500">hrs</span></div>
                          </div>
                          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Turnos (Mes Actual)</span>
                            <div className="text-3xl font-black text-slate-900">{employeeStats.shiftsThisMonth} <span className="text-sm font-bold text-slate-500">turnos</span></div>
                          </div>
                          
                          {selectedEmployee.role === 'waiter' && (
                            <>
                              <div className="bg-indigo-50 p-5 rounded-3xl border border-indigo-100">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider mb-2 block">Mesas Atendidas</span>
                                <div className="text-3xl font-black text-indigo-900">{employeeStats.tablesServed}</div>
                              </div>
                              <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100">
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider mb-2 block">Ventas Generadas</span>
                                <div className="text-3xl font-black text-emerald-900"><span className="text-lg">$</span>{employeeStats.salesGenerated}</div>
                              </div>
                            </>
                          )}
                          
                          {selectedEmployee.role === 'cook' && (
                            <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100 col-span-2">
                              <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider mb-2 block">Platos Preparados</span>
                              <div className="text-3xl font-black text-rose-900">{employeeStats.dishesPrepared} <span className="text-sm font-bold text-rose-500">platos</span></div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Tab 1: Contract and Security details */}
                    {activeTab === 'contract' && (
                      <motion.div 
                        key="contract-tab"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="space-y-6"
                      >
                        <div>
                          <h3 className="text-base font-black text-slate-900">Detalles Organizacionales</h3>
                          <p className="text-slate-400 text-xs mt-0.5">Información contractual, horarios asignados y seguridad rápida.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          {/* Salary card */}
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                              <DollarSign size={20} />
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">Sueldo Base Mensual</span>
                              <span className="text-base font-black text-slate-950">${(selectedEmployee.salary || 0).toFixed(2)} USD</span>
                            </div>
                          </div>

                          {/* Work Schedule card */}
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                              <Clock size={20} />
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">Horario Semanal Asignado</span>
                              <span className="text-base font-black text-slate-950">{selectedEmployee.schedule || 'No definido'}</span>
                            </div>
                          </div>

                          {/* Pin security card */}
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between col-span-1 md:col-span-2 gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <Key size={20} />
                              </div>
                              <div>
                                <span className="text-[9px] uppercase font-bold text-slate-400 block">Código PIN de Autenticación Rápida</span>
                                <span className="text-base font-mono font-black text-slate-950 tracking-wider">
                                  {revealPin ? selectedEmployee.pin : '••••'}
                                </span>
                              </div>
                            </div>
                            <button 
                              onClick={() => setRevealPin(!revealPin)}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-slate-200 px-3 py-2 rounded-xl transition-colors"
                            >
                              {revealPin ? 'Ocultar PIN' : 'Ver PIN'}
                            </button>
                          </div>

                        </div>

                        {/* Quick usage instructions */}
                        <div className="p-4 bg-indigo-50/50 border border-indigo-100/40 rounded-2xl flex gap-3">
                          <AlertCircle size={18} className="text-indigo-500 shrink-0 mt-0.5" />
                          <div className="text-xs leading-relaxed text-indigo-950">
                            <span className="font-extrabold block mb-1">¿Cómo utiliza este PIN el colaborador?</span>
                            Este PIN de 4 dígitos permite al colaborador ingresar directamente al sistema de ventas de salón, despachos de cocina o mesa de mandos según su cargo. Mantenga este número en privado para asegurar la confidencialidad de la caja y mesas asignadas.
                          </div>
                        </div>

                      </motion.div>
                    )}

                    {/* Tab 2: Comments and shift records */}
                    {activeTab === 'notes' && (
                      <motion.div 
                        key="notes-tab"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="space-y-4"
                      >
                        <div>
                          <h3 className="text-base font-black text-slate-900">Historial de Desempeño y Notas</h3>
                          <p className="text-slate-400 text-xs mt-0.5">Control de incidencias de asistencia, rendimiento general y llamadas de atención.</p>
                        </div>

                        <div className="space-y-3 pt-2">
                          <label className="block text-[10px] uppercase font-black text-slate-400">Notas Generales del Administrador</label>
                          <textarea 
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            placeholder="Ej. Ingresó con excelente disposición. Ha demostrado puntualidad extrema en su turno de cocina. Reportó una inasistencia médica justificada el 12 de junio..."
                            className="w-full p-4 bg-slate-50 border border-slate-200/60 focus:border-black outline-none rounded-2xl text-xs font-semibold h-44 resize-none leading-relaxed"
                          />
                        </div>

                        <div className="flex justify-end pt-2">
                          <button 
                            onClick={handleSaveNotesOnly}
                            className="bg-black hover:bg-slate-900 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center gap-2 transition-all active:scale-[0.98]"
                          >
                            <Save size={14} />
                            Guardar Comentarios
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Tab 3: Payroll payments and extra receipts */}
                    {activeTab === 'payroll' && (
                      <motion.div 
                        key="payroll-tab"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="space-y-6"
                      >
                        <div className="flex flex-wrap justify-between items-center gap-3">
                          <div>
                            <h3 className="text-base font-black text-slate-900">Estatus de Pagos Mensuales</h3>
                            <p className="text-slate-400 text-xs mt-0.5">Control administrativo del sueldo base mensual ({new Date().getFullYear()}).</p>
                          </div>
                          
                          <button 
                            onClick={() => setIsAddingBonus(true)}
                            className="bg-slate-900 hover:bg-black text-white font-bold text-[11px] px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
                          >
                            <Plus size={14} />
                            Registrar Bono Extra
                          </button>
                        </div>

                        {/* Real list of salary payments */}
                        <div className="space-y-3">
                          {[
                            'Julio 2026',
                            'Junio 2026',
                            'Mayo 2026',
                            'Abril 2026'
                          ].map((monthName) => {
                            const realPayment = employeePayrolls.find(p => p.month === monthName && p.type === 'salary');
                            const isPaid = !!realPayment;
                            const amount = isPaid ? realPayment.amount : (selectedEmployee.salary || 0);
                            const dateStr = isPaid ? realPayment.date : '-';

                            return (
                              <div 
                                key={monthName} 
                                className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-4 hover:border-slate-200 transition-all"
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                                    isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                  }`}>
                                    {isPaid ? <CheckCircle size={16} /> : <Clock size={16} />}
                                  </div>
                                  <div>
                                    <span className="font-extrabold text-slate-900 text-xs block">Nómina de {monthName}</span>
                                    <span className="text-[10px] text-slate-400 font-medium block">
                                      {isPaid ? `Pagado el ${dateStr}` : 'Pendiente de liquidación'}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <span className="font-black text-slate-900 text-xs block">${amount.toFixed(2)} USD</span>
                                  <button 
                                    onClick={() => {
                                      if (!isPaid) {
                                        handlePaySalary(monthName, amount);
                                      } else {
                                        alert(`Ya se emitió el recibo de pago para ${monthName}.`);
                                      }
                                    }}
                                    className={`text-[9px] font-black uppercase tracking-wider mt-1 block hover:underline cursor-pointer ${
                                      isPaid ? 'text-slate-400' : 'text-indigo-600'
                                    }`}
                                  >
                                    {isPaid ? 'Recibo Emitido' : 'Pagar Sueldo'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* List of registered extra bonuses */}
                        {employeeBonuses.length > 0 && (
                          <div className="space-y-3 pt-4 border-t border-slate-100">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Bonos Extras y Desempeño</h4>
                            <div className="space-y-2">
                              {employeeBonuses.map((bonus, i) => (
                                <div key={bonus.id || i} className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                                      ✨
                                    </div>
                                    <div>
                                      <span className="font-bold text-slate-900 text-xs block">{bonus.reason || 'Bono Extra'}</span>
                                      <span className="text-[10px] text-slate-400 block font-medium">Registrado el {bonus.date || bonus.paidAt?.substring(0,10)}</span>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="font-black text-emerald-700 text-xs block">+${bonus.amount.toFixed(2)} USD</span>
                                    <span className="text-[9px] uppercase tracking-wider text-emerald-600 font-bold block mt-0.5">Pagado</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      </motion.div>
                    )}

                  </AnimatePresence>
                </div>

              </div>

            </div>

          </motion.div>
        )}
      </div>

      {/* REGISTRATION MODAL OVERLAY */}
      <AnimatePresence>
        {isAddingEmployee && (
          <div className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center p-0 md:p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingEmployee(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm hidden md:block"
            />

            {/* Modal Box */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-white rounded-none md:rounded-[32px] border-0 md:border md:border-slate-100 shadow-2xl w-full h-full md:h-auto md:max-w-lg overflow-hidden z-10 flex flex-col md:max-h-[90vh]"
            >
              {/* Header */}
              <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
                    <UserPlus size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">Registrar Ficha de Personal</h3>
                    <p className="text-slate-400 text-[11px]">Agrega un nuevo colaborador y genera sus credenciales PIN</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddingEmployee(false)}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-slate-300"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleAddEmployee} className="p-6 overflow-y-auto space-y-4 flex-1 pb-16">
                
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Nombre Completo *</label>
                  <input 
                    type="text" 
                    required
                    value={empName}
                    onChange={e => setEmpName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Cargo / Rol *</label>
                    <select 
                      value={empRole}
                      onChange={e => setEmpRole(e.target.value as any)}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-black"
                    >
                      <option value="waiter">Mesero / Salón</option>
                      <option value="cook">Cocinero / Cocina</option>
                      <option value="finance">Cajero / Finance</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">PIN de Turno (4-6 Dígitos) *</label>
                    <input 
                      type="password" 
                      maxLength={6}
                      required
                      value={empPin}
                      onChange={e => setEmpPin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Ej. 8492"
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-bold text-center tracking-widest font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">
                      Correo Electrónico {empRole === 'admin' ? '*' : '(Opcional)'}
                    </label>
                    <input 
                      type="email" 
                      required={empRole === 'admin'}
                      value={empEmail}
                      onChange={e => setEmpEmail(e.target.value)}
                      placeholder="Ej. juan@bistroflow.com"
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">
                      Contraseña / Clave {empRole === 'admin' ? '*' : '(Para Portal Web)'}
                    </label>
                    <input 
                      type="password"
                      required={empRole === 'admin'}
                      value={empPassword}
                      onChange={e => setEmpPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Teléfono Celular</label>
                    <input 
                      type="text" 
                      value={empPhone}
                      onChange={e => setEmpPhone(e.target.value)}
                      placeholder="Ej. +584120000000"
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Sueldo Base Mensual ($ USD) *</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                      <input 
                        type="number" 
                        min="0"
                        required
                        value={empSalary}
                        onChange={e => setEmpSalary(Number(e.target.value))}
                        className="w-full pl-8 pr-4 p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Horario de Trabajo Asignado</label>
                  <select 
                    value={empSchedule}
                    onChange={e => setEmpSchedule(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:border-black mb-2"
                  >
                    <option value="">-- Seleccionar de Plantilla --</option>
                    {schedules.map((s) => {
                      const valueStr = `${s.name} (${s.timeStart} - ${s.timeEnd})`;
                      return (
                        <option key={s.id} value={valueStr}>
                          {s.name} ({s.timeStart} - ${s.timeEnd})
                        </option>
                      );
                    })}
                    <option value="custom">-- Otro Horario Personalizado --</option>
                  </select>
                  
                  {(empSchedule === 'custom' || !schedules.some(s => `${s.name} (${s.timeStart} - ${s.timeEnd})` === empSchedule)) && (
                    <input 
                      type="text" 
                      value={empSchedule === 'custom' ? '' : empSchedule}
                      onChange={e => setEmpSchedule(e.target.value)}
                      placeholder="Ej. Martes a Domingo 12:00 - 20:00"
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold mt-1"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Sueldo Base Mensual ($ USD)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                    <input 
                      type="number" 
                      min="0"
                      required
                      value={empSalary}
                      onChange={e => setEmpSalary(Number(e.target.value))}
                      className="w-full pl-8 pr-4 p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Notas / Comentarios Internos</label>
                  <textarea 
                    value={empNotes}
                    onChange={e => setEmpNotes(e.target.value)}
                    placeholder="Observaciones de reclutamiento, aptitudes..."
                    className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold h-16 resize-none"
                  />
                </div>

                {empError && (
                  <div className="p-3.5 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-xl border border-rose-100 flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{empError}</span>
                  </div>
                )}

                {/* Submit button */}
                <button 
                  type="submit"
                  className="w-full bg-black hover:bg-slate-900 text-white p-4 rounded-xl text-xs font-bold transition-all shadow-md shadow-black/10 flex items-center justify-center gap-2 pt-3.5"
                >
                  <UserPlus size={16} />
                  Agregar Colaborador a Nómina
                </button>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDITING MODAL OVERLAY */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center p-0 md:p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm hidden md:block"
            />

            {/* Modal Box */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-white rounded-none md:rounded-[32px] border-0 md:border md:border-slate-100 shadow-2xl w-full h-full md:h-auto md:max-w-lg overflow-hidden z-10 flex flex-col md:max-h-[90vh]"
            >
              {/* Header */}
              <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Edit size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">Editar Ficha del Colaborador</h3>
                    <p className="text-slate-400 text-[11px]">Modifica los datos profesionales y salariales registrados</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-slate-300"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleUpdateEmployee} className="p-6 overflow-y-auto space-y-4 flex-1 pb-16">
                
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Nombre Completo *</label>
                  <input 
                    type="text" 
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Cargo / Rol *</label>
                    <select 
                      value={editRole}
                      onChange={e => setEditRole(e.target.value as any)}
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-black"
                    >
                      <option value="waiter">Mesero / Salón</option>
                      <option value="cook">Cocinero / Cocina</option>
                      <option value="finance">Cajero / Finance</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">PIN de Turno (4-6 Dígitos) *</label>
                    <input 
                      type="text" 
                      maxLength={6}
                      required
                      value={editPin}
                      onChange={e => setEditPin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Ej. 8492"
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-bold text-center tracking-widest font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Correo Electrónico</label>
                    <input 
                      type="email" 
                      value={editEmail}
                      onChange={e => setEditEmail(e.target.value)}
                      placeholder="Ej. juan@bistroflow.com"
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Contraseña de Portal Web</label>
                    <input 
                      type="password" 
                      value={editPassword}
                      onChange={e => setEditPassword(e.target.value)}
                      placeholder="•••••••• (dejar en blanco para no cambiar)"
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Teléfono Celular</label>
                    <input 
                      type="text" 
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      placeholder="Ej. +584120000000"
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Sueldo Base Mensual ($ USD) *</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                      <input 
                        type="number" 
                        min="0"
                        required
                        value={editSalary}
                        onChange={e => setEditSalary(Number(e.target.value))}
                        className="w-full pl-8 pr-4 p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Horario de Trabajo Asignado</label>
                  <select 
                    value={editSchedule}
                    onChange={e => setEditSchedule(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:border-black mb-2"
                  >
                    <option value="">-- Seleccionar de Plantilla --</option>
                    {schedules.map((s) => {
                      const valueStr = `${s.name} (${s.timeStart} - ${s.timeEnd})`;
                      return (
                        <option key={s.id} value={valueStr}>
                          {s.name} ({s.timeStart} - ${s.timeEnd})
                        </option>
                      );
                    })}
                    <option value="custom">-- Otro Horario Personalizado --</option>
                  </select>
                  
                  {(editSchedule === 'custom' || !schedules.some(s => `${s.name} (${s.timeStart} - ${s.timeEnd})` === editSchedule)) && (
                    <input 
                      type="text" 
                      value={editSchedule === 'custom' ? '' : editSchedule}
                      onChange={e => setEditSchedule(e.target.value)}
                      placeholder="Ej. Martes a Domingo 12:00 - 20:00"
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold mt-1"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Sueldo Base Mensual ($ USD)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                    <input 
                      type="number" 
                      min="0"
                      required
                      value={editSalary}
                      onChange={e => setEditSalary(Number(e.target.value))}
                      className="w-full pl-8 pr-4 p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Notas / Comentarios Internos</label>
                  <textarea 
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    placeholder="Observaciones de reclutamiento, aptitudes..."
                    className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold h-16 resize-none"
                  />
                </div>

                {/* Submit button */}
                <button 
                  type="submit"
                  className="w-full bg-black hover:bg-slate-900 text-white p-4 rounded-xl text-xs font-bold transition-all shadow-md shadow-black/10 flex items-center justify-center gap-2 pt-3.5"
                >
                  <Save size={16} />
                  Guardar Cambios
                </button>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EXTRA BONUS REGISTRATION MODAL */}
      <AnimatePresence>
        {isAddingBonus && selectedEmployee && (
          <div className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center p-0 md:p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingBonus(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm hidden md:block"
            />

            {/* Modal Box */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-white rounded-none md:rounded-[32px] border-0 md:border md:border-slate-100 shadow-2xl max-w-md w-full h-full md:h-auto overflow-y-auto z-10 flex flex-col justify-between pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              {/* Header */}
              <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400">
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">Registrar Bono Extra</h3>
                    <p className="text-slate-400 text-[11px]">Asignar compensación extraordinaria a {selectedEmployee.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddingBonus(false)}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-slate-300"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleRegisterBonus} className="p-6 space-y-4">
                
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Monto del Bono ($ USD) *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                    <input 
                      type="number" 
                      min="1"
                      required
                      value={bonusAmount}
                      onChange={e => setBonusAmount(Number(e.target.value))}
                      className="w-full pl-8 pr-4 p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Motivo / Descripción *</label>
                  <input 
                    type="text" 
                    required
                    value={bonusReason}
                    onChange={e => setBonusReason(e.target.value)}
                    placeholder="Ej. Desempeño sobresaliente fin de semana, Bono de puntualidad..."
                    className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Este pago se registrará de inmediato como un egreso por concepto de Nómina en Finanzas.</p>
                </div>

                {/* Submit button */}
                <button 
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 pt-3.5"
                >
                  <Check size={16} />
                  Confirmar y Pagar Bono
                </button>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD SCHEDULE MODAL OVERLAY */}
      <AnimatePresence>
        {isAddingSchedule && (
          <div className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center p-0 md:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingSchedule(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm hidden md:block"
            />

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-white rounded-none md:rounded-[32px] border-0 md:border md:border-slate-100 shadow-2xl max-w-md w-full h-full md:h-auto overflow-y-auto z-10 flex flex-col justify-between pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Clock size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">Crear Plantilla de Horario</h3>
                    <p className="text-slate-400 text-[11px]">Define un nuevo turno de trabajo para el personal</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddingSchedule(false)}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-slate-300"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddSchedule} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Nombre del Turno *</label>
                  <input 
                    type="text" 
                    required
                    value={schedName}
                    onChange={e => setSchedName(e.target.value)}
                    placeholder="Ej. Turno Fin de Semana, Turno Mediodía..."
                    className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Hora de Entrada *</label>
                    <input 
                      type="time" 
                      required
                      value={schedStart}
                      onChange={e => setSchedStart(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-bold text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Hora de Salida *</label>
                    <input 
                      type="time" 
                      required
                      value={schedEnd}
                      onChange={e => setSchedEnd(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-bold text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-2">Días Aplicables</label>
                  <div className="flex flex-wrap gap-2">
                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day) => {
                      const active = schedDays.includes(day);
                      return (
                        <button
                          type="button"
                          key={day}
                          onClick={() => handleToggleSchedDay(day)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            active 
                              ? 'bg-black text-white border-black shadow-sm' 
                              : 'bg-slate-50 text-slate-500 border-slate-200/60 hover:bg-slate-100'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-black hover:bg-slate-900 text-white p-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 pt-3.5 mt-2"
                >
                  <Plus size={16} />
                  Guardar Horario
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT SCHEDULE MODAL OVERLAY */}
      <AnimatePresence>
        {isEditingSchedule && (
          <div className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center p-0 md:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingSchedule(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm hidden md:block"
            />

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-white rounded-none md:rounded-[32px] border-0 md:border md:border-slate-100 shadow-2xl max-w-md w-full h-full md:h-auto overflow-y-auto z-10 flex flex-col justify-between pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Edit size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">Editar Plantilla de Horario</h3>
                    <p className="text-slate-400 text-[11px]">Modifica los días u horas del turno operativo</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditingSchedule(null)}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-slate-300"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdateSchedule} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Nombre del Turno *</label>
                  <input 
                    type="text" 
                    required
                    value={schedName}
                    onChange={e => setSchedName(e.target.value)}
                    placeholder="Ej. Turno Fin de Semana..."
                    className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Hora de Entrada *</label>
                    <input 
                      type="time" 
                      required
                      value={schedStart}
                      onChange={e => setSchedStart(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-bold text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5">Hora de Salida *</label>
                    <input 
                      type="time" 
                      required
                      value={schedEnd}
                      onChange={e => setSchedEnd(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-100 focus:border-black outline-none rounded-xl text-xs font-bold text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-black text-slate-400 mb-2">Días Aplicables</label>
                  <div className="flex flex-wrap gap-2">
                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day) => {
                      const active = schedDays.includes(day);
                      return (
                        <button
                          type="button"
                          key={day}
                          onClick={() => handleToggleSchedDay(day)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            active 
                              ? 'bg-black text-white border-black shadow-sm' 
                              : 'bg-slate-50 text-slate-500 border-slate-200/60 hover:bg-slate-100'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-black hover:bg-slate-900 text-white p-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 pt-3.5 mt-2"
                >
                  <Save size={16} />
                  Guardar Cambios
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
