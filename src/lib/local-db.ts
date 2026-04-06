// Local database adapter using sql.js (pure JavaScript/WASM SQLite)
// No native compilation needed - works everywhere including Electron
// This provides the same interface as Prisma for common operations

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');

function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('file:')) {
    let dbPath = dbUrl.replace(/^file:/, '');
    if (!dbPath.startsWith('/') && !dbPath.match(/^[A-Z]:/i)) {
      dbPath = path.join(/*turbopackIgnore: true*/ process.cwd(), dbPath);
    }
    return dbPath;
  }
  return path.join(/*turbopackIgnore: true*/ DATA_DIR, 'permis.db');
}

// =====================================================
// sql.js wrapper - mimics better-sqlite3 API (async)
// =====================================================

let _sqlJsFactory: any = null;
let _sqlJsInitPromise: Promise<any> | null = null;

async function getSqlJs() {
  if (_sqlJsFactory) return _sqlJsFactory;
  if (!_sqlJsInitPromise) {
    // Try to locate the WASM binary
    const wasmSearchPaths = [
      path.join(/*turbopackIgnore: true*/ process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
      path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'sql-wasm.wasm'),
      path.join(__dirname, '..', '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
      // Electron packaged: resources/app/app-server/public/
      path.join(__dirname, '..', '..', '..', '..', 'public', 'sql-wasm.wasm'),
    ];

    let wasmPath: string | undefined;
    for (const p of wasmSearchPaths) {
      if (fs.existsSync(p)) {
        wasmPath = p;
        break;
      }
    }

    if (wasmPath) {
      const wasmBuffer = fs.readFileSync(wasmPath);
      _sqlJsInitPromise = initSqlJs({ wasmBinary: new Uint8Array(wasmBuffer) });
    } else {
      // Fallback: let sql.js find the WASM file itself
      _sqlJsInitPromise = initSqlJs();
    }
  }
  _sqlJsFactory = await _sqlJsInitPromise;
  return _sqlJsFactory;
}

interface PreparedStmt {
  get(...params: any[]): Promise<Record<string, any> | undefined>;
  all(...params: any[]): Promise<Record<string, any>[]>;
  run(...params: any[]): Promise<{ changes: number }>;
}

class Database {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private dirty = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async init() {
    if (this.db) return;
    const SQL = await getSqlJs();
    let buffer: Uint8Array | undefined;
    try {
      if (fs.existsSync(this.dbPath)) {
        buffer = new Uint8Array(fs.readFileSync(this.dbPath));
      }
    } catch (e) {
      console.warn('Could not load existing database, creating new one:', e);
    }
    this.db = new SQL.Database(buffer);
  }

  async pragma(statement: string): Promise<void> {
    await this.init();
    try {
      this.db!.run(`PRAGMA ${statement}`);
    } catch (e) {
      // Some pragmas like WAL are not supported by sql.js - silently ignore
      console.debug(`Pragma "${statement}" not supported or failed:`, e);
    }
  }

  async exec(sql: string): Promise<void> {
    await this.init();
    this.db!.run(sql);
    this.markDirty();
  }

  async prepare(sql: string): Promise<PreparedStmt> {
    await this.init();
    const stmt = this.db!.prepare(sql);
    // Store reference to markDirty for use in closures (avoids `this` binding issues)
    const markDirty = () => this.markDirty();
    return {
      async get(...params: any[]): Promise<Record<string, any> | undefined> {
        try {
          if (params.length > 0) stmt.bind(params as any[]);
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          stmt.free();
        }
      },
      async all(...params: any[]): Promise<Record<string, any>[]> {
        try {
          const results: Record<string, any>[] = [];
          if (params.length > 0) stmt.bind(params as any[]);
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          return results;
        } finally {
          stmt.free();
        }
      },
      async run(...params: any[]): Promise<{ changes: number }> {
        try {
          if (params.length > 0) stmt.bind(params as any[]);
          stmt.step();
          const changes = this.db ? this.db.getRowsModified() : 0;
          markDirty();
          return { changes };
        } finally {
          stmt.free();
        }
      }
    };
  }

  private markDirty() {
    if (this.dirty) return;
    this.dirty = true;
    // Debounced save
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.save();
      this.dirty = false;
      this.saveTimeout = null;
    }, 500);
  }

  save(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dbPath, Buffer.from(data));
    } catch (e) {
      console.error('Failed to save database:', e);
    }
  }

  close(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}

