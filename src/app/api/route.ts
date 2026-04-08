import { NextResponse } from "next/server";

export async function GET() {
  const info: any = {
    status: "ok",
    app: "Permis Maroc",
    storageMode: process.env.STORAGE_MODE || "supabase",
    nodeEnv: process.env.NODE_ENV || "development",
    hasDbUrl: !!process.env.DATABASE_URL,
    timestamp: new Date().toISOString(),
  };

  // Test database connectivity
  try {
    const { db } = await import("@/lib/db");
    const count = await db.user.count();
    info.database = "connected";
    info.userCount = count;
  } catch (err: any) {
    info.database = "error";
    info.dbError = err.message || String(err);
  }

  return NextResponse.json(info);
}
