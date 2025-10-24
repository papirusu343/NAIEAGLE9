import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

type EagleFolderRaw = {
  id: string;
  name: string;
  // 他にも返るが、フィルタ用途では id/name のみ利用
};

type ApiResponse<T> = {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  timestamp?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse<EagleFolderRaw[]>>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ status: 'error', message: `Method ${req.method} Not Allowed`, timestamp: new Date().toISOString() });
    return;
  }

  try {
    const url = 'http://localhost:41595/api/folder/list';
    const { data } = await axios.get(url, { timeout: 20000 });
    // Eagleの標準レスポンスは { status: 'success', data: [...] }
    const list: EagleFolderRaw[] = data?.data || [];
    res.status(200).json({
      status: 'success',
      data: list.map(f => ({ id: f.id, name: f.name })),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Eagleフォルダ取得エラー:`, {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    });
    res.status(500).json({
      status: 'error',
      message: `Eagleフォルダ一覧の取得に失敗しました: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
}