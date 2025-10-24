import React, { useState, useEffect, useCallback } from 'react';
import { GeneratedPrompt } from '../../../utils/promptGenerator';

// 画像履歴アイテムの型定義
interface ImageHistoryItem {
  id: string;
  imageUrl: string;
  generatedAt: string;
  params: any;
  templateUsed?: string;
}

interface GenerationResultsProps {
  generatedPrompt: GeneratedPrompt | null;
  generatedImage: string | null;
  imageHistory?: ImageHistoryItem[];
  currentHistoryIndex?: number;
  // 全画面表示でも「プロンプト生成＋画像生成」を呼び出すためのハンドラ
  onGenerateAndImage?: () => void;
}

export const GenerationResults: React.FC<GenerationResultsProps> = ({
  generatedPrompt,
  generatedImage,
  imageHistory = [],
  currentHistoryIndex = -1,
  onGenerateAndImage
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);

  const handleImageClick = () => {
    if (generatedImage) {
      setFullscreenIndex(currentHistoryIndex >= 0 ? currentHistoryIndex : 0);
      setIsFullscreen(true);
    }
  };

  const handleCloseFullscreen = () => {
    setIsFullscreen(false);
  };

  // 履歴ナビゲーション
  const handlePreviousImage = useCallback(() => {
    if (imageHistory.length > 0) {
      setFullscreenIndex(prev => 
        prev > 0 ? prev - 1 : imageHistory.length - 1
      );
    }
  }, [imageHistory.length]);

  const handleNextImage = useCallback(() => {
    if (imageHistory.length > 0) {
      setFullscreenIndex(prev => 
        prev < imageHistory.length - 1 ? prev + 1 : 0
      );
    }
  }, [imageHistory.length]);

  // キーボードイベント
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePreviousImage();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextImage();
          break;
        case 'Escape':
          e.preventDefault();
          handleCloseFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, handlePreviousImage, handleNextImage]);

  // タッチイベント（画像端タップ専用）
  const handleImageTouchStart = useCallback((e: React.TouchEvent) => {
    // イベントの伝播を防ぐ
    e.stopPropagation();
    
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const width = rect.width;
    
    if (x < width * 0.25) {
      // 左側25%をタップ
      e.preventDefault();
      handlePreviousImage();
    } else if (x > width * 0.75) {
      // 右側25%をタップ
      e.preventDefault();
      handleNextImage();
    }
  }, [handlePreviousImage, handleNextImage]);

  // 背景タッチイベント（閉じる専用）
  const handleBackgroundTouch = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleCloseFullscreen();
  }, []);

  const getCurrentFullscreenImage = () => {
    if (imageHistory.length === 0) return generatedImage;
    return imageHistory[fullscreenIndex]?.imageUrl || generatedImage;
  };

  const getCurrentImageInfo = () => {
    if (imageHistory.length === 0) return null;
    return imageHistory[fullscreenIndex];
  };

  return (
    <div className="order-1 lg:order-2 space-y-6">
      {/* 生成プロンプト表示 */}
      {generatedPrompt && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">生成されたプロンプト</h3>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-400 mb-1 font-medium">Main Prompt</div>
                <div className="text-white text-sm bg-gray-800 p-3 rounded border leading-relaxed">
                  {generatedPrompt.mainPrompt}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-gray-400 mb-1 font-medium">Character Prompts</div>
                {generatedPrompt.characterPrompts.map((prompt, index) => (
                  <div key={index} className="bg-gray-700 p-3 rounded border">
                    <div className="text-xs text-gray-400 mb-1 font-medium">Character {index + 1}</div>
                    <div className="text-white text-sm leading-relaxed">{prompt}</div>
                  </div>
                ))}
              </div>
            </div>
        </div>
      )}

      {/* 生成された画像表示 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">生成結果</h3>
          {imageHistory.length > 0 && (
            <div className="text-sm text-gray-400">
              履歴: {currentHistoryIndex + 1} / {imageHistory.length}
            </div>
          )}
        </div>
        {generatedImage ? (
          <div className="space-y-4">
            <img
              src={generatedImage}
              alt="Generated"
              className="w-full rounded-lg border border-gray-700 cursor-pointer hover:opacity-90 transition-opacity select-none"
              style={{
                WebkitTapHighlightColor: 'transparent',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none'
              }}
              onClick={handleImageClick}
              onTouchStart={(e) => e.preventDefault()}
            />
            {imageHistory.length > 1 && (
              <div className="text-xs text-gray-400 text-center">
                クリックで拡大表示（←→キーや画像端タップで履歴確認）
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-square bg-gray-900 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <span className="text-4xl mb-2 block">🎨</span>
              <p>生成された画像がここに表示されます</p>
            </div>
          </div>
        )}
      </div>

      {/* 全画面表示モーダル */}
      {isFullscreen && getCurrentFullscreenImage() && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50">
          {/* group を付与して、PC時はホバー時のみUIを表示 */}
          <div className="relative w-full h-full group">
            {/* 閉じるボタン（PCはホバー時のみ表示） */}
            <button
              onClick={handleCloseFullscreen}
              className="absolute top-2 right-2 lg:top-4 lg:right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition-all z-10 lg:opacity-0 lg:group-hover:opacity-100"
              aria-label="閉じる"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* 履歴ナビゲーションボタン（デスクトップ、PCはホバー時のみ表示） */}
            {imageHistory.length > 1 && (
              <>
                <button
                  onClick={handlePreviousImage}
                  className="hidden lg:block absolute left-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-3 hover:bg-opacity-75 transition-all z-10 lg:opacity-0 lg:group-hover:opacity-100"
                  aria-label="前の画像"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={handleNextImage}
                  className="hidden lg:block absolute right-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-3 hover:bg-opacity-75 transition-all z-10 lg:opacity-0 lg:group-hover:opacity-100"
                  aria-label="次の画像"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            {/* 画像情報表示（PCはホバー時のみ表示） */}
            {imageHistory.length > 0 && (
              <div className="absolute top-2 left-2 lg:top-4 lg:left-4 text-white bg-black bg-opacity-50 rounded px-3 py-2 text-sm z-10 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                {fullscreenIndex + 1} / {imageHistory.length}
                {getCurrentImageInfo()?.templateUsed && (
                  <div className="text-xs opacity-75">
                    {getCurrentImageInfo()?.templateUsed}
                  </div>
                )}
              </div>
            )}

            {/* PC: 全画面表示でも「プロンプト生成＋画像生成」ボタンを表示（ホバー時のみ表示） */}
            {onGenerateAndImage && (
              <div className="hidden lg:flex absolute bottom-4 left-1/2 -translate-x-1/2 z-10 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={onGenerateAndImage}
                  className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 shadow"
                >
                  🤖 プロンプト生成＋画像生成
                </button>
              </div>
            )}

            {/* メイン画像（PCでもビューポート淵まで拡大表示） */}
            <img
              src={getCurrentFullscreenImage()!}
              alt="Generated Fullscreen"
              className="w-full h-full object-contain cursor-default select-none"
              style={{
                WebkitTapHighlightColor: 'transparent',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none'
              }}
              onTouchStart={handleImageTouchStart}
              onTouchEnd={(e) => e.preventDefault()}
            />
          </div>

          {/* 背景クリック・タッチで閉じる（画像が全面のためPCでは背景クリック領域はほぼありません） */}
          <div
            className="absolute inset-0 -z-10"
            onClick={handleCloseFullscreen}
            onTouchStart={handleBackgroundTouch}
          />
        </div>
      )}

      {/* 使用方法の説明 - PCでのみ表示 */}
      <div className="card hidden lg:block">
        <h4 className="text-lg font-semibold text-gray-100 mb-4">💡 使用方法</h4>
        <div className="text-sm text-gray-400 space-y-2">
          <p>1. JSON編集タブでテンプレートファイルを作成してください</p>
          <p>2. 作成したテンプレートを選択してください</p>
          <p>3. メインプロンプトとキャラクタープロンプトのテンプレートを設定してください</p>
          <p>4. ネガティブプロンプトテンプレートも必要に応じて設定してください</p>
          <p>5a. 「プロンプト生成」でプロンプトのみ生成</p>
          <p>5b. 「プロンプト生成＋画像生成」でプロンプト生成後に即座に画像生成</p>
          <p>6. 生成パラメータを調整してください</p>
          <p>7. 「画像を生成」ボタンで画像を生成します</p>
          <p>8. 生成された画像は自動的にEagleに保存されます（接続時）</p>
          <p>9. 生成された画像をクリックすると全画面表示されます</p>
          <p className="text-blue-400">10. 全画面表示中は←→キーや画像左右端タップで生成履歴を確認できます</p>
        </div>
      </div>
    </div>
  );
};