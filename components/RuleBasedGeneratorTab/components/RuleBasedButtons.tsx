import React from 'react';

interface RuleBasedButtonsProps {
  loading: boolean;
  isGeneratingAll: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  onGenerateAndImage: () => void;
}

/**
 * ルールベース生成タブ専用の操作ボタン
 * - 見た目はランダムプロンプト生成タブのボタンに合わせてあります
 * - selectedTemplate などの判定は不要のため削除（ルールベースはテンプレJSONに依存しないため）
 */
export const RuleBasedButtons: React.FC<RuleBasedButtonsProps> = ({
  loading,
  isGeneratingAll,
  isGenerating,
  onGenerate,
  onGenerateAndImage
}) => {
  const disabledGenerate = loading || isGenerating || isGeneratingAll;
  const disabledGenerateAndImage = isGeneratingAll || loading || isGenerating;

  return (
    <>
      {/* デスクトップ用ボタン */}
      <div className="hidden lg:flex space-x-3">
        <button
          onClick={onGenerate}
          disabled={disabledGenerate}
          className={`flex-1 py-2 px-4 rounded-md text-white font-medium transition-colors ${
            disabledGenerate ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              生成中...
            </div>
          ) : (
            '🎲 プロンプト生成'
          )}
        </button>

        <button
          onClick={onGenerateAndImage}
          disabled={disabledGenerateAndImage}
          className={`flex-1 py-2 px-4 rounded-md text-white font-medium transition-colors ${
            disabledGenerateAndImage ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isGeneratingAll ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              生成中...
            </div>
          ) : (
            '🎲🎨 プロンプト生成＋画像生成'
          )}
        </button>
      </div>

      {/* モバイル用フローティングボタン */}
      <div className="lg:hidden fixed bottom-4 left-3 right-3 z-50 flex space-x-2">
        <button
          onClick={onGenerate}
          disabled={disabledGenerate}
          className={`flex-1 py-2 px-3 rounded-md text-white text-sm font-medium transition-all duration-200 ${
            disabledGenerate
              ? 'bg-gray-700 cursor-not-allowed opacity-60'
              : 'bg-gray-800 hover:bg-gray-700 active:scale-95 border border-gray-600'
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full mr-1"></div>
              生成中
            </div>
          ) : (
            '🎲 プロンプト生成'
          )}
        </button>

        <button
          onClick={onGenerateAndImage}
          disabled={disabledGenerateAndImage}
          className={`flex-1 py-2 px-3 rounded-md text-white text-sm font-medium transition-all duration-200 ${
            disabledGenerateAndImage
              ? 'bg-gray-700 cursor-not-allowed opacity-60'
              : 'bg-gray-800 hover:bg-gray-700 active:scale-95 border border-gray-600'
          }`}
        >
          {isGeneratingAll ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full mr-1"></div>
              生成中
            </div>
          ) : (
            '🎲🎨 生成＋画像'
          )}
        </button>
      </div>
    </>
  );
};