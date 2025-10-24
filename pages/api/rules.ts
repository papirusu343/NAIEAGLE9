import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const filePath = path.join(process.cwd(), 'config', 'rules.json');

  if (req.method === 'GET') {
    try {
      const json = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(json);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).json(data);
    } catch (err: any) {
      console.error('Failed to read rules.json:', err);
      res.status(500).json({ error: 'Failed to load rules' });
    }
    return;
  }

  if (req.method === 'PUT') {
    try {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Invalid JSON' });
        return;
      }
      const json = JSON.stringify(body, null, 2);
      await fs.writeFile(filePath, json, 'utf8');
      res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error('Failed to write rules.json:', err);
      res.status(500).json({ error: 'Failed to save rules' });
    }
    return;
  }

  res.setHeader('Allow', 'GET, PUT');
  res.status(405).json({ error: 'Method not allowed' });
}