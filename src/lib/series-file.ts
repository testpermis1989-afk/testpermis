// Fallback series storage using JSON file
// Used when the database (sql.js) is not available or fails in Electron
// Same approach as activation-file.ts for reliability

import fs from 'fs';
import path from 'path';

// Data directory - same as electron/main.js uses
function getDataDir(): string {
  return process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');
}

function getSeriesFile(): string {
  return path.join(getDataDir(), 'series.json');
}

function ensureDir() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ========== TYPES ==========

export interface ResponseData {
  id: string;
  order: number;
  text: string;
  image: string | null;
  isCorrect: boolean;
}

export interface QuestionData {
  id: string;
  order: number;
  image: string;
  audio: string;
  video: string | null;
  text: string;
  duration: number;
  responses: ResponseData[];
}

export interface SerieData {
  id: string;
  categoryId: string;
  categoryCode: string;
  number: number;
  questionsCount: number;
  createdAt: string;
}

export interface CategoryData {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  seriesCount: number;
}

export interface SeriesFileData {
  categories: Record<string, CategoryData>;
  series: Record<string, SerieData>;  // key: "B_1"
  questions: Record<string, QuestionData[]>;  // key: "B_1"
}

// ========== HELPERS ==========

function serieKey(categoryCode: string, serieNumber: number): string {
  return `${categoryCode}_${serieNumber}`;
}

function cuid(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `c${timestamp}${random}`;
}

function getCategoryName(code: string): string {
  return { A: 'Moto', B: 'Voiture', C: 'Camion', D: 'Bus', E: 'Remorque' }[code] || code;
}

function getCategoryNameAr(code: string): string {
  return { A: 'دراجة نارية', B: 'سيارة', C: 'شاحنة', D: 'حافلة', E: 'مقطورة' }[code] || code;
}

// ========== READ / WRITE ==========

export function readSeriesFile(): SeriesFileData {
  try {
    ensureDir();
    const filePath = getSeriesFile();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('[series-file] Failed to read series file:', e);
  }
  return { categories: {}, series: {}, questions: {} };
}

function writeSeriesFile(data: SeriesFileData): void {
  try {
    ensureDir();
    const filePath = getSeriesFile();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log('[series-file] Series data saved successfully');
  } catch (e) {
    console.error('[series-file] Failed to write series file:', e);
  }
}

// ========== PUBLIC API ==========

/**
 * Save questions for a serie (replaces existing).
 * This is the primary storage - JSON file is always used.
 */
export function saveSerieQuestions(
  categoryCode: string,
  serieNumber: number,
  questions: { order: number; imageUrl: string; audioUrl: string; videoUrl?: string | null; responseImageUrl?: string; correctAnswers: string }[]
): { categoryId: string; questionsImported: number } {
  const data = readSeriesFile();
  const key = serieKey(categoryCode, serieNumber);
  const now = new Date().toISOString();

  // Create category if not exists
  if (!data.categories[categoryCode]) {
    data.categories[categoryCode] = {
      id: cuid(),
      code: categoryCode,
      name: getCategoryName(categoryCode),
      nameAr: getCategoryNameAr(categoryCode),
      seriesCount: 0,
    };
  }
  const categoryId = data.categories[categoryCode].id;

  // Create/update serie
  if (!data.series[key]) {
    data.categories[categoryCode].seriesCount++;
  }
  data.series[key] = {
    id: cuid(),
    categoryId,
    categoryCode,
    number: serieNumber,
    questionsCount: questions.length,
    createdAt: now,
  };

  // Create questions
  const questionDataList: QuestionData[] = questions.map(q => {
    const qId = cuid();
    const responses: ResponseData[] = [];
    for (let j = 1; j <= 4; j++) {
      responses.push({
        id: cuid(),
        order: j,
        text: `Réponse ${j}`,
        image: null,
        isCorrect: q.correctAnswers.includes(String(j)),
      });
    }
    return {
      id: qId,
      order: q.order,
      image: q.imageUrl,
      audio: q.audioUrl,
      video: q.videoUrl || null,
      text: q.responseImageUrl || '',
      duration: 30,
      responses,
    };
  });

  data.questions[key] = questionDataList;
  writeSeriesFile(data);
  return { categoryId, questionsImported: questions.length };
}

/**
 * Get all categories with their series (for the series list).
 * Compatible with /api/questions/import GET response format.
 */
export function getAllCategoriesWithSeries(): { categories: { code: string; series: { number: number; _count: { questions: number } }[] }[] } {
  const data = readSeriesFile();
  const categories = Object.values(data.categories).map(cat => {
    const seriesList = Object.values(data.series)
      .filter(s => s.categoryCode === cat.code)
      .map(s => ({
        number: s.number,
        _count: { questions: s.questionsCount },
      }))
      .sort((a, b) => a.number - b.number);
    return {
      code: cat.code,
      series: seriesList,
    };
  });
  return { categories };
}

/**
 * Get questions for a specific serie.
 * Compatible with /api/questions GET response format.
 */
export function getSerieQuestions(
  categoryCode: string,
  serieNumber: number
): { category: { code: string; name: string; nameAr: string }; serie: { number: number; questionsCount: number }; questions: QuestionData[] } | null {
  const data = readSeriesFile();
  const key = serieKey(categoryCode, serieNumber);
  const cat = data.categories[categoryCode];
  const serie = data.series[key];

  if (!cat || !serie) return null;

  const questions = (data.questions[key] || []).map(q => ({
    id: q.id,
    order: q.order,
    image: q.image || '',
    audio: q.audio || '',
    video: q.video || '',
    text: q.text || '',
    duration: q.duration || 30,
    responses: (q.responses || []).map(r => ({
      id: r.id,
      order: r.order,
      text: r.text || '',
      image: r.image || '',
      isCorrect: !!r.isCorrect,
    })),
  }));

  return {
    category: { code: cat.code, name: cat.name, nameAr: cat.nameAr },
    serie: { number: serie.number, questionsCount: serie.questionsCount },
    questions,
  };
}

/**
 * Delete a serie from the JSON file.
 */
export function deleteSerie(categoryCode: string, serieNumber: number): boolean {
  const data = readSeriesFile();
  const key = serieKey(categoryCode, serieNumber);

  if (!data.series[key]) return false;

  // Delete questions
  delete data.questions[key];
  // Delete serie
  delete data.series[key];
  // Update category series count
  if (data.categories[categoryCode]) {
    data.categories[categoryCode].seriesCount = Object.values(data.series)
      .filter(s => s.categoryCode === categoryCode).length;
  }

  writeSeriesFile(data);
  return true;
}

/**
 * Check if JSON file has any data.
 */
export function hasSeriesData(): boolean {
  const data = readSeriesFile();
  return Object.keys(data.series).length > 0;
}
