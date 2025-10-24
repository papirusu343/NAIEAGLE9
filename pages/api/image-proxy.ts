import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const { path: imagePath } = req.query;

    if (!imagePath || typeof imagePath !== 'string') {
      return res.status(400).json({ error: 'パラメーター "path" が必要です' });
    }

    const decodedPath = decodeURIComponent(imagePath);
    
    // セキュリティチェック: パストラバーサル攻撃を防ぐ
    if (decodedPath.includes('..') || !path.isAbsolute(decodedPath)) {
      console.warn(`[${new Date().toISOString()}] 不正なパスアクセス試行: ${decodedPath}`);
      return res.status(403).json({ error: '不正なパスです' });
    }

    // ファイルの存在確認
    if (!fs.existsSync(decodedPath)) {
      console.warn(`[${new Date().toISOString()}] ファイルが見つかりません: ${decodedPath}`);
      return res.status(404).json({ error: 'ファイルが見つかりません' });
    }

    // ファイル情報を取得
    const stats = fs.statSync(decodedPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'ファイルではありません' });
    }

    // ファイル拡張子からMIMEタイプを決定
    const ext = path.extname(decodedPath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.png': contentType = 'image/png'; break;
      case '.jpg':
      case '.jpeg': contentType = 'image/jpeg'; break;
      case '.gif': contentType = 'image/gif'; break;
      case '.webp': contentType = 'image/webp'; break;
      case '.bmp': contentType = 'image/bmp'; break;
      case '.tiff':
      case '.tif': contentType = 'image/tiff'; break;
      default: contentType = 'image/png'; break;
    }

    // キャッシュヘッダーを設定
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1年間キャッシュ
    res.setHeader('Content-Length', stats.size);
    
    // ファイルを読み込んでレスポンス
    const fileBuffer = fs.readFileSync(decodedPath);
    res.status(200).send(fileBuffer);

  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] 画像プロキシエラー:`, error);
    res.status(500).json({ 
      error: 'ファイル読み込みエラー',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// ファイルサイズの制限を設定
export const config = {
  api: {
    responseLimit: '50mb',
  },
};