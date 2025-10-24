import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Image URL is required' });
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
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
    console.error('Eagle image proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch image from Eagle',
      details: error.message 
    });
  }
}