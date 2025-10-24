import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const FAVORITES_FILE = path.join(process.cwd(), 'data', 'favorites.json');

// データディレクトリが存在しない場合は作成
const ensureDataDirectory = () => {
  const dataDir = path.dirname(FAVORITES_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// お気に入りデータを読み込み
const loadFavorites = (): Set<string> => {
  try {
    ensureDataDirectory();
    if (fs.existsSync(FAVORITES_FILE)) {
      const data = fs.readFileSync(FAVORITES_FILE, 'utf8');
      const favorites = JSON.parse(data);
      return new Set(favorites);
    }
  } catch (error) {
    console.error('お気に入りデータの読み込みエラー:', error);
  }
  return new Set();
};

// お気に入りデータを保存
const saveFavorites = (favorites: Set<string>): void => {
  try {
    ensureDataDirectory();
    const data = JSON.stringify(Array.from(favorites), null, 2);
    fs.writeFileSync(FAVORITES_FILE, data, 'utf8');
  } catch (error) {
    console.error('お気に入りデータの保存エラー:', error);
    throw error;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      // お気に入り状態の取得
      const { imageId } = req.query;
      
      if (!imageId || typeof imageId !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'imageIdが必要です' 
        });
      }

      const favorites = loadFavorites();
      const isFavorite = favorites.has(imageId);

      res.status(200).json({
        success: true,
        isFavorite
      });

    } else if (req.method === 'POST') {
      // お気に入りの設定/解除
      const { imageId, action } = req.body;

      if (!imageId || typeof imageId !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'imageIdが必要です' 
        });
      }

      if (!action || !['toggle', 'add', 'remove'].includes(action)) {
        return res.status(400).json({ 
          success: false, 
          message: 'actionは toggle, add, remove のいずれかである必要があります' 
        });
      }

      const favorites = loadFavorites();
      let isFavorite: boolean;

      switch (action) {
        case 'toggle':
          if (favorites.has(imageId)) {
            favorites.delete(imageId);
            isFavorite = false;
          } else {
            favorites.add(imageId);
            isFavorite = true;
          }
          break;
        case 'add':
          favorites.add(imageId);
          isFavorite = true;
          break;
        case 'remove':
          favorites.delete(imageId);
          isFavorite = false;
          break;
        default:
          throw new Error('無効なアクションです');
      }

      saveFavorites(favorites);

      res.status(200).json({
        success: true,
        isFavorite,
        message: isFavorite ? 'お気に入りに追加しました' : 'お気に入りから削除しました'
      });

    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }

  } catch (error: any) {
    console.error('お気に入りAPI エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'サーバーエラーが発生しました' 
    });
  }
}