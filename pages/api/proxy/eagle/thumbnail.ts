import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const { id, size = 300 } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Image ID is required' });
  }

  try {
    const eagleUrl = `http://localhost:41595/api/item/thumbnail?id=${id}&size=${size}`;
    
    const response = await axios.get(eagleUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'NovelAI-App-Proxy/1.0'
      }
    });

    // 適切なContent-Typeヘッダーを設定
    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1時間キャッシュ
    
    res.status(200).send(Buffer.from(response.data));
  } catch (error: any) {
    console.error('Eagle thumbnail proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch thumbnail from Eagle',
      details: error.message 
    });
  }
}