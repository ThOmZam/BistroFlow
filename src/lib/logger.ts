import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function logAction(
  type: 'auth' | 'order' | 'finance' | 'system',
  actorName: string,
  action: string,
  details: string,
  metadata: any = {},
  actorRole?: string
) {
  try {
    const rawRole = actorRole || localStorage.getItem('demo_role') || '';
    const roleMap: Record<string, string> = {
      admin: 'Administrador',
      waiter: 'Mesero',
      cook: 'Cocina',
      finance: 'Caja',
      client: 'Cliente'
    };
    const mappedRole = roleMap[rawRole.toLowerCase()] || rawRole;

    await addDoc(collection(db, 'activity_logs'), {
      type,
      actorName,
      actorRole: mappedRole,
      action,
      details,
      metadata,
      timestamp: new Date().toISOString()
    }).catch(() => {
      // Silently ignore activity log write failures (e.g. offline cache conflicts)
    });
  } catch (error) {
    // Silently ignore
  }
}
