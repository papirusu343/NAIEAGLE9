import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

// Eagle APIのベースURL（プロキシ経由で変更可能）
const getEagleApiBase = () => {
  // 環境変数でプロキシ設定を確認
  if (process.env.EAGLE_PROXY_URL) {
    console.log(`[${new Date().toISOString()}] Eagle Proxy URL使用: ${process.env.EAGLE_PROXY_URL}`);
    return process.env.EAGLE_PROXY_URL;
  }
  // デフォルトはローカルホスト
  console.log(`[${new Date().toISOString()}] Eagle Default URL使用: http://localhost:41595`);
  return 'http://localhost:41595';
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { endpoint, method = 'GET', data, params } = req.body;
    
    console.log(`[${new Date().toISOString()}] Eagle Proxy Request:`, {
      endpoint,
      method,
      hasData: !!data,
      hasParams: !!params
    });
    
    if (!endpoint) {
      return res.status(400).json({ 
        success: false, 
        message: 'エンドポイントが指定されていません' 
      });
    }

    const eagleApiBase = getEagleApiBase();
    const url = `${eagleApiBase}/api/${endpoint}`;

    console.log(`[${new Date().toISOString()}] Eagle API Request: ${method} ${url}`);

    let response;
    
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
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'サポートされていないHTTPメソッドです' 
      });
    }

    console.log(`[${new Date().toISOString()}] Eagle API Response:`, {
      status: response.status,
      dataStatus: response.data?.status,
      hasData: !!response.data
    });

    return res.json({
      success: true,
      data: response.data,
      status: response.status
    });

  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Eagle API Proxy Error:`, {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method
    });
    
    let errorMessage = 'Eagle APIプロキシエラーが発生しました';
    let statusCode = 500;
    
    if (error.response) {
      errorMessage += `\nHTTP ${error.response.status}: ${error.response.statusText}`;
      statusCode = error.response.status;
      if (error.response.data) {
        errorMessage += `\n詳細: ${JSON.stringify(error.response.data)}`;
      }
    } else if (error.request) {
      errorMessage += '\nネットワークエラー: Eagleに接続できません\n確認事項:\n• Eagleアプリケーションが起動していますか？\n• Eagle設定でHTTP API serverが有効になっていますか？\n• プロキシ設定が正しいですか？\n• ポート41595がアクセス可能ですか？';
      statusCode = 503;
    } else {
      errorMessage += `\n${error.message}`;
    }
    
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message
    });
  }
}