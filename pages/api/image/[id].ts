import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// プロキシ経由でEagle APIを呼び出すヘルパー関数
async function callEagleProxy(endpoint: string, method: string = 'GET', data?: any, params?: any) {
  try {
    const response = await fetch('/api/eagle-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        method,
        data,
        params
      })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Eagle APIプロキシエラー');
    }

    return result.data;
  } catch (error: any) {
    console.error('Eagle proxy call error:', error);
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const { id, size = '300' } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Image ID is required' });
    }

    console.log(`Image request for user papirusu343: ID=${id}, size=${size}`);

    // まず画像情報を取得（プロキシ経由）
    const infoResponse = await callEagleProxy('item/info', 'GET', null, { id });

    if (infoResponse.status !== 'success') {
      console.error('Failed to get image info (proxy):', infoResponse);
      return res.status(404).json({ error: 'Image not found' });
    }

    const imageInfo = infoResponse.data;
    console.log('Image info for papirusu343 (proxy):', imageInfo);

    // 大きいサイズの場合は元画像のパスを直接取得
    if (parseInt(size as string) > 500) {
      // 元画像のファイルパスを取得
      const originalPath = imageInfo.filePath;
      if (originalPath && fs.existsSync(originalPath)) {
        try {
          console.log(`Loading original image for papirusu343 (proxy): ${originalPath}`);
          const fileBuffer = fs.readFileSync(originalPath);
          const ext = path.extname(originalPath).toLowerCase();
          
          let contentType = 'image/png';
          switch (ext) {
            case '.jpg':
            case '.jpeg':
              contentType = 'image/jpeg';
              break;
            case '.png':
              contentType = 'image/png';
              break;
            case '.webp':
              contentType = 'image/webp';
              break;
            case '.gif':
              contentType = 'image/gif';
              break;
          }

          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.status(200).send(fileBuffer);
          return;
        } catch (fileError) {
          console.error(`Failed to read original file for papirusu343 (proxy):`, fileError);
        }
      }
    }

    // サムネイルAPIを使用（プロキシ経由）
    try {
      console.log(`Using thumbnail API for papirusu343 (proxy): ID=${id}, size=${size}`);
      const thumbnailResponse = await callEagleProxy('item/thumbnail', 'GET', null, { id, size });

      if (thumbnailResponse.status === 'success') {
        const thumbnailPath = thumbnailResponse.data;
        console.log(`Thumbnail path for papirusu343 (proxy): ${thumbnailPath}`);
        
        if (thumbnailPath && typeof thumbnailPath === 'string') {
          try {
            // URLデコードを試行
            let decodedPath = thumbnailPath;
            try {
              decodedPath = decodeURIComponent(thumbnailPath);
            } catch (decodeError) {
              console.warn('URL decode failed, using original path');
            }

            console.log(`Decoded thumbnail path: ${decodedPath}`);

            if (fs.existsSync(decodedPath)) {
              const fileBuffer = fs.readFileSync(decodedPath);
              const ext = path.extname(decodedPath).toLowerCase();
              
              let contentType = 'image/png';
              switch (ext) {
                case '.jpg':
                case '.jpeg':
                  contentType = 'image/jpeg';
                  break;
                case '.png':
                  contentType = 'image/png';
                  break;
                case '.webp':
                  contentType = 'image/webp';
                  break;
              }

              res.setHeader('Content-Type', contentType);
              res.setHeader('Cache-Control', 'public, max-age=3600');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.status(200).send(fileBuffer);
              return;
            } else {
              console.error(`Thumbnail file not found (proxy): ${decodedPath}`);
            }
          } catch (pathError) {
            console.error(`Error processing thumbnail path (proxy):`, pathError);
          }
        }
      }
    } catch (thumbnailError) {
      console.error(`Thumbnail API error (proxy):`, thumbnailError);
    }

    // フォールバック: 元画像を使用
    if (imageInfo.filePath && fs.existsSync(imageInfo.filePath)) {
      try {
        console.log(`Fallback to original image (proxy): ${imageInfo.filePath}`);
        const fileBuffer = fs.readFileSync(imageInfo.filePath);
        const ext = path.extname(imageInfo.filePath).toLowerCase();
        
        let contentType = 'image/png';
        switch (ext) {
          case '.jpg':
          case '.jpeg':
            contentType = 'image/jpeg';
            break;
          case '.png':
            contentType = 'image/png';
            break;
          case '.webp':
            contentType = 'image/webp';
            break;
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(fileBuffer);
        return;
      } catch (fallbackError) {
        console.error(`Fallback image read error (proxy):`, fallbackError);
      }
    }

    return res.status(404).json({ error: 'Image file not found' });

  } catch (error: any) {
    console.error(`Image API error for papirusu343 (proxy):`, error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}