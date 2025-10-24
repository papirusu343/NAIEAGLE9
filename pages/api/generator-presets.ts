import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import fs from 'fs/promises';

type ListResponse = { presets: string[] };
type ReadResponse = { name: string; data: any };
type ErrorResponse = { error: string };
type SaveRequest = { name: string; data: any };
type DeleteRequest = { name: string };

const PRESET_DIR = path.join(process.cwd(), 'data', 'generator-presets');

function sanitizeName(name: string): string {
  const safe = (name || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\.\./g, '_')
    .trim()
    .replace(/\s+/g, '_');
  return safe || 'preset';
}

async function ensureDir() {
  await fs.mkdir(PRESET_DIR, { recursive: true });
}

async function listPresets(): Promise<string[]> {
  await ensureDir();
  const entries = await fs.readdir(PRESET_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => e.name.replace(/\.json$/, ''))
    .sort((a, b) => a.localeCompare(b, 'ja'));
}

async function readPreset(name: string): Promise<any | null> {
  await ensureDir();
  const filePath = path.join(PRESET_DIR, `${sanitizeName(name)}.json`);
  try {
    const buf = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(buf);
  } catch {
    return null;
  }
}

async function writePreset(name: string, data: any) {
  await ensureDir();
  const filePath = path.join(PRESET_DIR, `${sanitizeName(name)}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function deletePreset(name: string) {
  await ensureDir();
  const filePath = path.join(PRESET_DIR, `${sanitizeName(name)}.json`);
  await fs.unlink(filePath);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ListResponse | ReadResponse | ErrorResponse>
) {
  try {
    if (req.method === 'GET') {
      const { name } = req.query;
      if (typeof name === 'string' && name.trim().length > 0) {
        const data = await readPreset(name.trim());
        if (!data) {
          res.status(404).json({ error: 'Preset not found' });
          return;
        }
        res.status(200).json({ name: name.trim(), data });
        return;
      }
      const presets = await listPresets();
      res.status(200).json({ presets });
      return;
    }

    if (req.method === 'POST') {
      const body: SaveRequest = req.body;
      if (!body || typeof body.name !== 'string' || !body.name.trim()) {
        res.status(400).json({ error: 'Invalid name' });
        return;
      }
      if (typeof body.data === 'undefined') {
        res.status(400).json({ error: 'Invalid data' });
        return;
      }
      await writePreset(body.name, body.data);
      res.status(200).json({ name: body.name, data: body.data });
      return;
    }

    if (req.method === 'DELETE') {
      const body: DeleteRequest = req.body;
      if (!body || typeof body.name !== 'string' || !body.name.trim()) {
        res.status(400).json({ error: 'Invalid name' });
        return;
      }
      await deletePreset(body.name);
      res.status(200).json({ name: body.name, data: null });
      return;
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('generator-presets API error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}