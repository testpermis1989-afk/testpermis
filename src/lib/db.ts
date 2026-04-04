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

// Create a proxy that delegates to the right database
// Supports: db.user.findUnique(...), db.category.findMany(...), etc.
function createDbProxy(): any {
  return new Proxy({} as any, {
    get(_target, prop) {
      // Return a nested proxy for each model (user, category, serie, etc.)
      return new Proxy({} as any, {
        get(_modelTarget, method) {
          // Return an async function for each method call
          return async (...args: any[]) => {
            if (isLocalMode()) {
              const local = await getLocalDb();
              const model = (local as any)[String(prop)];
              if (model && model[String(method)]) {
                const result = model[String(method)](...args);
                // Await if the method returns a Promise
                if (result && typeof result === 'object' && typeof result.then === 'function') {
                  return await result;
                }
                return result;
              }
              throw new Error(`Method "${String(prop)}.${String(method)}" not found in local DB`);
            }
            const prisma = getPrisma();
            const prismaModel = (prisma as any)[String(prop)];
            if (!prismaModel) {
              throw new Error(`Model "${String(prop)}" not found in Prisma`);
            }
            const prismaMethod = prismaModel[String(method)];
            if (!prismaMethod) {
              throw new Error(`Method "${String(prop)}.${String(method)}" not found in Prisma`);
            }
            return prismaMethod(...args);
          };
        }
      });
    }
  });
}

export const db = createDbProxy();

// Also export the raw Prisma client for direct use when needed
export { PrismaClient, getPrisma };
