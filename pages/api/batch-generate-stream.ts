import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { params: paramsString, count: countString, delaySeconds: delayString } = req.query;
  
  if (!paramsString || !countString) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const params = JSON.parse(paramsString as string);
  const count = parseInt(countString as string);
  const delaySeconds = parseInt(delayString as string) || 3;

  // SSE設定
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

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

    // 開始通知
    res.write(`data: ${JSON.stringify({ type: 'start', count })}\n\n`);

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
        res.write(`data: ${JSON.stringify({ type: 'stopped', index: i })}\n\n`);
        break;
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

      // 進行状況更新
      res.write(`data: ${JSON.stringify({ type: 'progress', current: i + 1, total: count })}\n\n`);

      // 既存の生成APIを使用
      const generateResponse = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          message: `Generation failed at image ${i + 1}: ${errorData.error || generateResponse.statusText}` 
        })}\n\n`);
        break;
      }

      const zipBlob = await generateResponse.blob();
      
      // ZIP展開処理
      const JSZip = require('jszip');
      const zip = new JSZip();
      const arrayBuffer = await zipBlob.arrayBuffer();
      const zipContent = await zip.loadAsync(arrayBuffer);
      
      const imageFiles = Object.keys(zipContent.files).filter(filename => 
        filename.toLowerCase().match(/\.(png|jpg|jpeg|webp)$/i) && !zipContent.files[filename].dir
      );

      if (imageFiles.length === 0) {
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          message: `No image found in ZIP for image ${i + 1}` 
        })}\n\n`);
        break;
      }

      const imageFile = zipContent.files[imageFiles[0]];
      const imageArrayBuffer = await imageFile.async('arraybuffer');

      // Eagle保存処理
      try {
        const metadata = {
          prompt: params.prompt,
          negativePrompt: params.negativePrompt,
          originalPrompt: params.prompt,
          originalNegativePrompt: params.negativePrompt,
          width: params.width,
          height: params.height,
          steps: params.steps,
          scale: params.scale,
          cfgRescale: params.cfgRescale,
          seed: params.seed,
          sampler: params.sampler,
          model: params.model === 'custom' ? params.customModel : params.model,
          characters: params.characters,
          generatedAt: new Date().toISOString(),
          modelType: 'NovelAI',
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

        const filename = `batch_${i + 1}_novelai_${Date.now()}.png`;
        const formData = new FormData();
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

      // 画像をbase64エンコードして送信
      const buffer = Buffer.from(imageArrayBuffer);
      const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;
      
      // 🔥 単一画像の完成を通知 - UI側で即座に表示される
      res.write(`data: ${JSON.stringify({ 
        type: 'image', 
        image: base64Image, 
        index: i 
      })}\n\n`);

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

    // 完了通知
    res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);

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

    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: error.message || '予期しないエラーが発生しました' 
    })}\n\n`);
  } finally {
    res.end();
  }
}