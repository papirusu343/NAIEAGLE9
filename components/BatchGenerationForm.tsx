import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { GenerationParams } from '../types/novelai';

interface BatchStatus {
  isRunning: boolean;
  currentIndex: number;
  totalCount: number;
  shouldStop: boolean;
  startedAt: Date | null;
}

interface BatchGenerationFormProps {
  generationParams: Partial<GenerationParams>;
  isGenerating: boolean;
  onBatchGenerate: (count: number, delaySeconds: number) => void;
  onStopGeneration: () => void;
}

export default function BatchGenerationForm({
  generationParams,
  isGenerating,
  onBatchGenerate,
  onStopGeneration,
}: BatchGenerationFormProps) {
  // 🔥 空欄を許可する状態管理
  const [batchCount, setBatchCount] = useState<string>('3');
  const [delaySeconds, setDelaySeconds] = useState<string>('3');
  const [batchStatus, setBatchStatus] = useState<BatchStatus>({
    isRunning: false,
    currentIndex: 0,
    totalCount: 0,
    shouldStop: false,
    startedAt: null,
  });

  // 状態を定期的にポーリング
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/batch-status');
        const status = await response.json();
        setBatchStatus(status);
      } catch (error) {
        console.error('Failed to fetch batch status:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleBatchGenerate = () => {
    if (!generationParams.prompt) {
      toast.error('プロンプトを入力してください');
      return;
    }
    
    // 🔥 空欄の場合は1として処理
    const count = batchCount === '' ? 1 : Math.max(1, parseInt(batchCount) || 1);
    const delay = delaySeconds === '' ? 1 : Math.max(1, parseInt(delaySeconds) || 1);
    
    onBatchGenerate(count, delay);
  };

  const progress = batchStatus.totalCount > 0 
    ? (batchStatus.currentIndex / batchStatus.totalCount) * 100 
    : 0;

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">🔄 連続画像生成</h3>
      
      {/* 生成設定 */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            生成枚数 (空欄=1枚)
          </label>
          <input
            type="number"
            value={batchCount}
            onChange={(e) => setBatchCount(e.target.value)}
            min="1"
            max="20"
            placeholder="1"
            className="input w-full"
            disabled={batchStatus.isRunning}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">
            画像間の待機時間（秒） (空欄=1秒)
          </label>
          <input
            type="number"
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(e.target.value)}
            min="1"
            max="60"
            placeholder="1"
            className="input w-full"
            disabled={batchStatus.isRunning}
          />
        </div>
      </div>

      {/* 進行状況表示 */}
      {batchStatus.isRunning && (
        <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              生成中: {batchStatus.currentIndex + 1} / {batchStatus.totalCount}
            </span>
            <span className="text-sm text-gray-400">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {batchStatus.shouldStop && (
            <p className="text-yellow-400 text-sm mt-2">⏸️ 停止処理中...</p>
          )}
        </div>
      )}

      {/* 他のブラウザでの生成状況表示 */}
      {batchStatus.isRunning && !isGenerating && (
        <div className="mb-6 p-4 bg-orange-900/20 border border-orange-500 rounded-lg">
          <p className="text-orange-400 text-sm">
            ⚠️ 他のブラウザで連続生成が実行中です
          </p>
        </div>
      )}

      {/* ボタン */}
      <div className="flex space-x-3">
        <button
          onClick={handleBatchGenerate}
          disabled={batchStatus.isRunning || isGenerating}
          className="button-primary flex-1 disabled:opacity-50"
        >
          {batchStatus.isRunning ? '生成中...' : `${batchCount || '1'}枚連続生成`}
        </button>
        
        {(batchStatus.isRunning || isGenerating) && (
          <button
            onClick={onStopGeneration}
            disabled={batchStatus.shouldStop}
            className="button-secondary px-6"
          >
            {batchStatus.shouldStop ? '停止中...' : '⏹️ 停止'}
          </button>
        )}
      </div>

      {/* 説明 */}
      <div className="mt-4 text-xs text-gray-400 space-y-1">
        <p>• 1枚生成→表示→保存→待機を指定回数繰り返します</p>
        <p>• 生成状態は他のブラウザからも確認できます</p>
        <p>• 途中で停止することも可能です</p>
        <p>• 空欄の場合は最小値（1）が適用されます</p>
      </div>
    </div>
  );
}