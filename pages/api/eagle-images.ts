import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import fs from 'fs';
import axios from 'axios';

const EAGLE_API_URL = 'http://localhost:41595/api/item/list';
const LIBRARY_IMAGE_PATH = 'C:/eagle/AI.library/images';
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff'];
const FAVORITES_FILE = path.join(process.cwd(), 'data', 'favorites.json');

interface EagleItem {
  id: string;
  name: string;
  ext?: string;
  mtime?: number;
  tags?: string[];
  annotation?: string;
  isDeleted?: boolean;
  width?: number;
  height?: number;
  size?: number;
  modificationTime?: number;
  lastModified?: number;
  folders?: string[]; // 🔥 フォルダID配列を追加
}

interface ProcessedImage {
  id: string;
  name: string;
  thumbUrl: string;
  url: string;
  mtime: number;
  tags: string[];
  annotation: string;
  width?: number;
  height?: number;
  size?: number;
  ext?: string;
  modificationTime?: number;
  lastModified?: number;
  isFavorite?: boolean; // 🔥 お気に入りフラグを追加
  folders?: string[]; // 🔥 フォルダID配列を追加
}

// 🔥 お気に入りデータを読み込み
const loadFavorites = (): Set<string> => {
  try {
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

async function fetchAllImages(): Promise<EagleItem[]> {
  try {
    // limitを大きくして一度に全件取得
    const limit = 100000;
    const { data } = await axios.get(EAGLE_API_URL, { 
      params: { limit },
      timeout: 30000
    });
    const items = data?.data || [];
    console.log(`[${new Date().toISOString()}] Eagle APIから取得した全件数:`, items.length);
    return items;
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Eagle API Error:`, error.message);
    throw new Error(`Eagle APIへの接続に失敗しました: ${error.message}`);
  }
}

function findImageFiles(subdirPath: string, item: EagleItem): { absPath: string | null; thumbPath: string | null } {
  if (!fs.existsSync(subdirPath)) {
    return { absPath: null, thumbPath: null };
  }

  try {
    const files = fs.readdirSync(subdirPath);
    const exts = [item.ext?.toLowerCase(), ...IMAGE_EXTS].filter(Boolean);

    // 本体画像を検索
    const main = files.find(fname =>
      exts.some(ext => fname.toLowerCase() === `${item.name.toLowerCase()}.${ext}`)
    );

    // サムネイル画像を検索
    const thumb = files.find(fname =>
      exts.some(ext => fname.toLowerCase() === `${item.name.toLowerCase()}_thumbnail.${ext}`)
    );

    return {
      absPath: main ? path.join(subdirPath, main) : null,
      thumbPath: thumb ? path.join(subdirPath, thumb) : null
    };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ファイル検索エラー:`, subdirPath, error);
    return { absPath: null, thumbPath: null };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    console.log(`[${new Date().toISOString()}] Eagle画像リスト取得開始`);
    
    // Eagle APIから画像リストを取得
    const items = await fetchAllImages();
    
    // 🔥 お気に入りデータを読み込み
    const favorites = loadFavorites();
    
    // ローカルファイルシステムから実際の画像パスを解決
    const images: ProcessedImage[] = items
      .filter(item => !item.isDeleted && item.id && item.name)
      .map((item) => {
        const subdir = `${item.id}.info`;
        const subdirPath = path.join(LIBRARY_IMAGE_PATH, subdir);
        const { absPath, thumbPath } = findImageFiles(subdirPath, item);

        if (!absPath && !thumbPath) {
          // ログでAPIにはあるがファイルが見つからない画像を出力
          console.log(`[${new Date().toISOString()}] [NOT FOUND FILE] id=${item.id}, name=${item.name}, ext=${item.ext}, path=${subdirPath}`);
          return null;
        }

        return {
          id: item.id,
          name: item.name,
          thumbUrl: thumbPath
            ? `/api/image-proxy?path=${encodeURIComponent(thumbPath)}`
            : absPath
            ? `/api/image-proxy?path=${encodeURIComponent(absPath)}`
            : '',
          url: absPath
            ? `/api/image-proxy?path=${encodeURIComponent(absPath)}`
            : '',
          mtime: item.mtime || item.modificationTime || item.lastModified || 0,
          tags: item.tags || [],
          annotation: item.annotation || '',
          width: item.width,
          height: item.height,
          size: item.size,
          ext: item.ext,
          modificationTime: item.modificationTime,
          lastModified: item.lastModified,
          isFavorite: favorites.has(item.id), // 🔥 お気に入り状態を設定
          folders: item.folders || [], // 🔥 フォルダID配列を付与
        };
      })
      .filter((item): item is ProcessedImage => item !== null)
      .sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

    console.log(`[${new Date().toISOString()}] 処理完了 - 有効な画像数: ${images.length}/${items.length}`);

    res.status(200).json({ 
      status: 'success',
      data: images, 
      total: items.length,
      valid: images.length,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Eagle画像取得エラー:`, error);
    res.status(500).json({ 
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}