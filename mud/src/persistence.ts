import { mkdir, readFile, writeFile, stat } from 'fs/promises';
import path from 'path';
import { ClassType } from './types';

const DATA_DIR = path.join(process.cwd(), 'data', 'players');

/** Serializable snapshot for save/load (item refs stored as IDs) */
export interface SavedPlayerData {
  name: string;
  currentRoomId: string;
  inventoryItemIds: string[];
  equipment: Partial<Record<string, string | null>>;
  gold: number;
  completedQuests: string[];
  killCount: Record<string, number>;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  energy: number;
  maxEnergy: number;
  regenRate: number;
  level: number;
  xp: number;
  godMode: boolean;
  class: ClassType;
  skills: string[];
  attack: number;
  isAlive: boolean;
  isAdmin: boolean;
}

/**
 * Ensures data/players exists. Call once when the server starts.
 */
export async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

/**
 * Write player data to data/players/[playerName].json.
 * Use a sanitized filename (replace invalid chars).
 */
export async function savePlayer(data: SavedPlayerData): Promise<void> {
  await ensureDataDir();
  const safeName = data.name.replace(/[^a-zA-Z0-9_-]/g, '_').trim() || 'player';
  const filePath = path.join(DATA_DIR, `${safeName}.json`);
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log('[Persist] Saved player:', data.name);
}

export interface LoadPlayerResult {
  data: SavedPlayerData;
  mtime: Date;
}

/**
 * Read player data from data/players/[playerName].json.
 * Returns null if the file does not exist; otherwise { data, mtime }.
 */
export async function loadPlayer(playerName: string): Promise<LoadPlayerResult | null> {
  const safeName = (playerName || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'player';
  const filePath = path.join(DATA_DIR, `${safeName}.json`);
  try {
    const [raw, stats] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)]);
    const data = JSON.parse(raw) as SavedPlayerData;
    data.isAdmin = true;
    return { data, mtime: stats.mtime };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return null;
    throw err;
  }
}
