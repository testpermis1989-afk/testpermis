// Local database adapter using better-sqlite3 (for Electron / local mode)
// This provides the same interface as Prisma for common operations

import Database from 'better-sqlite3';
import path from 'path';

const DATA_DIR = process.env.LOCAL_DATA_DIR || path.join(process.cwd(), 'data');

function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('file:')) {
    let dbPath = dbUrl.replace(/^file:/, '');
    if (!dbPath.startsWith('/')) {
      dbPath = path.join(process.cwd(), dbPath);
    }
    return dbPath;
  }
  return path.join(DATA_DIR, 'permis.db');
}

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const dbPath = getDbPath();
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initTables(_db);
  }
  return _db;
}

function initTables(db: Database.Database): void {
  db.exec(`
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
// =====================================================

export const localDb = {
  // Users
  user: {
    findUnique: (args: { where: { id?: string; cin?: string } }) => {
      const db = getDb();
      if (args.where.id) {
        const row = db.prepare('SELECT * FROM "User" WHERE id = ?').get(args.where.id) as any;
        return row ? { ...row, isActive: bool(row.isActive) } : null;
      }
      if (args.where.cin) {
        const row = db.prepare('SELECT * FROM "User" WHERE cin = ?').get(args.where.cin) as any;
        return row ? { ...row, isActive: bool(row.isActive) } : null;
      }
      return null;
    },
    findMany: (args?: { where?: { isActive?: boolean } }) => {
      const db = getDb();
      let sql = 'SELECT * FROM "User"';
      const params: any[] = [];
      if (args?.where?.isActive !== undefined) {
        sql += ' WHERE isActive = ?';
        params.push(args.where.isActive ? 1 : 0);
      }
      const rows = db.prepare(sql).all(...params) as any[];
      return rows.map(r => ({ ...r, isActive: bool(r.isActive) }));
    },
    create: (args: { data: any }) => {
      const db = getDb();
      const id = args.data.id || cuid();
      const now = new Date().toISOString();
      const sql = `INSERT INTO "User" (id, cin, password, nomFr, prenomFr, nomAr, prenomAr, photo, permisCategory, examDate, pinCode, isActive, role, createdAt, updatedAt) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      db.prepare(sql).run(
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
    update: (args: { where: { id?: string; cin?: string }; data: any }) => {
      const db = getDb();
      const user = localDb.user.findUnique({ where: args.where });
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
      db.prepare(`UPDATE "User" SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      return localDb.user.findUnique({ where: { id: user.id } });
    },
    deleteMany: (args: { where: any }) => {
      const db = getDb();
      if (args.where?.cin) {
        return db.prepare('DELETE FROM "User" WHERE cin = ?').run(args.where.cin);
      }
      return { count: 0 };
    },
    count: (args?: { where?: any }) => {
      const db = getDb();
      const result = db.prepare('SELECT COUNT(*) as count FROM "User"').get() as any;
      return result.count;
    },
  },

  // Categories
  category: {
    findUnique: (args: { where: { id?: string; code?: string } }) => {
      const db = getDb();
      if (args.where.code) {
        return db.prepare('SELECT * FROM "Category" WHERE code = ?').get(args.where.code) as any;
      }
      if (args.where.id) {
        return db.prepare('SELECT * FROM "Category" WHERE id = ?').get(args.where.id) as any;
      }
      return null;
    },
    findMany: () => {
      const db = getDb();
      return db.prepare('SELECT * FROM "Category"').all() as any[];
    },
    create: (args: { data: any }) => {
      const db = getDb();
      const id = args.data.id || cuid();
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO "Category" (id, code, name, nameAr, seriesCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(id, args.data.code, args.data.name, args.data.nameAr || null, args.data.seriesCount || 10, now, now);
      return { ...args.data, id, createdAt: now, updatedAt: now };
    },
    update: (args: { where: { id: string }; data: any }) => {
      const db = getDb();
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
      db.prepare(`UPDATE "Category" SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      return localDb.category.findUnique({ where: { id: args.where.id } });
    },
    deleteMany: () => ({ count: 0 }),
  },

  // Series
  serie: {
    findFirst: (args: { where: { categoryId: string; number: number } }) => {
      const db = getDb();
      return db.prepare('SELECT * FROM "Serie" WHERE categoryId = ? AND number = ?')
        .get(args.where.categoryId, args.where.number) as any || null;
    },
    findMany: (args: { where: { categoryId: string } }) => {
      const db = getDb();
      return db.prepare('SELECT * FROM "Serie" WHERE categoryId = ? ORDER BY number')
        .all(args.where.categoryId) as any[];
    },
    create: (args: { data: any }) => {
      const db = getDb();
      const id = args.data.id || cuid();
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO "Serie" (id, number, categoryId, questionsCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(id, args.data.number, args.data.categoryId, args.data.questionsCount || 0, now, now);
      return { ...args.data, id, createdAt: now, updatedAt: now };
    },
    update: (args: { where: { id: string }; data: any }) => {
      const db = getDb();
      const sets: string[] = [];
      const params: any[] = [];
      if (args.data.questionsCount !== undefined) {
        sets.push('"questionsCount" = ?');
        params.push(args.data.questionsCount);
      }
      sets.push('"updatedAt" = ?');
      params.push(new Date().toISOString());
      params.push(args.where.id);
      db.prepare(`UPDATE "Serie" SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      return localDb.serie.findFirst({ where: { categoryId: '', number: 0 } }); // placeholder
    },
    deleteMany: (args: { where: { serieId?: string; categoryId?: string } }) => {
      const db = getDb();
      if (args.where?.serieId) {
        return db.prepare('DELETE FROM "Serie" WHERE id = ?').run(args.where.serieId);
      }
      if (args.where?.categoryId) {
        return db.prepare('DELETE FROM "Serie" WHERE categoryId = ?').run(args.where.categoryId);
      }
      return { count: 0 };
    },
  },

  // Questions
  question: {
    findMany: (args: { where: { serieId: string }; orderBy?: { order: 'asc' | 'desc' } }) => {
      const db = getDb();
      const order = args.orderBy?.order === 'desc' ? 'DESC' : 'ASC';
      return db.prepare(`SELECT * FROM "Question" WHERE serieId = ? ORDER BY "order" ${order}`)
        .all(args.where.serieId) as any[];
    },
    create: (args: { data: any }) => {
      const db = getDb();
      const id = args.data.id || cuid();
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO "Question" (id, serieId, "order", text, image, audio, video, duration, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, args.data.serieId, args.data.order, args.data.text || '', args.data.image || null, args.data.audio || '', args.data.video || null, args.data.duration || 30, now, now);
      return { ...args.data, id, createdAt: now, updatedAt: now };
    },
    update: (args: { where: { id: string }; data: any }) => {
      const db = getDb();
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
      db.prepare(`UPDATE "Question" SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      return localDb.question.findMany({ where: { serieId: '' } })[0]; // placeholder
    },
    deleteMany: (args: { where: { serieId?: string; question?: { serieId: string } } }) => {
      const db = getDb();
      const serieId = args.where?.serieId || args.where?.question?.serieId;
      if (serieId) {
        return db.prepare('DELETE FROM "Question" WHERE serieId = ?').run(serieId);
      }
      return { count: 0 };
    },
  },

  // Responses
  response: {
    findMany: (args: { where: { questionId?: string; question?: { serieId: string } } }) => {
      const db = getDb();
      if (args.where.questionId) {
        return db.prepare('SELECT * FROM "Response" WHERE questionId = ? ORDER BY "order"')
          .all(args.where.questionId) as any[];
      }
      return [] as any[];
    },
    create: (args: { data: any }) => {
      const db = getDb();
      const id = args.data.id || cuid();
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO "Response" (id, questionId, "order", text, image, isCorrect, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, args.data.questionId, args.data.order, args.data.text || '', args.data.image || null, args.data.isCorrect ? 1 : 0, now, now);
      return { ...args.data, id, isCorrect: args.data.isCorrect, createdAt: now, updatedAt: now };
    },
    deleteMany: (args: { where: { questionId?: string; question?: { serieId: string } } }) => {
      const db = getDb();
      if (args.where.questionId) {
        return db.prepare('DELETE FROM "Response" WHERE questionId = ?').run(args.where.questionId);
      }
      if (args.where?.question?.serieId) {
        // Delete responses for all questions in a serie
        const questions = db.prepare('SELECT id FROM "Question" WHERE serieId = ?').all(args.where.question.serieId) as any[];
        for (const q of questions) {
          db.prepare('DELETE FROM "Response" WHERE questionId = ?').run(q.id);
        }
        return { count: questions.length };
      }
      return { count: 0 };
    },
  },

  // Test Results
  testResult: {
    findMany: (args: { where: { userId?: string; categoryId?: string }; orderBy?: { createdAt: 'desc' } }) => {
      const db = getDb();
      let sql = 'SELECT * FROM "TestResult" WHERE 1=1';
      const params: any[] = [];
      if (args.where.userId) { sql += ' AND userId = ?'; params.push(args.where.userId); }
      if (args.where.categoryId) { sql += ' AND categoryId = ?'; params.push(args.where.categoryId); }
      if (args.orderBy?.createdAt === 'desc') sql += ' ORDER BY createdAt DESC';
      return db.prepare(sql).all(...params) as any[];
    },
    create: (args: { data: any }) => {
      const db = getDb();
      const id = args.data.id || cuid();
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO "TestResult" (id, userId, categoryId, serieNumber, score, total, passed, answers, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, args.data.userId || null, args.data.categoryId, args.data.serieNumber, args.data.score, args.data.total, args.data.passed ? 1 : 0, args.data.answers || '', now);
      return { ...args.data, id, createdAt: now, passed: args.data.passed };
    },
    count: () => {
      const db = getDb();
      const result = db.prepare('SELECT COUNT(*) as count FROM "TestResult"').get() as any;
      return result.count;
    },
  },
};
