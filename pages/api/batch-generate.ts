import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { params, count, delaySeconds = 3 } = req.body;

  try {
    const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
    
    // 連続生成開始状態をセット
    await fetch(`${baseUrl}/api/batch-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start',
        params: { count, ...params }
      }),
    });

    const generatedImages: string[] = [];

    for (let i = 0; i < count; i++) {
      // 停止要求チェック
      const statusResponse = await fetch(`${baseUrl}/api/batch-status`);
      const status = await statusResponse.json();
      
      if (status.shouldStop) {
        await fetch(`${baseUrl}/api/batch-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' }),
        });
        return res.status(200).json({
          success: true,
          stopped: true,
          generatedCount: i,
          images: generatedImages
        });
      }

      // 現在のインデックスを更新
      await fetch(`${baseUrl}/api/batch-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          params: { currentIndex: i }
        }),
      });

      // 既存の生成APIを使用
      const generateResponse = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(`Generation failed at image ${i + 1}: ${errorData.error || generateResponse.statusText}`);
      }

      const zipBlob = await generateResponse.blob();
      
      // ZIP展開処理（サーバー側で実行）
      const JSZip = require('jszip');
      const zip = new JSZip();
      
      // BlobをArrayBufferに変換
      const arrayBuffer = await zipBlob.arrayBuffer();
      const zipContent = await zip.loadAsync(arrayBuffer);
      
      const imageFiles = Object.keys(zipContent.files).filter(filename => 
        filename.toLowerCase().match(/\.(png|jpg|jpeg|webp)$/i) && !zipContent.files[filename].dir
      );

      if (imageFiles.length === 0) {
        throw new Error(`No image found in ZIP for image ${i + 1}`);
      }

      const imageFile = zipContent.files[imageFiles[0]];
      const imageArrayBuffer = await imageFile.async('arraybuffer');
      
      // Eagle保存処理
      try {
        const metadata = {
          ...params,
          generatedAt: new Date().toISOString(),
          batchIndex: i + 1,
          batchTotal: count,
        };

        const tags = [
          'NovelAI',
          'BatchGenerated',
          params.model === 'custom' ? params.customModel : params.model,
          params.sampler
        ].filter(Boolean);

        const settings = {
          website: 'NovelAI',
          tags: tags,
          annotation: JSON.stringify(metadata, null, 2),
          folderId: 'LUOVAHFV3SGUZ',
        };

        const formData = new FormData();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `batch_${i + 1}_novelai_${timestamp}.png`;
        
        // ArrayBufferからBlobを作成
        const imageBlob = new Blob([imageArrayBuffer], { type: 'image/png' });
        formData.append('image', imageBlob, filename);
        formData.append('settings', JSON.stringify(settings));

        const eagleResponse = await fetch(`${baseUrl}/api/save-to-eagle`, {
          method: 'POST',
          body: formData,
        });

        if (!eagleResponse.ok) {
          console.warn(`Eagle save failed for image ${i + 1}`);
        }
      } catch (eagleError) {
        console.warn(`Eagle save error for image ${i + 1}:`, eagleError);
      }

      // 画像URLを生成（base64エンコード）
      const buffer = Buffer.from(imageArrayBuffer);
      const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;
      generatedImages.push(base64Image);

      // 最終画像でない場合は待機
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
      }
    }

    // 完了状態に更新
    await fetch(`${baseUrl}/api/batch-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        params: { currentIndex: count }
      }),
    });

    res.status(200).json({
      success: true,
      generatedCount: count,
      images: generatedImages
    });

  } catch (error: any) {
    console.error('Batch generation error:', error);
    
    // エラー時は状態をリセット
    try {
      const baseUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
      await fetch(`${baseUrl}/api/batch-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
    } catch (resetError) {
      console.error('Failed to reset batch status:', resetError);
    }

    res.status(500).json({
      error: error.message || 'Batch generation failed',
      generatedCount: 0,
      images: []
    });
  }
}