import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  // 1. 直接Eagle APIに接続テスト
  try {
    console.log(`[${new Date().toISOString()}] 直接Eagle API接続テスト開始`);
    const directResponse = await axios.get('http://localhost:41595/api/application/info', {
      timeout: 5000
    });
    
    results.tests.direct = {
      success: true,
      status: directResponse.status,
      data: directResponse.data,
      message: '直接接続成功'
    };
    console.log(`[${new Date().toISOString()}] 直接Eagle API接続成功`);
  } catch (error: any) {
    results.tests.direct = {
      success: false,
      error: error.message,
      code: error.code,
      response: error.response?.data,
      message: '直接接続失敗'
    };
    console.error(`[${new Date().toISOString()}] 直接Eagle API接続失敗:`, error.message);
  }

  // 2. プロキシ経由での接続テスト
  try {
    console.log(`[${new Date().toISOString()}] プロキシ経由Eagle API接続テスト開始`);
    const proxyResponse = await axios.post('/api/eagle-proxy', {
      endpoint: 'application/info',
      method: 'GET'
    }, {
      timeout: 10000
    });
    
    results.tests.proxy = {
      success: proxyResponse.data.success,
      status: proxyResponse.status,
      data: proxyResponse.data,
      message: 'プロキシ経由接続テスト完了'
    };
    console.log(`[${new Date().toISOString()}] プロキシ経由Eagle API接続テスト完了`);
  } catch (error: any) {
    results.tests.proxy = {
      success: false,
      error: error.message,
      response: error.response?.data,
      message: 'プロキシ経由接続失敗'
    };
    console.error(`[${new Date().toISOString()}] プロキシ経由Eagle API接続失敗:`, error.message);
  }

  // 3. Eagle画像リスト取得テスト
  try {
    console.log(`[${new Date().toISOString()}] Eagle画像リスト取得テスト開始`);
    const listResponse = await axios.get('/api/eagle-images', {
      timeout: 10000
    });
    
    results.tests.imageList = {
      success: listResponse.data.status === 'success',
      status: listResponse.status,
      imageCount: listResponse.data.data?.length || 0,
      total: listResponse.data.total,
      message: 'Eagle画像リスト取得テスト完了'
    };
    console.log(`[${new Date().toISOString()}] Eagle画像リスト取得テスト完了`);
  } catch (error: any) {
    results.tests.imageList = {
      success: false,
      error: error.message,
      response: error.response?.data,
      message: 'Eagle画像リスト取得失敗'
    };
    console.error(`[${new Date().toISOString()}] Eagle画像リスト取得失敗:`, error.message);
  }

  // 4. 環境変数チェック
  results.environment = {
    nodeEnv: process.env.NODE_ENV,
    hasEagleProxyUrl: !!process.env.EAGLE_PROXY_URL,
    eagleProxyUrl: process.env.EAGLE_PROXY_URL || 'not set',
    hasNovelaiApiKey: !!process.env.NOVELAI_API_KEY,
    port: process.env.PORT || 'not set'
  };

  console.log(`[${new Date().toISOString()}] Eagle診断テスト完了:`, results);

  return res.json(results);
}