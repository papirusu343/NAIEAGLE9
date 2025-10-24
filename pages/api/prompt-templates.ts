import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const TEMPLATES_DIR = path.join(process.cwd(), 'prompt-templates');

// prompt-templatesディレクトリが存在しない場合は作成
if (!fs.existsSync(TEMPLATES_DIR)) {
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const files = fs.readdirSync(TEMPLATES_DIR)
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const name = path.basename(file, '.json');
          const filePath = path.join(TEMPLATES_DIR, file);
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            return { name, data };
          } catch (error) {
            console.error(`Error reading template file ${file}:`, error);
            return null;
          }
        })
        .filter(file => file !== null);

      res.status(200).json({ files });
    } catch (error: any) {
      console.error('Template files read error:', error);
      res.status(500).json({ error: 'Failed to read template files', details: error.message });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, data } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Invalid file name' });
      }

      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Invalid template data' });
      }

      // ファイル名の安全性チェック
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeName) {
        return res.status(400).json({ error: 'Invalid file name format' });
      }

      const filePath = path.join(TEMPLATES_DIR, `${safeName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

      res.status(200).json({ message: 'Template saved successfully', name: safeName });
    } catch (error: any) {
      console.error('Template file save error:', error);
      res.status(500).json({ error: 'Failed to save template file', details: error.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { name } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Invalid file name' });
      }

      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '');
      const filePath = path.join(TEMPLATES_DIR, `${safeName}.json`);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.status(200).json({ message: 'Template deleted successfully' });
      } else {
        res.status(404).json({ error: 'Template not found' });
      }
    } catch (error: any) {
      console.error('Template file delete error:', error);
      res.status(500).json({ error: 'Failed to delete template file', details: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}