import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, query, where } from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      system: 'RestoFlow OS' 
    });
  });

  // Rates in-memory cache and fetcher (pyDolarVenezuela / BCV / Binance P2P)
  interface RateInfo {
    code: 'USD' | 'EUR' | 'USDT';
    name: string;
    symbol: string;
    rate: number;
    source: string;
    lastUpdated: string;
  }

  interface LiveRates {
    USD: RateInfo;
    EUR: RateInfo;
    USDT: RateInfo;
  }

  let cachedRates: LiveRates = {
    USD: { code: 'USD', name: 'BCV Dólar', symbol: '$', rate: 874.73, source: 'BCV Oficial', lastUpdated: new Date().toISOString() },
    EUR: { code: 'EUR', name: 'BCV Euro', symbol: '€', rate: 979.08, source: 'BCV Oficial', lastUpdated: new Date().toISOString() },
    USDT: { code: 'USDT', name: 'USDT Cripto (Binance P2P)', symbol: 'USDT', rate: 1017.00, source: 'Binance P2P / Mercado', lastUpdated: new Date().toISOString() }
  };
  let lastRatesFetchTime = 0;
  const RATES_CACHE_TTL = 60 * 1000; // 1 minute

  async function fetchLiveExchangeRates(force = false): Promise<LiveRates> {
    if (!force && Date.now() - lastRatesFetchTime < RATES_CACHE_TTL) {
      return cachedRates;
    }

    // 1. Fetch BCV USD & Paralelo
    try {
      const dRes = await fetch('https://ve.dolarapi.com/v1/dolares', { signal: AbortSignal.timeout(4000) });
      if (dRes.ok) {
        const dData: any = await dRes.json();
        if (Array.isArray(dData)) {
          const oficial = dData.find((d: any) => d.fuente === 'oficial') || dData[0];
          if (oficial && typeof oficial.promedio === 'number' && oficial.promedio > 0) {
            cachedRates.USD.rate = Math.round(oficial.promedio * 100) / 100;
            cachedRates.USD.lastUpdated = oficial.fechaActualizacion || new Date().toISOString();
          }
        }
      }
    } catch (e: any) {
      console.warn('Could not fetch USD rate from primary source:', e.message);
    }

    // 2. Fetch BCV EUR
    try {
      const eRes = await fetch('https://ve.dolarapi.com/v1/euros', { signal: AbortSignal.timeout(4000) });
      if (eRes.ok) {
        const eData: any = await eRes.json();
        if (Array.isArray(eData)) {
          const oficial = eData.find((e: any) => e.fuente === 'oficial') || eData[0];
          if (oficial && typeof oficial.promedio === 'number' && oficial.promedio > 0) {
            cachedRates.EUR.rate = Math.round(oficial.promedio * 100) / 100;
            cachedRates.EUR.lastUpdated = oficial.fechaActualizacion || new Date().toISOString();
          }
        }
      }
    } catch (e: any) {
      console.warn('Could not fetch EUR rate from primary source:', e.message);
    }

    // 3. Fetch Binance P2P USDT rate
    try {
      const bRes = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiat: 'VES', page: 1, rows: 5, tradeType: 'BUY', asset: 'USDT' }),
        signal: AbortSignal.timeout(4000)
      });
      if (bRes.ok) {
        const bData: any = await bRes.json();
        const rawPrice = bData?.data?.[0]?.adv?.price;
        const numPrice = Number(rawPrice);
        if (numPrice && numPrice > 0) {
          cachedRates.USDT.rate = Math.round(numPrice * 100) / 100;
          cachedRates.USDT.lastUpdated = new Date().toISOString();
        }
      }
    } catch (e: any) {
      // Fallback: Use paralelo USD if Binance fails
      try {
        const dRes = await fetch('https://ve.dolarapi.com/v1/dolares', { signal: AbortSignal.timeout(3000) });
        if (dRes.ok) {
          const dData: any = await dRes.json();
          const paralelo = dData.find((d: any) => d.fuente === 'paralelo');
          if (paralelo && typeof paralelo.promedio === 'number' && paralelo.promedio > 0) {
            cachedRates.USDT.rate = Math.round(paralelo.promedio * 100) / 100;
            cachedRates.USDT.lastUpdated = paralelo.fechaActualizacion || new Date().toISOString();
          }
        }
      } catch {}
    }

    // 4. Try pyDolarVenezuela direct API if accessible
    try {
      const pyRes = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar', { signal: AbortSignal.timeout(3000) });
      if (pyRes.ok) {
        const pyData: any = await pyRes.json();
        if (pyData?.monitors) {
          if (pyData.monitors.bcv?.price) {
            cachedRates.USD.rate = Math.round(pyData.monitors.bcv.price * 100) / 100;
          }
          if (pyData.monitors.enparalelovzla?.price && !cachedRates.USDT.rate) {
            cachedRates.USDT.rate = Math.round(pyData.monitors.enparalelovzla.price * 100) / 100;
          }
        }
      }
    } catch {}

    lastRatesFetchTime = Date.now();
    return cachedRates;
  }

  // GET /api/exchange-rates
  app.get('/api/exchange-rates', async (req, res) => {
    try {
      const rates = await fetchLiveExchangeRates(req.query.force === 'true');
      res.json({
        success: true,
        rates,
        lastUpdated: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Error fetching exchange rates',
        rates: cachedRates
      });
    }
  });

  // POST /api/exchange-rates/refresh
  app.post('/api/exchange-rates/refresh', async (req, res) => {
    try {
      const rates = await fetchLiveExchangeRates(true);
      res.json({
        success: true,
        rates,
        lastUpdated: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Error refreshing exchange rates',
        rates: cachedRates
      });
    }
  });

  // Server-side Authoritative Bill & Price Calculator (Principle 2, 3, 4)
  // All monetary values computed in integer cents to prevent floating point inaccuracy
  app.post('/api/orders/calculate-bill', (req, res) => {
    try {
      const { items, servicePercent = 10, exchangeRate = 40, tipUSD = 0, currency = 'USD', usdRate = 874.73, activeRate = 40 } = req.body;

      if (!Array.isArray(items)) {
        return res.status(400).json({ 
          success: false, 
          error: 'items must be an array' 
        });
      }

      let subtotalCents = 0;
      const auditedItems = items.map((item: any) => {
        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const unitPriceUSD = Number(item.price) || 0;
        const unitPriceCents = Math.round(unitPriceUSD * 100);
        
        let extrasCents = 0;
        if (Array.isArray(item.extras)) {
          for (const extra of item.extras) {
            const extraPrice = Number(extra.price) || 0;
            extrasCents += Math.round(extraPrice * 100);
          }
        }

        const lineTotalCents = (unitPriceCents + extrasCents) * qty;
        subtotalCents += lineTotalCents;

        return {
          itemName: String(item.itemName || item.name || 'Item'),
          quantity: qty,
          unitPriceCents,
          extrasCents,
          lineTotalCents,
          lineTotalUSD: lineTotalCents / 100
        };
      });

      const effectiveServicePercent = Math.max(0, Math.min(100, Number(servicePercent) || 0));
      const serviceChargeCents = Math.round((subtotalCents * effectiveServicePercent) / 100);
      const tipCents = Math.max(0, Math.round((Number(tipUSD) || 0) * 100));
      const totalCents = subtotalCents + serviceChargeCents + tipCents;

      const rate = Math.max(0.0001, Number(exchangeRate) || 40);
      const totalUSD = totalCents / 100;
      
      // Calculate total in active currency
      let totalCurrency = totalUSD;
      let currencySymbol = '$';
      if (currency === 'EUR') {
        currencySymbol = '€';
        const numUsdRate = Number(usdRate) || 874.73;
        const numEurRate = Number(activeRate) || 979.08;
        totalCurrency = (totalUSD * numUsdRate) / numEurRate;
      } else if (currency === 'USDT') {
        currencySymbol = 'USDT';
        totalCurrency = totalUSD; // 1:1 reference
      }

      // Authoritative Bolívares total
      const totalBs = (totalCents * rate) / 100;

      return res.json({
        success: true,
        currency,
        currencySymbol,
        auditedItems,
        subtotalCents,
        subtotalUSD: subtotalCents / 100,
        serviceChargeCents,
        serviceChargeUSD: serviceChargeCents / 100,
        tipCents,
        tipUSD: tipCents / 100,
        totalCents,
        totalUSD,
        totalCurrency: Math.round(totalCurrency * 100) / 100,
        totalBs: Math.round(totalBs * 100) / 100,
        exchangeRate: rate
      });
    } catch (err: any) {
      console.error('Error in calculate-bill:', err);
      return res.status(500).json({ 
        success: false, 
        error: err.message || 'Internal server error calculating bill' 
      });
    }
  });

  // Server-side Cash Reconciliation Endpoint (Principle 2, 4)
  app.post('/api/shift/reconcile', (req, res) => {
    try {
      const { 
        initialCashUSDCents = 0, 
        initialCashBsCents = 0,
        transactions = [],
        countedCashUSDCents = 0,
        countedCashBsCents = 0
      } = req.body;

      let salesCashUSDCents = 0;
      let salesCashBsCents = 0;

      for (const tx of transactions) {
        const method = String(tx.method || '').toLowerCase();
        const amtUSD = Number(tx.amount) || 0;
        const amtBs = Number(tx.amountBs) || 0;

        if (method === 'efectivo' || method === 'cash' || method === 'efectivo_usd') {
          salesCashUSDCents += Math.round(amtUSD * 100);
        } else if (method === 'efectivo_bs') {
          salesCashBsCents += Math.round(amtBs * 100);
        }
      }

      const expectedCashUSDCents = initialCashUSDCents + salesCashUSDCents;
      const expectedCashBsCents = initialCashBsCents + salesCashBsCents;

      const diffUSDCents = countedCashUSDCents - expectedCashUSDCents;
      const diffBsCents = countedCashBsCents - expectedCashBsCents;

      return res.json({
        success: true,
        expected: {
          cashUSDCents: expectedCashUSDCents,
          cashUSD: expectedCashUSDCents / 100,
          cashBsCents: expectedCashBsCents,
          cashBs: expectedCashBsCents / 100
        },
        difference: {
          diffUSDCents,
          diffUSD: diffUSDCents / 100,
          diffBsCents,
          diffBs: diffBsCents / 100,
          isBalanced: diffUSDCents === 0 && diffBsCents === 0
        }
      });
    } catch (err: any) {
      return res.status(500).json({ 
        success: false, 
        error: err.message || 'Internal server error reconciling shift' 
      });
    }
  });

  // --- SERVER-SIDE AUTHENTICATION & ANTI-BRUTE-FORCE SHIELD ---
  // Connect to Firestore authoritatively on the backend
  let db: any = null;
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const fbApp = getApps().length === 0 ? initializeApp(cfg) : getApps()[0];
      db = getFirestore(fbApp, cfg.firestoreDatabaseId);
      console.log('[RestoFlow OS] Authoritative Server Firestore initialized');
    }
  } catch (dbErr: any) {
    console.warn('[RestoFlow OS] Server Firestore init warning:', dbErr.message);
  }

  // Rate Limiting & Lockout Registry
  interface RateLimitEntry {
    attempts: number;
    firstAttemptAt: number;
    lockedUntil: number;
  }
  const rateLimitMap = new Map<string, RateLimitEntry>();
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

  // Ensure an Admin account exists so initial setup is secure
  async function ensureAdminExists() {
    if (!db) return;
    try {
      const snap = await getDocs(collection(db, 'employees'));
      const hasAdmin = snap.docs.some(d => d.data().role === 'admin');
      if (!hasAdmin) {
        await addDoc(collection(db, 'employees'), {
          name: 'Administrador General',
          role: 'admin',
          email: 'admin@bistroflow.com',
          password: 'admin@bistroflow',
          pin: '8899',
          schedule: 'Turno Completo (08:00 - 22:00)',
          salary: 600,
          phone: '+58 412 0000000',
          notes: 'Cuenta administrativa autorizada principal de BistroFlow',
          status: 'active',
          createdAt: new Date().toISOString()
        });
        console.log('[RestoFlow OS] Master admin account bootstrapped securely');
      }
    } catch (e: any) {
      console.warn('[RestoFlow OS] Admin bootstrap warning:', e.message);
    }
  }
  ensureAdminExists().catch(() => {});

  // GET /api/auth/status - Query lockout state for the client
  app.get('/api/auth/status', (req, res) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
    const record = rateLimitMap.get(ip);
    const now = Date.now();
    if (record && record.lockedUntil > now) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return res.json({
        isLocked: true,
        remainingSeconds,
        remainingMinutes: Math.ceil(remainingSeconds / 60)
      });
    }
    const attempts = record?.attempts || 0;
    return res.json({
      isLocked: false,
      attemptsRemaining: Math.max(0, MAX_LOGIN_ATTEMPTS - attempts)
    });
  });

  // POST /api/auth/staff-login - Authoritative login with strict anti-brute-force rate limiting
  app.post('/api/auth/staff-login', async (req, res) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const record = rateLimitMap.get(ip) || { attempts: 0, firstAttemptAt: now, lockedUntil: 0 };

    // 1. Check if client IP is locked
    if (record.lockedUntil > now) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return res.status(429).json({
        success: false,
        error: `Acceso temporalmente bloqueado por seguridad. Se detectaron múltiples intentos erróneos. Intenta en ${Math.ceil(remainingSeconds / 60)} minuto(s).`,
        isLocked: true,
        remainingSeconds,
        remainingMinutes: Math.ceil(remainingSeconds / 60)
      });
    }

    // Reset attempt counter if 15 min passed since first attempt
    if (now - record.firstAttemptAt > LOCKOUT_DURATION_MS && record.lockedUntil <= now) {
      record.attempts = 0;
      record.firstAttemptAt = now;
      record.lockedUntil = 0;
    }

    // 2. Progressive timing jitter (400ms - 750ms) to prevent microsecond bot attacks
    await new Promise(r => setTimeout(r, 400 + Math.floor(Math.random() * 350)));

    const { type, email, password, pin } = req.body;

    if (!type || (type !== 'credentials' && type !== 'pin')) {
      return res.status(400).json({
        success: false,
        error: 'Método de autenticación inválido. Utilice "credentials" o "pin".'
      });
    }

    try {
      if (!db) {
        return res.status(500).json({
          success: false,
          error: 'Servicio de base de datos no disponible.'
        });
      }

      const snap = await getDocs(collection(db, 'employees'));
      const employees = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      let matchedEmployee: any = null;

      if (type === 'credentials') {
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanPass = String(password || '');

        if (!cleanEmail || !cleanPass) {
          return res.status(400).json({
            success: false,
            error: 'Debe ingresar correo y contraseña.'
          });
        }

        matchedEmployee = employees.find(emp => {
          const empEmail = String(emp.email || '').trim().toLowerCase();
          const empPass = String(emp.password || '');
          return empEmail === cleanEmail && empPass === cleanPass;
        });
      } else if (type === 'pin') {
        const cleanPin = String(pin || '').trim();
        if (!cleanPin || cleanPin.length < 4) {
          return res.status(400).json({
            success: false,
            error: 'Debe ingresar un PIN de al menos 4 dígitos.'
          });
        }

        matchedEmployee = employees.find(emp => String(emp.pin || '').trim() === cleanPin);
      }

      // Check if employee exists and is active
      if (matchedEmployee) {
        if (matchedEmployee.status === 'inactive') {
          return res.status(403).json({
            success: false,
            error: 'El colaborador se encuentra inactivo en nómina. Comuníquese con la gerencia.'
          });
        }

        // Authentication SUCCESS! Reset rate limit
        rateLimitMap.delete(ip);

        // Audit Trail: Log to activity_logs
        try {
          await addDoc(collection(db, 'activity_logs'), {
            module: 'security',
            action: 'LOGIN_SUCCESS',
            userName: matchedEmployee.name,
            role: matchedEmployee.role,
            details: `Acceso concedido vía ${type === 'credentials' ? 'Correo/Contraseña' : 'PIN de Servicio'}`,
            ip,
            timestamp: new Date().toISOString()
          });
        } catch {}

        const sessionToken = `sess_${crypto.randomUUID()}`;

        return res.json({
          success: true,
          message: 'Autenticación exitosa',
          token: sessionToken,
          user: {
            id: matchedEmployee.id,
            employeeId: matchedEmployee.id,
            name: matchedEmployee.name,
            role: matchedEmployee.role,
            email: matchedEmployee.email || '',
            schedule: matchedEmployee.schedule || ''
          }
        });
      }

      // Authentication FAILED! Increment counter
      record.attempts += 1;
      if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
        record.lockedUntil = now + LOCKOUT_DURATION_MS;
      }
      rateLimitMap.set(ip, record);

      // Audit Trail: Log failed attempt
      try {
        await addDoc(collection(db, 'activity_logs'), {
          module: 'security',
          action: 'LOGIN_FAILED',
          userName: (type === 'credentials' ? email : `PIN: ***`) || 'Desconocido',
          details: `Intento fallido (${record.attempts}/${MAX_LOGIN_ATTEMPTS})${record.attempts >= MAX_LOGIN_ATTEMPTS ? ' - BLOQUEO DE SEGURIDAD ACTIVADO' : ''}`,
          ip,
          timestamp: new Date().toISOString()
        });
      } catch {}

      if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
        return res.status(429).json({
          success: false,
          error: 'Demasiados intentos erróneos. Bloqueo de seguridad activado por 15 minutos.',
          isLocked: true,
          remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
          remainingMinutes: 15
        });
      }

      const attemptsRemaining = MAX_LOGIN_ATTEMPTS - record.attempts;
      return res.status(401).json({
        success: false,
        error: `Credenciales inválidas. Te quedan ${attemptsRemaining} intento(s) antes del bloqueo.`,
        attemptsRemaining,
        isLocked: false
      });
    } catch (err: any) {
      console.error('[RestoFlow OS] Staff login error:', err);
      return res.status(500).json({
        success: false,
        error: 'Error interno en el servidor de autenticación.'
      });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
