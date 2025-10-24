import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const GROUPS_PATH = path.join(DATA_DIR, 'groups.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    ensureDataDir();

    if (req.method === 'GET') {
      if (fs.existsSync(GROUPS_PATH)) {
        const content = fs.readFileSync(GROUPS_PATH, 'utf-8');
        res.status(200).json(JSON.parse(content));
      } else {
        res.status(200).json({ groups: [] });
      }
      return;
    }

    if (req.method === 'POST') {
      const body = req.body;
      if (!body || !Array.isArray(body.groups)) {
        res.status(400).json({ error: 'Invalid group config format' });
        return;
      }
      fs.writeFileSync(GROUPS_PATH, JSON.stringify(body, null, 2), 'utf-8');
      res.status(200).json({ success: true });
      return;
    }

    res.setHeader('Allow', 'GET,POST');
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error: any) {
    console.error('groups API error:', error);
    res.status(500).json({ error: error?.message || 'Internal error' });
  }
}