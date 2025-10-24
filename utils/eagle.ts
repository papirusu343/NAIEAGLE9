import axios from 'axios';

export interface EagleImage {
  id: string;
  name: string;
  size?: number;
  ext?: string;
  tags: string[];
  folders?: string[];
  isDeleted?: boolean;
  url: string;
  thumbUrl?: string;
  annotation: string;
  modificationTime?: number;
  height?: number;
  width?: number;
  lastModified?: number;
  palettes?: any[];
  noThumbnail?: boolean;
  metadata?: ImageMetadata;
  mtime?: number;
  isFavorite?: boolean; // 🔥 お気に入りフラグを追加
}

export interface ImageMetadata {
  prompt?: string;
  negativePrompt?: string;
  parameters?: any;
  generatedAt?: string;
  model?: string;
  source?: string;
}

export interface EagleResponse<T> {
  status: string;
  data: T;
  message?: string;
  total?: number;
  valid?: number;
  timestamp?: string;
}

export interface EagleFolder {
  id: string;
  name: string;
}

// プロキシ経由でEagle APIを呼び出すヘルパー関数
async function callEagleProxy(endpoint: string, method: string = 'GET', data?: any, params?: any) {
  try {
    console.log(`[${new Date().toISOString()}] callEagleProxy開始 - endpoint: ${endpoint}, method: ${method}`);
    
    const response = await axios.post('/api/eagle-proxy', {
      endpoint,
      method,
      data,
      params
    }, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`[${new Date().toISOString()}] callEagleProxy レスポンス:`, {
      success: response.data.success,
      status: response.data.status,
      dataExists: !!response.data.data
    });

    if (!response.data.success) {
      console.error(`[${new Date().toISOString()}] callEagleProxy エラー:`, response.data);
      throw new Error(response.data.message || 'Eagle APIプロキシエラー');
    }

    return response.data.data;
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] callEagleProxy 例外:`, {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    if (error.response && error.response.data) {
      throw new Error(error.response.data.message || 'プロキシ通信エラー');
    }
    throw error;
  }
}

// 直接Eagle APIを呼び出すヘルパー関数（フォールバック用）
async function callEagleDirect(endpoint: string, method: string = 'GET', data?: any, params?: any) {
  const EAGLE_API_BASE = 'http://localhost:41595/api';
  
  try {
    console.log(`[${new Date().toISOString()}] callEagleDirect開始 - endpoint: ${endpoint}, method: ${method}`);
    
    let response;
    const url = `${EAGLE_API_BASE}/${endpoint}`;
    
    if (method.toUpperCase() === 'GET') {
      response = await axios.get(url, {
        params,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } else if (method.toUpperCase() === 'POST') {
      response = await axios.post(url, data, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    console.log(`[${new Date().toISOString()}] callEagleDirect 成功:`, {
      status: response?.status,
      dataStatus: response?.data?.status
    });

    return response?.data;
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] callEagleDirect エラー:`, {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
}

export class EagleAPI {
  async testConnection(): Promise<boolean> {
    try {
      console.log(`[${new Date().toISOString()}] Eagle接続テスト開始`);
      
      // まずプロキシ経由を試す
      try {
        const response = await callEagleProxy('application/info', 'GET');
        console.log(`[${new Date().toISOString()}] Eagle接続テスト成功（プロキシ経由）`);
        return response.status === 'success' || !!response.version;
      } catch (proxyError) {
        console.warn(`[${new Date().toISOString()}] プロキシ経由の接続テスト失敗:`, proxyError);
        
        // プロキシが失敗した場合は直接接続を試す
        try {
          const response = await callEagleDirect('application/info', 'GET');
          console.log(`[${new Date().toISOString()}] Eagle接続テスト成功（直接接続）`);
          return response.status === 'success' || !!response.version;
        } catch (directError) {
          console.error(`[${new Date().toISOString()}] 直接接続も失敗:`, directError);
          return false;
        }
      }
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Eagle接続テスト完全失敗:`, error);
      return false;
    }
  }

  async getAllImages(page: number = 1, limit: number = 200): Promise<EagleImage[]> {
    try {
      console.log(`[${new Date().toISOString()}] Eagle画像取得開始 - Page: ${page}, Limit: ${limit}`);
      
      // 新しいローカルファイル対応エンドポイントを使用
      const response = await axios.get<EagleResponse<EagleImage[]>>('/api/eagle-images', {
        timeout: 60000
      });

      if (response.data.status === 'success') {
        const images = response.data.data || [];
        console.log(`[${new Date().toISOString()}] Eagle画像取得成功 - 取得件数: ${images.length}`);
        return images;
      } else {
        throw new Error('Eagle API returned unsuccessful status');
      }
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Failed to get images from Eagle:`, error);
      throw new Error(`Eagle API Error: ${error.message}`);
    }
  }

  // 🔥 フォルダ一覧取得
  async getFolders(): Promise<EagleFolder[]> {
    try {
      console.log(`[${new Date().toISOString()}] Eagleフォルダ一覧取得開始`);
      const response = await axios.get<EagleResponse<EagleFolder[]>>('/api/eagle-folders', {
        timeout: 30000
      });
      if (response.data.status === 'success') {
        const folders = response.data.data || [];
        console.log(`[${new Date().toISOString()}] フォルダ取得成功: ${folders.length}件`);
        return folders;
      }
      throw new Error('Eagle folder API returned unsuccessful status');
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] フォルダ一覧取得失敗:`, error);
      throw new Error(`フォルダ一覧の取得に失敗しました: ${error.message}`);
    }
  }

  // 🔥 お気に入り設定/解除のメソッドを追加
  async toggleFavorite(imageId: string): Promise<boolean> {
    try {
      console.log(`[${new Date().toISOString()}] お気に入り切り替え開始 - imageId: ${imageId}`);
      
      const response = await axios.post('/api/eagle-favorite', {
        imageId,
        action: 'toggle'
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        console.log(`[${new Date().toISOString()}] お気に入り切り替え成功 - isFavorite: ${response.data.isFavorite}`);
        return response.data.isFavorite;
      } else {
        throw new Error(response.data.message || 'お気に入り設定に失敗しました');
      }
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] お気に入り切り替えエラー:`, error);
      throw new Error(`お気に入り設定エラー: ${error.message}`);
    }
  }

  // 🔥 お気に入り状態取得のメソッドを追加
  async getFavoriteStatus(imageId: string): Promise<boolean> {
    try {
      const response = await axios.get('/api/eagle-favorite', {
        params: { imageId },
        timeout: 10000
      });

      return response.data.isFavorite || false;
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] お気に入り状態取得エラー:`, error);
      return false;
    }
  }

  async addImageFromBlob(
    imageBlob: Blob, 
    filename: string, 
    metadata: any
  ): Promise<void> {
    try {
      console.log(`[${new Date().toISOString()}] Eagle画像保存開始 - ファイル名: ${filename}`);

      // 一時的なファイルURLを作成
      const arrayBuffer = await imageBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const dataUrl = `data:image/png;base64,${base64}`;
      
      // メタデータをJSON文字列として準備
      const annotationData = {
        ...metadata,
        importedAt: new Date().toISOString(),
        source: 'NovelAI Generator'
      };

      const requestData = {
        path: dataUrl,
        name: filename.replace(/\.[^/.]+$/, ""), // 拡張子を除去
        website: 'https://novelai.net',
        tags: ['AI Generated', 'NovelAI'],
        annotation: JSON.stringify(annotationData, null, 2),
        modificationTime: Date.now()
      };

      console.log(`[${new Date().toISOString()}] Eagle API request data:`, {
        name: requestData.name,
        tags: requestData.tags,
        website: requestData.website,
        dataUrlLength: dataUrl.length
      });

      // まずプロキシ経由を試す
      try {
        const response = await callEagleProxy('item/addFromPath', 'POST', requestData);
        
        if (response.status !== 'success') {
          console.error('Eagle API Error Response (proxy):', response);
          throw new Error(`Eagle API Error: ${response.message || JSON.stringify(response)}`);
        }

        console.log(`[${new Date().toISOString()}] Successfully added image to Eagle (proxy):`, response);
        return;
      } catch (proxyError) {
        console.warn(`[${new Date().toISOString()}] プロキシ経由の保存失敗、直接接続を試行:`, proxyError);
        
        // プロキシが失敗した場合は直接接続を試す
        try {
          const response = await callEagleDirect('item/addFromPath', 'POST', requestData);
          
          if (response.status !== 'success') {
            console.error('Eagle API Error Response (direct):', response);
            throw new Error(`Eagle API Error: ${response.message || JSON.stringify(response)}`);
          }

          console.log(`[${new Date().toISOString()}] Successfully added image to Eagle (direct):`, response);
          return;
        } catch (directError) {
          console.error(`[${new Date().toISOString()}] 直接接続も失敗:`, directError);
          throw directError;
        }
      }
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Eagle API Error:`, error);
      
      let errorMessage = 'Eagle APIエラーが発生しました';
      
      if (error.response) {
        errorMessage += `\nHTTP ${error.response.status}: ${error.response.statusText}`;
        if (error.response.data) {
          errorMessage += `\n詳細: ${JSON.stringify(error.response.data)}`;
        }
      } else if (error.request) {
        errorMessage += '\nネットワークエラー: Eagleに接続できません\n確認事項:\n• Eagleアプリケーションが起動していますか？\n• Eagle設定でHTTP API serverが有効になっていますか？\n• ポート41595がブロックされていませんか？\n• ファイアウォールでブロックされていませんか？';
      } else {
        errorMessage += `\n${error.message}`;
      }
      
      throw new Error(errorMessage);
    }
  }

  getImageThumbnail(imageId: string, size: number = 300): string {
    // ローカルファイル対応の場合は、直接サムネイルURLを返す
    return `/api/image-proxy?path=${encodeURIComponent(`thumbnail_${imageId}_${size}`)}`;
  }
}

// クラスのインスタンスを作成してエクスポート
export const eagleAPI = new EagleAPI();

// デフォルトエクスポートも追加
export default eagleAPI;