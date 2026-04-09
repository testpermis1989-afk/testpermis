// Database configuration - supports both PostgreSQL (Supabase) and SQLite (Electron/local)
// Controlled by STORAGE_MODE env var:
//   'supabase' (default) → PostgreSQL via Prisma + Supabase
//   'local' → SQLite via sql.js (for Electron / desktop app)
//
// IMPORTANT: Prisma is loaded LAZILY to avoid crashes in Electron/local mode
// where @prisma/client engines may not be available

const STORAGE_MODE = (process.env.STORAGE_MODE || 'supabase') as 'supabase' | 'local';

// Lazy-loaded Prisma client (only loaded when actually needed in supabase mode)
let _prisma: any = null;
async function getPrisma(): Promise<any> {
  if (!_prisma) {
    try {
      const mod = await import('@prisma/client');
      _prisma = new mod.PrismaClient();
    } catch (err) {
      console.error('Failed to load Prisma client:', err);
      throw new Error('Prisma client not available. Are you in local mode?');
    }
  }
  return _prisma;
}

// Lazy-loaded local database
let _localDb: any = null;
async function getLocalDb() {
  if (!_localDb) {
    const mod = await import('./local-db');
    _localDb = mod.localDb;
  }
  return _localDb;
}

// Check if we should use local database
function isLocalMode(): boolean {
  return STORAGE_MODE === 'local' || !!(process.env.DATABASE_URL || '').includes('file:');
}

// Create a db proxy that works for both modes
// Cloud mode: lazy load Prisma only when accessed
// Local mode: lazy load sql.js only when accessed
function createDbProxy(): any {
  return new Proxy({} as any, {
    get(_target, prop) {
      // Cloud/Supabase mode: lazy load Prisma
      if (!isLocalMode()) {
        // Return a proxy that lazily initializes Prisma
        return new Proxy({} as any, {
          async get(_modelTarget, method) {
            const prisma = await getPrisma();
            const model = (prisma as any)[String(prop)];
            if (!model) throw new Error(`Model "${String(prop)}" not found`);
            const fn = model[String(method)];
            if (!fn) throw new Error(`Method "${String(prop)}.${String(method)}" not found`);
            return fn.bind(model);
          }
        });
      }

      // Local mode: return a proxy that wraps local db methods
      return new Proxy({} as any, {
        get(_modelTarget, method) {
          return async (...args: any[]) => {
            const local = await getLocalDb();
            const model = (local as any)[String(prop)];
            if (!model) throw new Error(`Model "${String(prop)}" not found in local DB`);
            const fn = model[String(method)];
            if (!fn) throw new Error(`Method "${String(prop)}.${String(method)}" not found in local DB`);
            const result = fn(...args);
            if (result && typeof result === 'object' && typeof result.then === 'function') {
              return await result;
            }
            return result;
          };
        }
      });
    }
  });
}

export const db = createDbProxy();
