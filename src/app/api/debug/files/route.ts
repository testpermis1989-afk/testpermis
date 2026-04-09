import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const dataDir = process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');
  const uploadsDir = path.join(dataDir, 'uploads');
  
  const result: Record<string, any> = {
    dataDir,
    uploadsDir,
    exists: fs.existsSync(dataDir),
    uploadsExists: fs.existsSync(uploadsDir),
    env: {
      LOCAL_DATA_DIR: process.env.LOCAL_DATA_DIR || '(not set)',
      STORAGE_MODE: process.env.STORAGE_MODE || '(not set)',
      DATABASE_URL: (process.env.DATABASE_URL || '').substring(0, 50),
      NODE_ENV: process.env.NODE_ENV || '(not set)',
    },
    series: {},
  };
  
  // List series directories
  const seriesDir = path.join(uploadsDir, 'series');
  if (fs.existsSync(seriesDir)) {
    const categories = fs.readdirSync(seriesDir);
    for (const cat of categories) {
      const catDir = path.join(seriesDir, cat);
      if (!fs.statSync(catDir).isDirectory()) continue;
      result.series[cat] = {};
      const seriesNums = fs.readdirSync(catDir);
      for (const num of seriesNums) {
        const seriePath = path.join(catDir, num);
        if (!fs.statSync(seriePath).isDirectory()) continue;
        const files: Record<string, string[]> = {};
        for (const sub of ['images', 'audio', 'video', 'responses']) {
          const subDir = path.join(seriePath, sub);
          files[sub] = fs.existsSync(subDir) ? fs.readdirSync(subDir) : [];
        }
        result.series[cat][num] = files;
      }
    }
  }
  
  // Check series.json
  const seriesJsonPath = path.join(dataDir, 'series.json');
  result.seriesJson = {
    exists: fs.existsSync(seriesJsonPath),
    size: fs.existsSync(seriesJsonPath) ? fs.statSync(seriesJsonPath).size : 0,
  };
  
  return NextResponse.json(result);
}
