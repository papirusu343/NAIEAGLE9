import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { GenerationParams, CharacterConfig, SAMPLERS, PRESET_SIZES, STORAGE_KEYS, MODELS } from '../types/novelai';
import PromptInput from './PromptInput';

interface GenerationFormProps {
  onGenerate: (params: GenerationParams) => void;
  isGenerating: boolean;
  initialParams?: Partial<GenerationParams>;
  wildcardFiles: Map<string, string[]>;
  onParamsChange?: (params: Partial<GenerationParams>) => void;
}

// 幅・高さを 64 の倍数に常に「切り下げ」して 512〜2048 に収める
const snapDownTo64 = (v: number, min = 512, max = 2048) => {
  if (!Number.isFinite(v)) return min;
  let clamped = Math.min(max, Math.max(min, Math.floor(v)));
  clamped = Math.floor(clamped / 64) * 64;
  if (clamped < min) clamped = min;
  return clamped;
};

export default function GenerationForm({ onGenerate, isGenerating, initialParams, wildcardFiles, onParamsChange }: GenerationFormProps) {
  const [isClient, setIsClient] = useState(false);
  const [savedParams, setSavedParams] = useState<Partial<GenerationParams>>({});
  const [showCustomModel, setShowCustomModel] = useState(false);

  useEffect(() => {
    setIsClient(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LAST_GENERATION_PARAMS);
      if (saved) {
        setSavedParams(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Failed to load saved params:', error);
    }
  }, []);

  const getDefaultValues = (): GenerationParams => {
    const mergedParams = { ...savedParams, ...initialParams };
    return {
      prompt: mergedParams?.prompt || '',
      negativePrompt: mergedParams?.negativePrompt || 'nsfw, lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, extra digits, fewer digits, signature, watermark, username, blurry, artist name, text, error, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name',
      width: mergedParams?.width || 832,
      height: mergedParams?.height || 1216,
      steps: mergedParams?.steps || 28,
      scale: mergedParams?.scale || 5,
      cfgRescale: mergedParams?.cfgRescale || 0,
      seed: mergedParams?.seed,
      sampler: mergedParams?.sampler || 'k_euler_ancestral',
      model: mergedParams?.model || 'nai-diffusion-4-5-full',
      customModel: mergedParams?.customModel || '',
      characters: mergedParams?.characters || [],
      useCoords: mergedParams?.useCoords ?? false,
    };
  };

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<GenerationParams>({
    defaultValues: getDefaultValues(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'characters',
  });

  const watchModel = watch('model');
  const watchWidth = watch('width');
  const watchHeight = watch('height');
  const watchCharacters = watch('characters');
  const watchPrompt = watch('prompt');
  const watchNegativePrompt = watch('negativePrompt');
  const watchUseCoords = watch('useCoords');

  useEffect(() => {
    setShowCustomModel(watchModel === 'custom');
  }, [watchModel]);

  useEffect(() => {
    if (initialParams && Object.keys(initialParams).length > 0) {
      const newValues = { ...getDefaultValues(), ...initialParams };
      reset(newValues);
    }
  }, [initialParams, reset]);

  useEffect(() => {
    if (isClient && Object.keys(savedParams).length > 0 && (!initialParams || Object.keys(initialParams).length === 0)) {
      reset(getDefaultValues());
    }
  }, [savedParams, isClient, reset]);

  const watchedValues = watch();
  useEffect(() => {
    if (!isClient) return;

    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEYS.LAST_GENERATION_PARAMS, JSON.stringify(watchedValues));
        if (onParamsChange) {
          onParamsChange(watchedValues);
        }
      } catch (error) {
        console.warn('Failed to save params to localStorage:', error);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [watchedValues, isClient, onParamsChange]);

  const handlePresetSize = (width: number, height: number) => {
    setValue('width', width);
    setValue('height', height);
  };

  const handleRandomSeed = () => {
    setValue('seed', Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
  };

  const handleClearSeed = () => {
    setValue('seed', undefined);
  };

  const addCharacter = () => {
    let newCharacter: CharacterConfig = {
      caption: '',
      negativeCaption: '',
      x: 0.5,
      y: 0.5,
    };

    if (watchCharacters && watchCharacters.length > 0) {
      const lastCharacter = watchCharacters[watchCharacters.length - 1];
      newCharacter = {
        caption: lastCharacter.caption || '',
        negativeCaption: lastCharacter.negativeCaption || '',
        x: 0.5,
        y: 0.5,
      };
    }

    append(newCharacter);
  };

  const insertWildcard = (fieldName: 'prompt' | 'negativePrompt', category: string) => {
    const currentValue = watch(fieldName);
    const wildcardText = `__${category}__`;
    setValue(fieldName, currentValue + (currentValue ? ', ' : '') + wildcardText);
  };

  const onSubmit = (data: GenerationParams) => {
    // === 幅・高さを 64 の倍数へ常に切り下げ補正 ===
    const snappedWidth = snapDownTo64(data.width);
    const snappedHeight = snapDownTo64(data.height);
    if (snappedWidth !== data.width) {
      setValue('width', snappedWidth, { shouldValidate: true });
      data.width = snappedWidth;
    }
    if (snappedHeight !== data.height) {
      setValue('height', snappedHeight, { shouldValidate: true });
      data.height = snappedHeight;
    }

    if (isClient) {
      try {
        const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.GENERATION_HISTORY) || '[]');
        const newEntry = {
          ...data,
          timestamp: new Date().toISOString(),
        };
        history.unshift(newEntry);
        const trimmedHistory = history.slice(0, 10);
        localStorage.setItem(STORAGE_KEYS.GENERATION_HISTORY, JSON.stringify(trimmedHistory));
      } catch (error) {
        console.warn('Failed to save generation history:', error);
      }
    }

    onGenerate(data);
  };

  const isV4Model = watchModel && watchModel.includes('nai-diffusion-4');

  if (!isClient) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="h-20 bg-gray-700 rounded mb-4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/4 mb-2"></div>
            <div className="h-16 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:contents">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col space-y-6">
        {/* プロンプト - スマホで最初に表示 */}
        <div className="card order-1">
          <h3 className="text-lg font-semibold mb-4">プロンプト</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">ベースプロンプト</label>
              <PromptInput
                value={watchPrompt}
                onChange={(value) => setValue('prompt', value)}
                placeholder="1girl, masterpiece, best quality, __character__, __pose__..."
                rows={4}
              />
              {errors.prompt && (
                <p className="text-red-400 text-sm mt-1">{errors.prompt.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">ネガティブプロンプト</label>
              <PromptInput
                value={watchNegativePrompt}
                onChange={(value) => setValue('negativePrompt', value)}
                placeholder="nsfw, lowres, bad quality..."
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* キャラクター設定 - スマホで2番目に表示 */}
        <div className="card order-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">マルチキャラクター設定</h3>
            <button
              type="button"
              onClick={addCharacter}
              className="button-secondary flex items-center space-x-2"
            >
              <span className="text-lg">+</span>
              <span>キャラクター追加</span>
            </button>
          </div>

          {isV4Model && (
            <div className="mb-4 p-3 bg-gray-900 rounded border border-gray-600">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="useCoords"
                  {...register('useCoords')}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="useCoords" className="text-sm font-medium cursor-pointer">
                  座標情報を使用 (use_coords)
                </label>
              </div>
              <p className="text-xs text-gray-400 mt-1 ml-7">
                {watchUseCoords 
                  ? "✅ キャラクターの座標情報がプロンプトに反映されます" 
                  : "❌ 座標情報は無視され、通常のプロンプトとして処理されます"}
              </p>
            </div>
          )}

            {fields.length > 0 && (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="bg-gray-900 p-4 rounded border border-gray-600">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium">キャラクター {index + 1}</h4>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <span className="text-lg">×</span>
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">キャラクタープロンプト</label>
                        <PromptInput
                          value={watchCharacters[index]?.caption || ''}
                          onChange={(value) => setValue(`characters.${index}.caption`, value)}
                          placeholder="girl, blonde hair, blue eyes..."
                          rows={2}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">キャラクターネガティブプロンプト</label>
                        <PromptInput
                          value={watchCharacters[index]?.negativeCaption || ''}
                          onChange={(value) => setValue(`characters.${index}.negativeCaption`, value)}
                          placeholder="bad anatomy, extra limbs..."
                          rows={2}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">X座標 (0.0-1.0)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          {...register(`characters.${index}.x` as const, { 
                            valueAsNumber: true,
                            min: 0,
                            max: 1 
                          })}
                          className="input w-full"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">Y座標 (0.0-1.0)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          {...register(`characters.${index}.y` as const, { 
                            valueAsNumber: true,
                            min: 0,
                            max: 1 
                          })}
                          className="input w-full"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* モデル選択 - スマホで3番目に表示 */}
        <div className="card order-3">
          <h3 className="text-lg font-semibold mb-4">モデル選択</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">使用モデル</label>
              <select {...register('model')} className="select w-full">
                {MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.name} - {model.description}
                  </option>
                ))}
              </select>
            </div>

            {showCustomModel && (
              <div>
                <label className="block text-sm font-medium mb-2">カスタムモデル名</label>
                <input
                  type="text"
                  {...register('customModel', { 
                    required: watchModel === 'custom' ? 'カスタムモデル名は必須です' : false 
                  })}
                  className="input w-full"
                  placeholder="nai-diffusion-custom-model"
                />
                {errors.customModel && (
                  <p className="text-red-400 text-sm mt-1">{errors.customModel.message}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 画像設定 - スマホで4番目に表示 */}
        <div className="card order-4">
          <h3 className="text-lg font-semibold mb-4">画像設定</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">プリセットサイズ</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {PRESET_SIZES.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handlePresetSize(preset.width, preset.height)}
                    className={`button-secondary text-xs py-2 ${
                      watchWidth === preset.width && watchHeight === preset.height
                        ? 'bg-blue-600 text-white'
                        : ''
                    }`}
                  >
                    {preset.name}
                    <br />
                    {preset.width}×{preset.height}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">幅</label>
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
                  className="input w-full"
                />
                {errors.width && (
                  <p className="text-red-400 text-sm mt-1">{errors.width.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">高さ</label>
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
                  className="input w-full"
                />
                {errors.height && (
                  <p className="text-red-400 text-sm mt-1">{errors.height.message}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 生成設定 - スマホで5番目に表示 */}
        <div className="card order-5">
          <h3 className="text-lg font-semibold mb-4">生成設定</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">ステップ数</label>
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
                className="input w-full"
              />
              {errors.steps && (
                <p className="text-red-400 text-sm mt-1">{errors.steps.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">CFG Scale</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="30"
                {...register('scale', { 
                  required: 'CFG Scaleは必須です',
                  valueAsNumber: true,
                  min: 1,
                  max: 30 
                })}
                className="input w-full"
              />
              {errors.scale && (
                <p className="text-red-400 text-sm mt-1">{errors.scale.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">CFG Rescale</label>
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
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">サンプラー</label>
              <select {...register('sampler')} className="select w-full">
                {SAMPLERS.map((sampler) => (
                  <option key={sampler} value={sampler}>
                    {sampler}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium mb-1">シード値</label>
              <input
                type="number"
                min="0"
                {...register('seed', { 
                  valueAsNumber: true,
                  min: 0
                })}
                className="input w-full"
                placeholder="ランダム (制限なし)"
              />
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleRandomSeed}
                  className="button-secondary px-3 py-1 text-xs"
                  title="ランダムシード生成"
                >
                  🎲
                </button>
                <button
                  type="button"
                  onClick={handleClearSeed}
                  className="button-secondary px-3"
                  title="シードをクリア"
                >
                  🗑️
                </button>
              </div>
              <p className="text-xs text-gray-400">
                💡 シード値に上限はありません。任意の正の整数を入力できます。
              </p>
            </div>
          </div>
        </div>

        {/* 生成ボタン */}
        <div className="hidden lg:flex justify-center order-6">
          <button
            type="submit"
            disabled={isGenerating}
            data-generate-button
            className="button-primary px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                <span>生成中...</span>
              </div>
            ) : (
              '🎨 画像を生成'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}