import React from 'react';

interface GenerationButtonsProps {
  loading: boolean;
  isGeneratingAll: boolean;
  isGenerating: boolean;
  selectedTemplate: string;
  onGenerate: () => void;
  onGenerateAndImage: () => void;
}

export const GenerationButtons: React.FC<GenerationButtonsProps> = ({
  loading,
  isGeneratingAll,
  isGenerating,
  selectedTemplate,
  onGenerate,
  onGenerateAndImage
}) => {
  return (
    <>
      {/* デスクトップ用ボタン */}
      <div className="hidden lg:flex space-x-3">
        <button
          onClick={onGenerate}
          disabled={loading || !selectedTemplate || isGenerating || isGeneratingAll}
          className={`flex-1 py-2 px-4 rounded-md text-white font-medium transition-colors ${
            loading || !selectedTemplate || isGenerating || isGeneratingAll
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
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
          disabled={isGeneratingAll || !selectedTemplate || loading || isGenerating}
          className={`flex-1 py-2 px-4 rounded-md text-white font-medium transition-colors ${
            isGeneratingAll || !selectedTemplate || loading || isGenerating
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
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
          disabled={loading || !selectedTemplate || isGenerating || isGeneratingAll}
          className={`flex-1 py-2 px-3 rounded-md text-white text-sm font-medium transition-all duration-200 ${
            loading || !selectedTemplate || isGenerating || isGeneratingAll
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
          disabled={isGeneratingAll || !selectedTemplate || loading || isGenerating}
          className={`flex-1 py-2 px-3 rounded-md text-white text-sm font-medium transition-all duration-200 ${
            isGeneratingAll || !selectedTemplate || loading || isGenerating
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