let _db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!_db) {
    const dbPath = getDbPath();
    _db = new Database(dbPath);
    await _db.pragma('journal_mode = WAL');
    await _db.pragma('foreign_keys = ON');
    await initTables(_db);
  }
  return _db;
}

async function initTables(db: Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT PRIMARY KEY,
      "cin" TEXT NOT NULL UNIQUE,
      "password" TEXT NOT NULL DEFAULT '1234',
      "nomFr" TEXT,
      "prenomFr" TEXT,
      "nomAr" TEXT,
      "prenomAr" TEXT,
      "photo" TEXT,
      "permisCategory" TEXT NOT NULL DEFAULT 'B',
      "examDate" TEXT,
      "pinCode" TEXT NOT NULL DEFAULT '',
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "role" TEXT NOT NULL DEFAULT 'user',
      "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
      "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS "Category" (
      "id" TEXT PRIMARY KEY,
      "code" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "nameAr" TEXT,
      "seriesCount" INTEGER NOT NULL DEFAULT 10,
      "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
      "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS "Serie" (
      "id" TEXT PRIMARY KEY,
      "number" INTEGER NOT NULL,
      "categoryId" TEXT NOT NULL,
      "questionsCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
      "updatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE,
      UNIQUE("categoryId", "number")
    );

    CREATE TABLE IF NOT EXISTS "Question" (
      "id" TEXT PRIMARY KEY,
      "serieId" TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      "text" TEXT,
      "image" TEXT,
      "audio" TEXT,
      "video" TEXT,
      "duration" INTEGER NOT NULL DEFAULT 30,
      "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
      "updatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY ("serieId") REFERENCES "Serie"("id") ON DELETE CASCADE,
      UNIQUE("serieId", "order")
    );

    CREATE TABLE IF NOT EXISTS "Response" (
      "id" TEXT PRIMARY KEY,
      "questionId" TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      "text" TEXT,
      "image" TEXT,
      "isCorrect" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
      "updatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE,
      UNIQUE("questionId", "order")
    );

    CREATE TABLE IF NOT EXISTS "TestResult" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT,
      "categoryId" TEXT NOT NULL,
      "serieNumber" INTEGER NOT NULL,
      "score" INTEGER NOT NULL,
      "total" INTEGER NOT NULL,
      "passed" INTEGER NOT NULL DEFAULT 0,
      "answers" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS "Activation" (
      "id" TEXT PRIMARY KEY,
      "activationCode" TEXT NOT NULL,
      "machineCode" TEXT NOT NULL,
      "machineHash" TEXT NOT NULL,
      "durationCode" TEXT NOT NULL,
      "durationLabel" TEXT NOT NULL,
      "expiryDate" TEXT NOT NULL,
      "activatedAt" TEXT NOT NULL,
      "expiresAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "License" (
      "id" TEXT PRIMARY KEY,
      "machineCode" TEXT NOT NULL,
      "activationCode" TEXT NOT NULL UNIQUE,
      "clientName" TEXT,
      "durationCode" TEXT NOT NULL,
      "durationLabel" TEXT NOT NULL,
      "durationDays" INTEGER NOT NULL,
      "expiryDate" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// Helper to convert SQLite boolean (0/1) to JS boolean
function bool(v: number | null | undefined): boolean {
  return v === 1 || v === true;
}

// CUID generator
function cuid(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `c${timestamp}${random}`;
}

// =====================================================
// LOCAL DB - provides same interface as Prisma db
// All methods are async (compatible with Prisma's Promise-based API)
// =====================================================

export const localDb = {
  // Users
  user: {
    findUnique: async (args: { where: { id?: string; cin?: string } }) => {
      const db = await getDb();
      if (args.where.id) {
        const row = await (await db.prepare('SELECT * FROM "User" WHERE id = ?')).get(args.where.id);
        return row ? { ...row, isActive: bool(row.isActive) } : null;
      }
      if (args.where.cin) {
        const row = await (await db.prepare('SELECT * FROM "User" WHERE cin = ?')).get(args.where.cin);
        return row ? { ...row, isActive: bool(row.isActive) } : null;
      }
      return null;
    },
    findMany: async (args?: { where?: { isActive?: boolean }; orderBy?: any; select?: any }) => {
      const db = await getDb();
      let sql = 'SELECT * FROM "User"';
      const params: any[] = [];
      if (args?.where?.isActive !== undefined) {
        sql += ' WHERE isActive = ?';
        params.push(args.where.isActive ? 1 : 0);
      }
      sql += ' ORDER BY createdAt DESC';
      const rows = await (await db.prepare(sql)).all(...params);
      return rows.map((r: any) => ({ ...r, isActive: bool(r.isActive) }));
    },
    create: async (args: { data: any }) => {
      const db = await getDb();
      const id = args.data.id || cuid();
      const now = new Date().toISOString();
      await (await db.prepare(
        `INSERT INTO "User" (id, cin, password, nomFr, prenomFr, nomAr, prenomAr, photo, permisCategory, examDate, pinCode, isActive, role, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )).run(
        id, args.data.cin, args.data.password || '1234',
        args.data.nomFr || null, args.data.prenomFr || null,
        args.data.nomAr || null, args.data.prenomAr || null,
        args.data.photo || null, args.data.permisCategory || 'B',
        args.data.examDate || null, args.data.pinCode || '',
        args.data.isActive !== false ? 1 : 0, args.data.role || 'user',
        now, now
      );
      return { ...args.data, id, createdAt: now, updatedAt: now, isActive: args.data.isActive !== false };
    },
    update: async (args: { where: { id?: string; cin?: string }; data: any }) => {
      const db = await getDb();
      const user = await localDb.user.findUnique({ where: args.where });
      if (!user) throw new Error('User not found');
      const sets: string[] = [];
      const params: any[] = [];
      const fields = ['nomFr', 'prenomFr', 'nomAr', 'prenomAr', 'photo', 'permisCategory', 'examDate', 'pinCode', 'password', 'role'];
      for (const f of fields) {
        if (args.data[f] !== undefined) {
          sets.push(`"${f}" = ?`);
          params.push(args.data[f]);
        }
      }
      if (args.data.isActive !== undefined) {
        sets.push('"isActive" = ?');
        params.push(args.data.isActive ? 1 : 0);
      }
      sets.push('"updatedAt" = ?');
      params.push(new Date().toISOString());
      params.push(user.id);
      await (await db.prepare(`UPDATE "User" SET ${sets.join(', ')} WHERE id = ?`)).run(...params);
      return localDb.user.findUnique({ where: { id: user.id } });
    },
    delete: async (args: { where: { id?: string; cin?: string } }) => {
      const db = await getDb();
      if (args.where.cin) {
        await (await db.prepare('DELETE FROM "User" WHERE cin = ?')).run(args.where.cin);
      } else if (args.where.id) {
        await (await db.prepare('DELETE FROM "User" WHERE id = ?')).run(args.where.id);
      }
    },
    deleteMany: async (args: { where: any }) => {
      const db = await getDb();
      if (args.where?.cin) {
        await (await db.prepare('DELETE FROM "User" WHERE cin = ?')).run(args.where.cin);
      }
      return { count: 0 };
    },
    count: async (args?: { where?: any }) => {
      const db = await getDb();
      const sql = args?.where?.role
        ? 'SELECT COUNT(*) as count FROM "User" WHERE role = ?'
        : 'SELECT COUNT(*) as count FROM "User"';
      const params = args?.where?.role ? [args.where.role] : [];
      const result = await (await db.prepare(sql)).get(...params);
      return result?.count || 0;
    },
  },

  // Categories
  category: {
    findUnique: async (args: { where: { id?: string; code?: string }; include?: any }) => {
      const db = await getDb();
      if (args.where.code) {
        const row = await (await db.prepare('SELECT * FROM "Category" WHERE code = ?')).get(args.where.code);
        if (!row) return null;
        if (args.include?.series) {
          return { ...row, series: await localDb.serie.findMany({ where: { categoryId: row.id }, _includeQuestions: !!args.include.series.questions }) };
        }
        return row;
      }
      if (args.where.id) {
        const row = await (await db.prepare('SELECT * FROM "Category" WHERE id = ?')).get(args.where.id);
        if (!row) return null;
        if (args.include?.series) {
          return { ...row, series: await localDb.serie.findMany({ where: { categoryId: row.id }, _includeQuestions: !!args.include.series.questions }) };
        }
        return row;
      }
      return null;
    },
    findMany: async (args?: { include?: any; orderBy?: any }) => {
      const db = await getDb();
      const rows = await (await db.prepare('SELECT * FROM "Category" ORDER BY code')).all();
      if (args?.include?.series) {
        return Promise.all(rows.map(async (row: any) => ({
          ...row,
          series: await localDb.serie.findMany({ where: { categoryId: row.id }, _includeQuestions: !!args.include.series.questions, _includeCount: !!args.include.series._count })
        })));
      }
      return rows;
    },
    create: async (args: { data: any }) => {
      const db = await getDb();
      const id = args.data.id || cuid();
      const now = new Date().toISOString();
      await (await db.prepare(
        `INSERT INTO "Category" (id, code, name, nameAr, seriesCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )).run(id, args.data.code, args.data.name, args.data.nameAr || null, args.data.seriesCount || 10, now, now);
      return { ...args.data, id, createdAt: now, updatedAt: now };
    },
    update: async (args: { where: { id: string }; data: any }) => {
      const db = await getDb();
      const sets: string[] = [];
      const params: any[] = [];
      for (const f of ['code', 'name', 'nameAr', 'seriesCount']) {
        if (args.data[f] !== undefined) {
          sets.push(`"${f}" = ?`);
          params.push(args.data[f]);
        }
      }
      sets.push('"updatedAt" = ?');
      params.push(new Date().toISOString());
      params.push(args.where.id);
      await (await db.prepare(`UPDATE "Category" SET ${sets.join(', ')} WHERE id = ?`)).run(...params);
      return localDb.category.findUnique({ where: { id: args.where.id } });
    },
    deleteMany: async () => ({ count: 0 }),
    delete: async () => ({ count: 0 }),
    count: async () => {
      const db = await getDb();
      const result = await (await db.prepare('SELECT COUNT(*) as count FROM "Category"')).get();
      return result?.count || 0;
    },
  },

  // Series
  serie: {
    findFirst: async (args: { where: { categoryId: string; number: number } }) => {
      const db = await getDb();
      const row = await (await db.prepare('SELECT * FROM "Serie" WHERE categoryId = ? AND number = ?'))
        .get(args.where.categoryId, args.where.number);
      return (row as any) || null;
    },
    findMany: async (args: { where: { categoryId: string }; _includeQuestions?: boolean; _includeCount?: boolean; orderBy?: any }) => {
      const db = await getDb();
      const rows = await (await db.prepare('SELECT * FROM "Serie" WHERE categoryId = ? ORDER BY number'))
        .all(args.where.categoryId);
      if (args._includeQuestions) {
        return Promise.all(rows.map(async (row: any) => ({
          ...row,
          questions: await localDb.question.findMany({ where: { serieId: row.id } })
        })));
      }
      if (args._includeCount) {
        return rows.map((row: any) => ({
          ...row,
          _count: { questions: row.questionsCount || 0 }
        }));
      }
      return rows;
    },
    create: async (args: { data: any }) => {
      const db = await getDb();
      const id = args.data.id || cuid();
      const now = new Date().toISOString();
      await (await db.prepare(
        `INSERT INTO "Serie" (id, number, categoryId, questionsCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`
      )).run(id, args.data.number, args.data.categoryId, args.data.questionsCount || 0, now, now);
      return { ...args.data, id, createdAt: now, updatedAt: now };
    },
    update: async (args: { where: { id: string }; data: any }) => {
      const db = await getDb();
      const sets: string[] = [];
      const params: any[] = [];
      if (args.data.questionsCount !== undefined) {
        sets.push('"questionsCount" = ?');
        params.push(args.data.questionsCount);
      }
      sets.push('"updatedAt" = ?');
      params.push(new Date().toISOString());
      params.push(args.where.id);
      await (await db.prepare(`UPDATE "Serie" SET ${sets.join(', ')} WHERE id = ?`)).run(...params);
      return { id: args.where.id, ...args.data };
    },
    delete: async (args: { where: { id: string } }) => {
      const db = await getDb();
      await (await db.prepare('DELETE FROM "Serie" WHERE id = ?')).run(args.where.id);
    },
    deleteMany: async (args: { where: { serieId?: string; categoryId?: string } }) => {
      const db = await getDb();
      if (args.where?.serieId) {
        await (await db.prepare('DELETE FROM "Serie" WHERE id = ?')).run(args.where.serieId);
      }
      if (args.where?.categoryId) {
        await (await db.prepare('DELETE FROM "Serie" WHERE categoryId = ?')).run(args.where.categoryId);
      }
      return { count: 0 };
    },
  },

  // Questions
  question: {
    findMany: async (args: { where: { serieId: string }; orderBy?: { order: 'asc' | 'desc' }; include?: any }) => {
      const db = await getDb();
      const order = args.orderBy?.order === 'desc' ? 'DESC' : 'ASC';
      const rows = await (await db.prepare(`SELECT * FROM "Question" WHERE serieId = ? ORDER BY "order" ${order}`))
        .all(args.where.serieId);
      if (args.include?.responses) {
        return Promise.all(rows.map(async (row: any) => ({
          ...row,
          responses: await localDb.response.findMany({ where: { questionId: row.id } })
        })));
      }
      return rows;
    },
    create: async (args: { data: any }) => {
      const db = await getDb();
      const id = args.data.id || cuid();
      const now = new Date().toISOString();
      await (await db.prepare(
        `INSERT INTO "Question" (id, serieId, "order", text, image, audio, video, duration, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )).run(id, args.data.serieId, args.data.order, args.data.text || '', args.data.image || null, args.data.audio || '', args.data.video || null, args.data.duration || 30, now, now);
      return { ...args.data, id, createdAt: now, updatedAt: now };
    },
    update: async (args: { where: { id: string }; data: any }) => {
      const db = await getDb();
      const sets: string[] = [];
      const params: any[] = [];
      for (const f of ['text', 'image', 'audio', 'video', 'duration', 'order']) {
        if (args.data[f] !== undefined) {
          sets.push(`"${f}" = ?`);
          params.push(args.data[f]);
        }
      }
      sets.push('"updatedAt" = ?');
      params.push(new Date().toISOString());
      params.push(args.where.id);
      await (await db.prepare(`UPDATE "Question" SET ${sets.join(', ')} WHERE id = ?`)).run(...params);
      return { id: args.where.id, ...args.data };
    },
    deleteMany: async (args: { where: { serieId?: string; question?: { serieId: string } } }) => {
      const db = await getDb();
      const serieId = args.where?.serieId || args.where?.question?.serieId;
      if (serieId) {
        await (await db.prepare('DELETE FROM "Question" WHERE serieId = ?')).run(serieId);
      }
      return { count: 0 };
    },
  },

  // Responses
  response: {
    findMany: async (args: { where: { questionId?: string; question?: { serieId: string } }; orderBy?: any }) => {
      const db = await getDb();
      if (args.where.questionId) {
        const rows = await (await db.prepare('SELECT * FROM "Response" WHERE questionId = ? ORDER BY "order"'))
          .all(args.where.questionId);
        return rows.map((r: any) => ({ ...r, isCorrect: bool(r.isCorrect) }));
      }
      return [] as any[];
    },
    create: async (args: { data: any }) => {
      const db = await getDb();
      const id = args.data.id || cuid();
      const now = new Date().toISOString();
      await (await db.prepare(
        `INSERT INTO "Response" (id, questionId, "order", text, image, isCorrect, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )).run(id, args.data.questionId, args.data.order, args.data.text || '', args.data.image || null, args.data.isCorrect ? 1 : 0, now, now);
      return { ...args.data, id, isCorrect: args.data.isCorrect, createdAt: now, updatedAt: now };
    },
    deleteMany: async (args: { where: { questionId?: string; question?: { serieId: string } } }) => {
      const db = await getDb();
      if (args.where.questionId) {
        await (await db.prepare('DELETE FROM "Response" WHERE questionId = ?')).run(args.where.questionId);
      }
      if (args.where?.question?.serieId) {
        const questions = await (await db.prepare('SELECT id FROM "Question" WHERE serieId = ?')).all(args.where.question.serieId);
        for (const q of questions as any[]) {
          await (await db.prepare('DELETE FROM "Response" WHERE questionId = ?')).run(q.id);
        }
        return { count: questions.length };
      }
      return { count: 0 };
    },
  },

  // Test Results
  testResult: {
    findMany: async (args: { where: { userId?: string; categoryId?: string }; orderBy?: { createdAt: 'desc' } }) => {
      const db = await getDb();
      let sql = 'SELECT * FROM "TestResult" WHERE 1=1';
      const params: any[] = [];
      if (args.where.userId) { sql += ' AND userId = ?'; params.push(args.where.userId); }
      if (args.where.categoryId) { sql += ' AND categoryId = ?'; params.push(args.where.categoryId); }
      if (args.orderBy?.createdAt === 'desc') sql += ' ORDER BY createdAt DESC';
      else sql += ' ORDER BY createdAt DESC';
      const rows = await (await db.prepare(sql)).all(...params);
      return rows.map((r: any) => ({ ...r, passed: bool(r.passed) }));
    },
    create: async (args: { data: any }) => {
      const db = await getDb();
      const id = args.data.id || cuid();
      const now = new Date().toISOString();
      await (await db.prepare(
        `INSERT INTO "TestResult" (id, userId, categoryId, serieNumber, score, total, passed, answers, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )).run(id, args.data.userId || null, args.data.categoryId, args.data.serieNumber, args.data.score, args.data.total, args.data.passed ? 1 : 0, JSON.stringify(args.data.answers || []), now);
      return { ...args.data, id, createdAt: now, passed: args.data.passed };
    },
    count: async () => {
      const db = await getDb();
      const result = await (await db.prepare('SELECT COUNT(*) as count FROM "TestResult"')).get();
      return result?.count || 0;
    },
  },

  // Activation (current device activation state)
  activation: {
    findFirst: async () => {
      const db = await getDb();
      const row = await (await db.prepare('SELECT * FROM "Activation" ORDER BY activatedAt DESC LIMIT 1')).get();
      return (row as any) || null;
    },
    create: async (args: { data: any }) => {
      const db = await getDb();
      const id = args.data.id || cuid();
      await (await db.prepare(
        `INSERT INTO "Activation" (id, activationCode, machineCode, machineHash, durationCode, durationLabel, expiryDate, activatedAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )).run(id, args.data.activationCode, args.data.machineCode, args.data.machineHash, args.data.durationCode, args.data.durationLabel, args.data.expiryDate, args.data.activatedAt, args.data.expiresAt);
      return { ...args.data, id };
    },
    deleteMany: async () => {
      const db = await getDb();
      await (await db.prepare('DELETE FROM "Activation"')).run();
      return { count: 0 };
    },
  },

  // License (admin-managed license records)
  license: {
    findMany: async () => {
      const db = await getDb();
      return (await db.prepare('SELECT * FROM "License" ORDER BY createdAt DESC')).all() as any[];
    },
    create: async (args: { data: any }) => {
      const db = await getDb();
      const id = args.data.id || cuid();
      const now = new Date().toISOString();
      await (await db.prepare(
        `INSERT INTO "License" (id, machineCode, activationCode, clientName, durationCode, durationLabel, durationDays, expiryDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )).run(id, args.data.machineCode, args.data.activationCode, args.data.clientName || null, args.data.durationCode, args.data.durationLabel, args.data.durationDays, args.data.expiryDate, now);
      return { ...args.data, id, createdAt: now };
    },
    deleteMany: async () => ({ count: 0 }),
  },
};
