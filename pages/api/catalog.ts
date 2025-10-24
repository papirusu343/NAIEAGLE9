import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CATALOG_PATH = path.join(DATA_DIR, 'catalog.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    ensureDataDir();

    if (req.method === 'GET') {
      if (fs.existsSync(CATALOG_PATH)) {
        const content = fs.readFileSync(CATALOG_PATH, 'utf-8');
        res.status(200).json(JSON.parse(content));
      } else {
        res.status(200).json({ characters: [] });
      }
      return;
    }

    if (req.method === 'POST') {
      const body = req.body;
      if (!body || !Array.isArray(body.characters)) {
        res.status(400).json({ error: 'Invalid catalog format' });
        return;
      }
      fs.writeFileSync(CATALOG_PATH, JSON.stringify(body, null, 2), 'utf-8');
      res.status(200).json({ success: true });
      return;
    }

    res.setHeader('Allow', 'GET,POST');
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error: any) {
    console.error('catalog API error:', error);
    res.status(500).json({ error: error?.message || 'Internal error' });
  }
}