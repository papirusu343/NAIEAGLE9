import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    console.log(`[${new Date().toISOString()}] Eagle保存API開始`);
    
    const form = formidable({
      keepExtensions: true,
      maxFileSize: 20 * 1024 * 1024, // 20MB
    });

    const [fields, files] = await form.parse(req);
    
    const imageFile = Array.isArray(files.image) ? files.image[0] : files.image;
    const settingsStr = Array.isArray(fields.settings) ? fields.settings[0] : fields.settings;

    console.log(`[${new Date().toISOString()}] ファイル解析結果:`, {
      hasImageFile: !!imageFile,
      imageSize: imageFile?.size,
      imageMimetype: imageFile?.mimetype,
      settingsStr: settingsStr
    });

    if (!imageFile) {
      return res.status(400).json({
        success: false,
        message: 'ファイルが見つかりません'
      });
    }

    // 設定を解析
    let settings: any = {};
    if (settingsStr) {
      try {
        settings = JSON.parse(settingsStr);
        console.log(`[${new Date().toISOString()}] 設定解析成功:`, settings);
      } catch (parseError) {
        console.warn('Settings parse error:', parseError);
        console.warn('Settings string:', settingsStr);
        settings = {};
      }
    }

    // ファイル検証
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(imageFile.mimetype || '')) {
      return res.status(400).json({
        success: false,
        message: `サポートされていないファイル形式です: ${imageFile.mimetype}`
      });
    }

    // ファイルデータをBase64に変換
    const fileBuffer = fs.readFileSync(imageFile.filepath);
    const base64Data = fileBuffer.toString('base64');
    const dataUrl = `data:${imageFile.mimetype};base64,${base64Data}`;
    
    console.log(`[${new Date().toISOString()}] Base64変換完了:`, {
      originalSize: fileBuffer.length,
      base64Size: base64Data.length,
      dataUrlSize: dataUrl.length
    });
    
    // Eagle APIに送信するペイロード
    const eaglePayload = {
      url: dataUrl,
      name: imageFile.originalFilename || `novelai_${Date.now()}.png`,
      website: settings.website || 'NovelAI',
      tags: settings.tags || [],
      annotation: settings.annotation || '',
      folderId: settings.folderId || null,
    };

    console.log('Eagle payload準備完了:', {
      name: eaglePayload.name,
      website: eaglePayload.website,
      tags: eaglePayload.tags,
      folderId: eaglePayload.folderId,
      urlLength: eaglePayload.url.length
    });

    // まずプロキシ経由を試す
    try {
      console.log(`[${new Date().toISOString()}] プロキシ経由でEagle APIに送信開始`);
      
      const proxyResponse = await fetch('/api/eagle-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'item/addFromURL',
          method: 'POST',
          data: eaglePayload
        })
      });

      const proxyResult = await proxyResponse.json();
      
      console.log(`[${new Date().toISOString()}] プロキシレスポンス:`, {
        success: proxyResult.success,
        status: proxyResult.status,
        dataStatus: proxyResult.data?.status
      });

      if (proxyResult.success && proxyResult.data?.status === 'success') {
        // 一時ファイルを削除
        fs.unlinkSync(imageFile.filepath);
        
        return res.json({
          success: true,
          message: 'Eagleに正常に保存されました（プロキシ経由）',
          itemId: proxyResult.data?.data?.id,
          data: proxyResult.data?.data
        });
      } else {
        throw new Error(proxyResult.message || proxyResult.data?.message || 'プロキシ経由でのEagle保存に失敗');
      }
    } catch (proxyError: any) {
      console.warn(`[${new Date().toISOString()}] プロキシ経由失敗、直接接続を試行:`, proxyError.message);
      
      // プロキシが失敗した場合は直接接続を試す
      try {
        console.log(`[${new Date().toISOString()}] 直接Eagle APIに送信開始`);
        
        const directResponse = await fetch('http://localhost:41595/api/item/addFromURL', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eaglePayload),
        });

        const directResult = await directResponse.json();
        
        console.log(`[${new Date().toISOString()}] 直接接続レスポンス:`, {
          ok: directResponse.ok,
          status: directResponse.status,
          dataStatus: directResult.status
        });

        if (directResponse.ok && directResult.status === 'success') {
          // 一時ファイルを削除
          fs.unlinkSync(imageFile.filepath);
          
          return res.json({
            success: true,
            message: 'Eagleに正常に保存されました（直接接続）',
            itemId: directResult.data?.id,
            data: directResult.data
          });
        } else {
          throw new Error(directResult.message || 'Eagle APIからエラーが返されました');
        }
      } catch (directError: any) {
        console.error(`[${new Date().toISOString()}] 直接接続も失敗:`, directError);
        throw new Error(`プロキシと直接接続の両方が失敗しました: ${directError.message}`);
      }
    }
  } catch (error: any) {
    console.error('Eagle save error:', error);
    
    // エラー時も一時ファイルを削除
    try {
      const form = formidable();
      const [, files] = await form.parse(req);
      const imageFile = Array.isArray(files.image) ? files.image[0] : files.image;
      if (imageFile && fs.existsSync(imageFile.filepath)) {
        fs.unlinkSync(imageFile.filepath);
      }
    } catch (cleanupError) {
      console.warn('一時ファイル削除エラー:', cleanupError);
    }
    
    return res.status(500).json({
      success: false,
      message: 'Eagle APIエラーが発生しました',
      error: error.message,
      details: {
        timestamp: new Date().toISOString(),
        errorType: error.constructor.name
      }
    });
  }
}