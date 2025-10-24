import React, { useState } from 'react';
import { GenerationParams, MODELS, SAMPLERS, PRESET_SIZES } from '../../../types/novelai';

interface ImageGenerationFormProps {
  register: any;
  handleSubmit: any;
  errors: any;
  fields: any[];
  watchModel: string;
  watchWidth: number;
  watchHeight: number;
  showCustomModel: boolean;
  isGenerating: boolean;
  isGeneratingAll: boolean;
  handlePresetSize: (width: number, height: number) => void;
  handleRandomSeed: () => void;
  handleClearSeed: () => void;
  onSubmit: (data: GenerationParams) => void;
  // addCharacter は削除、removeCharacter のみ使用
  removeCharacter: (index: number) => void;
}

export const ImageGenerationForm: React.FC<ImageGenerationFormProps> = ({
  register,
  handleSubmit,
  errors,
  fields,
  watchModel,
  watchWidth,
  watchHeight,
  showCustomModel,
  isGenerating,
  isGeneratingAll,
  handlePresetSize,
  handleRandomSeed,
  handleClearSeed,
  onSubmit,
  removeCharacter
}) => {
  // 折りたたみ（デフォルトで畳む）
  const [isMainCollapsed, setIsMainCollapsed] = useState(true);
  const [isNegativeCollapsed, setIsNegativeCollapsed] = useState(true);
  const [expandedCharIndex, setExpandedCharIndex] = useState<number | null>(null);

  const toggleChar = (index: number) => {
    setExpandedCharIndex(prev => (prev === index ? null : index));
  };

  const captionPreview = (v: string) => {
    if (!v) return '（未入力）';
    return v.length > 36 ? v.slice(0, 36) + '…' : v;
  };

  return (
    <div className="order-3">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 sm:space-y-6">
        {/* プロンプト設定（メイン/ネガ/キャラクターをこのカード内に集約、追加ボタンなし） */}
        <div className="card">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">プロンプト設定</h3>

          {/* メインプロンプト（折りたたみ） */}
          <div className="border border-gray-700 rounded mb-2 sm:mb-3 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsMainCollapsed(v => !v)}
              aria-expanded={!isMainCollapsed}
              className="w-full flex items-center justify-between px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-800/60 hover:bg-gray-800 transition-colors"
            >
              <span className="text-sm sm:text-base font-medium">メインプロンプト</span>
              <span className={`text-gray-400 transform transition-transform ${isMainCollapsed ? '' : 'rotate-90'}`}>▶</span>
            </button>
            <div className={`${isMainCollapsed ? 'hidden' : 'block'} px-2 py-2 sm:px-3 sm:py-3 bg-gray-800 border-t border-gray-700`}>
              <textarea
                {...register('prompt', { required: 'プロンプトは必須です' })}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="生成したいイメージを詳しく記述してください"
              />
              {errors.prompt && (
                <p className="text-red-400 text-xs sm:text-sm mt-1">{errors.prompt.message}</p>
              )}
            </div>
          </div>

          {/* ネガティブプロンプト（折りたたみ） */}
          <div className="border border-gray-700 rounded mb-2 sm:mb-3 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsNegativeCollapsed(v => !v)}
              aria-expanded={!isNegativeCollapsed}
              className="w-full flex items-center justify-between px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-800/60 hover:bg-gray-800 transition-colors"
            >
              <span className="text-sm sm:text-base font-medium">ネガティブプロンプト</span>
              <span className={`text-gray-400 transform transition-transform ${isNegativeCollapsed ? '' : 'rotate-90'}`}>▶</span>
            </button>
            <div className={`${isNegativeCollapsed ? 'hidden' : 'block'} px-2 py-2 sm:px-3 sm:py-3 bg-gray-800 border-t border-gray-700`}>
              <textarea
                {...register('negativePrompt')}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="除外したい要素を記述してください"
              />
            </div>
          </div>

          {/* キャラクタープロンプト（直接配置・見出しテキストなし、各キャラは個別に折りたたみ） */}
          <div>
            {fields.length === 0 && (
              <div className="text-center text-xs sm:text-sm text-gray-500 py-6 border border-dashed border-gray-700 rounded">
                表示するキャラクターがありません
              </div>
            )}

            <div className="space-y-2">
              {fields.map((field, index) => {
                const id = (field as any)?.id ?? `${index}`;
                const isOpen = expandedCharIndex === index;
                return (
                  <div key={id} className="rounded border border-gray-700 bg-gray-800/50 overflow-hidden">
                    {/* ヘッダー（折りたたみトグル） */}
                    <button
                      type="button"
                      onClick={() => toggleChar(index)}
                      className="w-full flex items-center justify-between px-2 py-1.5 sm:px-3 sm:py-2 text-left hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] sm:text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                          {index + 1}
                        </span>
                        <span className="text-xs sm:text-sm text-gray-100">
                          {captionPreview((field as any)?.caption || '')}
                        </span>
                      </div>
                      <span className={`text-gray-400 transform transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                    </button>

                    {/* 本体（ポジティブ／ネガティブ） */}
                    {isOpen && (
                      <div className="px-2 py-2 sm:px-3 sm:py-3 border-t border-gray-700 bg-gray-900/40 space-y-3">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium mb-1">キャラクタープロンプト</label>
                          <textarea
                            {...register(`characters.${index}.caption` as const)}
                            rows={2}
                            className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="girl, blonde hair..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium mb-1">ネガティブプロンプト</label>
                          <textarea
                            {...register(`characters.${index}.negativeCaption` as const)}
                            rows={2}
                            className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="bad anatomy..."
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeCharacter(index)}
                            className="text-red-400 hover:text-red-300 text-xs sm:text-sm"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* モデル選択 */}
        <div className="card">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">モデル選択</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2">使用モデル</label>
              <select
                {...register('model')}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.name} - {model.description}
                  </option>
                ))}
              </select>
            </div>

            {showCustomModel && (
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2">カスタムモデル名</label>
                <input
                  type="text"
                  {...register('customModel', { 
                    required: watchModel === 'custom' ? 'カスタムモデル名は必須です' : false 
                  })}
                  className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="nai-diffusion-custom-model"
                />
                {errors.customModel && (
                  <p className="text-red-400 text-xs sm:text-sm mt-1">{errors.customModel.message}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 画像設定 */}
        <div className="card">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">画像設定</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2">プリセットサイズ</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PRESET_SIZES.map((preset) => (
                  <button
                    key={`${preset.width}x${preset.height}`}
                    type="button"
                    onClick={() => handlePresetSize(preset.width, preset.height)}
                    className={`px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm rounded transition-colors ${
                      watchWidth === preset.width && watchHeight === preset.height
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {preset.name.replace('\n', ' ')} ({preset.width}x{preset.height})
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2">幅</label>
                <input
                  type="number"
                  step="64"
                  min="512"
                  max="2048"
                  {...register('width', { 
                    required: '幅は必須です',
                    valueAsNumber: true,
                    min: 512,
                    max: 2048 
                  })}
                  className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.width && (
                  <p className="text-red-400 text-xs sm:text-sm mt-1">{errors.width.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2">高さ</label>
                <input
                  type="number"
                  step="64"
                  min="512"
                  max="2048"
                  {...register('height', { 
                    required: '高さは必須です',
                    valueAsNumber: true,
                    min: 512,
                    max: 2048 
                  })}
                  className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.height && (
                  <p className="text-red-400 text-xs sm:text-sm mt-1">{errors.height.message}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 生成設定 */}
        <div className="card">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">生成設定</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2">ステップ数</label>
              <input
                type="number"
                min="1"
                max="50"
                {...register('steps', { 
                  required: 'ステップ数は必須です',
                  valueAsNumber: true,
                  min: 1,
                  max: 50 
                })}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.steps && (
                <p className="text-red-400 text-xs sm:text-sm mt-1">{errors.steps.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2">CFG Scale</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="10"
                {...register('scale', { 
                  required: 'CFG Scaleは必須です',
                  valueAsNumber: true,
                  min: 1,
                  max: 10 
                })}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.scale && (
                <p className="text-red-400 text-xs sm:text-sm mt-1">{errors.scale.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2">CFG Rescale</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                {...register('cfgRescale', { 
                  valueAsNumber: true,
                  min: 0,
                  max: 1 
                })}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2">サンプラー</label>
              <select
                {...register('sampler')}
                className="w-full px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SAMPLERS.map((sampler) => (
                  <option key={sampler} value={sampler}>
                    {sampler}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2">シード値（オプション）</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  {...register('seed', { valueAsNumber: true })}
                  className="flex-1 px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ランダム"
                />
                <button
                  type="button"
                  onClick={handleRandomSeed}
                  className="px-2 py-1.5 sm:px-3 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs sm:text-sm"
                >
                  🎲
                </button>
                <button
                  type="button"
                  onClick={handleClearSeed}
                  className="px-2 py-1.5 sm:px-3 sm:py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-xs sm:text-sm"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 生成ボタン */}
        <button
          type="submit"
          disabled={isGenerating || isGeneratingAll}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2.5 sm:py-3 px-4 rounded-md transition-colors"
        >
          {isGenerating ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              画像生成中...
            </div>
          ) : (
            '🎨 画像を生成'
          )}
        </button>
      </form>
    </div>
  );
};

ImageGenerationForm.displayName = 'ImageGenerationForm';