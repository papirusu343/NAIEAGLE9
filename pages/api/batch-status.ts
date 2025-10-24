import { NextApiRequest, NextApiResponse } from 'next';

// グローバル状態管理（実際のプロダクションではRedisやデータベースを使用）
let batchGenerationState = {
  isRunning: false,
  currentIndex: 0,
  totalCount: 0,
  shouldStop: false,
  startedAt: null as Date | null,
  currentParams: null as any,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // 現在の状態を返す
    res.status(200).json(batchGenerationState);
  } else if (req.method === 'POST') {
    const { action, params } = req.body;

    switch (action) {
      case 'start':
        batchGenerationState = {
          isRunning: true,
          currentIndex: 0,
          totalCount: params.count,
          shouldStop: false,
          startedAt: new Date(),
          currentParams: params,
        };
        res.status(200).json({ success: true, state: batchGenerationState });
        break;

      case 'stop':
        batchGenerationState.shouldStop = true;
        res.status(200).json({ success: true, state: batchGenerationState });
        break;

      case 'update':
        batchGenerationState.currentIndex = params.currentIndex;
        if (params.currentIndex >= batchGenerationState.totalCount) {
          batchGenerationState.isRunning = false;
          batchGenerationState.shouldStop = false;
        }
        res.status(200).json({ success: true, state: batchGenerationState });
        break;

      case 'reset':
        batchGenerationState = {
          isRunning: false,
          currentIndex: 0,
          totalCount: 0,
          shouldStop: false,
          startedAt: null,
          currentParams: null,
        };
        res.status(200).json({ success: true, state: batchGenerationState });
        break;

      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}