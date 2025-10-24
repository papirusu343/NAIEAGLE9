import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const WILDCARDS_DIR = path.join(process.cwd(), 'wildcards');

// wildcardディレクトリが存在しない場合は作成
if (!fs.existsSync(WILDCARDS_DIR)) {
  fs.mkdirSync(WILDCARDS_DIR, { recursive: true });
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const files = fs.readdirSync(WILDCARDS_DIR)
        .filter(file => file.endsWith('.txt'))
        .map(file => {
          const name = path.basename(file, '.txt');
          const filePath = path.join(WILDCARDS_DIR, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          return { name, content };
        });

      res.status(200).json({ files });
    } catch (error: any) {
      console.error('Wildcard files read error:', error);
      res.status(500).json({ error: 'Failed to read wildcard files', details: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, content } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Invalid file name' });
      }

      if (typeof content !== 'string') {
        return res.status(400).json({ error: 'Invalid content' });
      }

      // ファイル名の安全性チェック
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeName) {
        return res.status(400).json({ error: 'Invalid file name format' });
      }

      const filePath = path.join(WILDCARDS_DIR, `${safeName}.txt`);
      fs.writeFileSync(filePath, content, 'utf-8');

      res.status(200).json({ message: 'File saved successfully', name: safeName });
    } catch (error: any) {
      console.error('Wildcard file save error:', error);
      res.status(500).json({ error: 'Failed to save wildcard file', details: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { name } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Invalid file name' });
      }

      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '');
      const filePath = path.join(WILDCARDS_DIR, `${safeName}.txt`);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.status(200).json({ message: 'File deleted successfully' });
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    } catch (error: any) {
      console.error('Wildcard file delete error:', error);
      res.status(500).json({ error: 'Failed to delete wildcard file', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}