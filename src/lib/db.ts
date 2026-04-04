// Database configuration - supports both PostgreSQL (Supabase) and SQLite (Electron/local)
// Controlled by STORAGE_MODE env var:
//   'supabase' (default) → PostgreSQL via Prisma + Supabase
//   'local' → SQLite via better-sqlite3 (for Electron / desktop app)

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

// Create a proxy that delegates to the right database
function createDbProxy(): any {
  return new Proxy({} as any, {
    get(_target, prop) {
      return async (...args: any[]) => {
        if (isLocalMode()) {
          const local = await getLocalDb();
          const model = (local as any)[String(prop)];
          if (model) return model;
          throw new Error(`Model "${String(prop)}" not found in local DB`);
        }
        const prisma = getPrisma();
        return (prisma as any)[String(prop)];
      };
    },
  });
}

export const db = createDbProxy();

// Also export the raw Prisma client for direct use when needed
export { PrismaClient, getPrisma };
