import { NextApiRequest, NextApiResponse } from 'next';
import { GenerationParams } from '../../types/novelai';
import { novelAIAPI } from '../../utils/novelai';

const NOVELAI_API_KEY = process.env.NOVELAI_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!NOVELAI_API_KEY) {
    console.error('NOVELAI_API_KEY is not set in environment variables');
    return res.status(500).json({ 
      error: 'NovelAI API key is not configured. Please set NOVELAI_API_KEY in your environment variables.' 
    });
  }

  try {
    const params: GenerationParams = req.body;
    
    console.log(`[${new Date().toISOString()}] Generation request received:`, {
      model: params.model,
      prompt: params.prompt?.substring(0, 100) + '...',
      width: params.width,
      height: params.height,
      steps: params.steps,
      scale: params.scale,
      useCoords: params.useCoords,
      charactersCount: params.characters?.length || 0,
      timestamp: new Date().toISOString()
    });

    const imageBlob = await novelAIAPI.generateImage(params, NOVELAI_API_KEY);
    
    // BlobをArrayBufferに変換
    const arrayBuffer = await imageBlob.arrayBuffer();
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', arrayBuffer.byteLength.toString());
    res.setHeader('Content-Disposition', 'attachment; filename="generated.zip"');
    res.status(200).send(Buffer.from(arrayBuffer));

    console.log(`[${new Date().toISOString()}] Generation completed successfully`);

  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Generation API error:`, error);
    
    const errorMessage = error.message || 'Image generation failed';
    const statusCode = error.name === 'NovelAIError' ? 400 : 500;
    
    res.status(statusCode).json({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
}