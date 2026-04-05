// Database configuration - supports both PostgreSQL (Supabase) and SQLite (Electron/local)
// Controlled by STORAGE_MODE env var:
//   'supabase' (default) → PostgreSQL via Prisma + Supabase
//   'local' → SQLite via sql.js (for Electron / desktop app)

import { PrismaClient } from '@prisma/client';

const STORAGE_MODE = (process.env.STORAGE_MODE || 'supabase') as 'supabase' | 'local';

// Prisma client for Supabase/PostgreSQL mode
let _prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient();
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
// Cloud mode: direct pass-through to Prisma (no overhead)
// Local mode: wraps local-db async methods
function createDbProxy(): any {
  return new Proxy({} as any, {
    get(_target, prop) {
      // Cloud/Supabase mode: return Prisma model directly (zero overhead)
      if (!isLocalMode()) {
        return (getPrisma() as any)[String(prop)];
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
            // Await if the method returns a Promise (all local methods are async)
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

// Also export the raw Prisma client for direct use when needed
export { PrismaClient, getPrisma };
