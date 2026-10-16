import { collection, getDocs, addDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from './firebase';

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    employeeId: string;
    name: string;
    role: string;
    email: string;
    pin: string;
    schedule?: string;
  };
  error?: string;
  isLocked?: boolean;
  remainingMinutes?: number;
  attemptsRemaining?: number;
}

export function persistLogin(user: { id?: string; employeeId?: string; name: string; role: string; email: string; pin: string; schedule?: string }) {
  const role = user.role || 'admin';
  localStorage.setItem('demo_role', role);
  localStorage.setItem('demo_fallback_role', role);
  localStorage.setItem('demo_employee_id', user.employeeId || user.id || ('emp-' + role));
  localStorage.setItem('demo_user_name', user.name);
  localStorage.setItem('demo_user_email', user.email);
  localStorage.setItem('demo_user_pin', user.pin);

  try {
    signInAnonymously(auth).catch(() => {});
  } catch {}

  try {
    addDoc(collection(db, 'activity_logs'), {
      module: 'security',
      action: 'LOGIN_SUCCESS',
      description: `Inicio de sesión exitoso: ${user.name} (${role.toUpperCase()})`,
      user: user.name,
      role: role,
      email: user.email,
      timestamp: new Date().toISOString()
    }).catch(() => {});
  } catch {}
}

export async function loginStaff(rawEmail: string, rawPin: string): Promise<AuthResult> {
  const cleanEmail = rawEmail.trim().toLowerCase();
  const cleanPin = rawPin.trim();

  if (!cleanEmail) {
    return { success: false, error: 'Por favor ingresa tu correo electrónico.' };
  }
  if (!cleanPin || cleanPin.length < 4) {
    return { success: false, error: 'Por favor ingresa tu PIN de acceso (mínimo 4 dígitos).' };
  }

  // 1. Authoritative check for Super Admin Thomas Zambrano (Works anywhere: Vercel, AI Studio, offline)
  if (
    (cleanEmail === 'thomaszambrano24@gmail.com' || cleanEmail === 'thomaszambrano@gmail.com') && 
    (cleanPin === '1612' || cleanPin === '1234')
  ) {
    const user = {
      id: 'admin-thomas',
      employeeId: 'admin-thomas',
      name: 'Thomas Zambrano',
      role: 'admin',
      email: cleanEmail,
      pin: cleanPin,
      schedule: 'Dirección General (08:00 - 22:00)'
    };
    persistLogin(user);
    return { success: true, user };
  }

  // 2. Authoritative check for General Admin
  if (
    cleanEmail === 'admin@bistroflow.com' && 
    (cleanPin === '1234' || cleanPin === '1612' || cleanPin === '8899')
  ) {
    const user = {
      id: 'admin-master',
      employeeId: 'admin-master',
      name: 'Gerencia General',
      role: 'admin',
      email: cleanEmail,
      pin: cleanPin,
      schedule: 'Dirección General (08:00 - 22:00)'
    };
    persistLogin(user);
    return { success: true, user };
  }

  // 3. Demo staff accounts
  if (cleanEmail === 'mesero@bistroflow.com' && cleanPin === '1234') {
    const user = {
      id: 'waiter-carlos',
      employeeId: 'waiter-carlos',
      name: 'Carlos Mesero',
      role: 'waiter',
      email: cleanEmail,
      pin: cleanPin,
      schedule: 'Turno Mañana'
    };
    persistLogin(user);
    return { success: true, user };
  }

  if (cleanEmail === 'cocina@bistroflow.com' && cleanPin === '5678') {
    const user = {
      id: 'cook-elena',
      employeeId: 'cook-elena',
      name: 'Elena Cocinera',
      role: 'cook',
      email: cleanEmail,
      pin: cleanPin,
      schedule: 'Turno Completo'
    };
    persistLogin(user);
    return { success: true, user };
  }

  if (cleanEmail === 'caja@bistroflow.com' && cleanPin === '4321') {
    const user = {
      id: 'finance-roberto',
      employeeId: 'finance-roberto',
      name: 'Roberto Cajero',
      role: 'finance',
      email: cleanEmail,
      pin: cleanPin,
      schedule: 'Turno Tarde'
    };
    persistLogin(user);
    return { success: true, user };
  }

  // 4. Try querying backend API if available (e.g. running in AI Studio with server.ts)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout so Vercel doesn't hang

    const res = await fetch('/api/auth/staff-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, pin: cleanPin }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (res.status === 429 || data.isLocked) {
        return {
          success: false,
          isLocked: true,
          remainingMinutes: data.remainingMinutes || 15,
          error: data.error || 'Acceso bloqueado por seguridad.'
        };
      }
      if (res.ok && data.success && data.user) {
        persistLogin(data.user);
        return { success: true, user: data.user };
      }
    }
  } catch {
    // API endpoint not available or network error - continue to Firestore lookup
  }

  // 5. Direct Firestore lookup in 'employees' collection (Works directly on Vercel)
  try {
    const snap = await getDocs(collection(db, 'employees'));
    const employees = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    const matched = employees.find(emp => {
      const empEmail = String(emp.email || '').trim().toLowerCase();
      const empPin = String(emp.pin || '').trim();
      const empPass = String(emp.password || '').trim();
      return empEmail === cleanEmail && (empPin === cleanPin || empPass === cleanPin);
    });

    if (matched) {
      if (matched.status === 'inactive') {
        return {
          success: false,
          error: 'El colaborador se encuentra inactivo en nómina. Comuníquese con la gerencia.'
        };
      }
      const user = {
        id: matched.id,
        employeeId: matched.employeeId || matched.id,
        name: matched.name || 'Colaborador',
        role: matched.role || 'waiter',
        email: cleanEmail,
        pin: cleanPin,
        schedule: matched.schedule || 'Turno Regular'
      };
      persistLogin(user);
      return { success: true, user };
    }
  } catch (dbErr) {
    console.warn('Firestore employee lookup warning:', dbErr);
  }

  return {
    success: false,
    error: 'Credenciales inválidas. Verifica tu correo y PIN.'
  };
}
