import React, { useEffect, useState } from 'react';
import { PromptGeneratorTabProps } from './PromptGeneratorTab/types';
import { usePromptGeneratorState } from './PromptGeneratorTab/hooks/usePromptGeneratorState';
import { useTemplates } from './PromptGeneratorTab/hooks/useTemplates';
import { useGenerationParams } from './PromptGeneratorTab/hooks/useGenerationParams';
import { usePromptGeneration } from './PromptGeneratorTab/hooks/usePromptGeneration';
import { useImageGeneration } from './PromptGeneratorTab/hooks/useImageGeneration';
import { TemplateSelector } from './PromptGeneratorTab/components/TemplateSelector';
import { PromptTemplateSettings } from './PromptGeneratorTab/components/PromptTemplateSettings';
import { GenerationButtons } from './PromptGeneratorTab/components/GenerationButtons';
import { GenerationResults } from './PromptGeneratorTab/components/GenerationResults';
import { ImageGenerationForm } from './PromptGeneratorTab/components/ImageGenerationForm';

export const PromptGeneratorTab: React.FC<PromptGeneratorTabProps> = ({
  onPromptGenerated,
  wildcardFiles
}) => {
  const { state, updateState, isClient } = usePromptGeneratorState();
  const { templates } = useTemplates();
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    errors,
    fields,
    append,
    remove,
    watchModel,
    watchWidth,
    watchHeight,
    showCustomModel,
    removeCharacter,
    handlePresetSize,
    handleRandomSeed,
    handleClearSeed,
    saveParams
  } = useGenerationParams();

  const { generatedPrompt, loading, handleGenerate } = usePromptGeneration(
    templates,
    state as any,
    wildcardFiles,
    setValue,
    fields,
    remove,
    append
  );

  const { 
    isGenerating, 
    isGeneratingAll, 
    generatedImage, 
    imageHistory, 
    currentHistoryIndex,
    handleGenerateAndImage, 
    handleImageGenerate 
  } = useImageGeneration(
    templates,
    state as any,
    wildcardFiles,
    setValue,
    watch,
    fields,
    remove,
    append,
    saveParams
  );

  // ===== プリセット関連 =====
  const [presetName, setPresetName] = useState<string>('');
  const [presets, setPresets] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [loadingPresets, setLoadingPresets] = useState<boolean>(false);
  const [savingPreset, setSavingPreset] = useState<boolean>(false);
  const [deletingPreset, setDeletingPreset] = useState<boolean>(false);

  const loadPresets = async () => {
    try {
      setLoadingPresets(true);
      const res = await fetch('/api/generator-presets');
      if (res.ok) {
        const data = await res.json();
        setPresets(Array.isArray(data?.presets) ? data.presets : []);
      } else {
        setPresets([]);
      }
    } catch (e) {
      console.error('Failed to load presets:', e);
      setPresets([]);
    } finally {
      setLoadingPresets(false);
    }
  };

  const handleSavePreset = async () => {
    const name = presetName.trim();
    if (!name) return;
    try {
      setSavingPreset(true);
      const payload = {
        name,
        data: {
          state,
          formValues: typeof watch === 'function' ? watch() : {}
        }
      };
      const res = await fetch('/api/generator-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await loadPresets();
        setSelectedPreset(name);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Failed to save preset:', err);
      }
    } catch (e) {
      console.error('Failed to save preset:', e);
    } finally {
      setSavingPreset(false);
    }
  };

  const handleLoadPreset = async () => {
    const name = selectedPreset.trim();
    if (!name) return;
    try {
      setLoadingPresets(true);
      const res = await fetch(`/api/generator-presets?name=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        const preset = data?.data;
        if (preset?.state) {
          updateState(preset.state as any);
        }
        if (preset?.formValues) {
          reset(preset.formValues);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Failed to load preset:', err);
      }
    } catch (e) {
      console.error('Failed to load preset:', e);
    } finally {
      setLoadingPresets(false);
    }
  };

  const handleDeletePreset = async () => {
    const name = selectedPreset.trim();
    if (!name) return;
    try {
      setDeletingPreset(true);
      const res = await fetch('/api/generator-presets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        await loadPresets();
        setSelectedPreset('');
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Failed to delete preset:', err);
      }
    } catch (e) {
      console.error('Failed to delete preset:', e);
    } finally {
      setDeletingPreset(false);
    }
  };

  useEffect(() => {
    if (isClient) {
      loadPresets();
    }
  }, [isClient]);

  // プリセット管理UI
  const renderPresetManager = () => (
    <div className="rounded border border-gray-700 p-3 bg-gray-800/40">
      <h4 className="text-sm font-medium text-gray-200 mb-2">📦 プリセット管理（サーバー保存）</h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
        <input
          type="text"
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm"
          placeholder="プリセット名（保存）"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
        />
        <select
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm"
          value={selectedPreset}
          onChange={(e) => setSelectedPreset(e.target.value)}
        >
          <option value="">{loadingPresets ? '読込中...' : 'プリセットを選択...'}</option>
          {presets.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSavePreset}
          disabled={savingPreset}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm"
        >
          {savingPreset ? '保存中...' : '保存'}
        </button>
        <button
          onClick={handleLoadPreset}
          disabled={!selectedPreset || loadingPresets}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm"
        >
          読込
        </button>
        <button
          onClick={handleDeletePreset}
          disabled={!selectedPreset || deletingPreset}
          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm"
        >
          {deletingPreset ? '削除中...' : '削除'}
        </button>
      </div>
    </div>
  );

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <GenerationResults
          generatedPrompt={generatedPrompt}
          generatedImage={generatedImage}
          imageHistory={imageHistory}
          currentHistoryIndex={currentHistoryIndex}
          onGenerateAndImage={handleGenerateAndImage}
        />

        <div className="order-2 lg:order-1 space-y-6">
          <h3 className="text-xl font-semibold mb-6 text-gray-100">🤖 プロンプト自動生成</h3>
          
          <TemplateSelector
            templates={templates}
            selectedTemplate={(state as any).selectedTemplate}
            onTemplateChange={(template) => updateState({ selectedTemplate: template } as any)}
          />

          <div className="hidden lg:block">
            {renderPresetManager()}
          </div>

          <PromptTemplateSettings
            state={state as any}
            onStateChange={updateState as any}
            templates={templates}
          />

          <GenerationButtons
            loading={loading}
            isGeneratingAll={isGeneratingAll}
            isGenerating={isGenerating}
            selectedTemplate={(state as any).selectedTemplate}
            onGenerate={handleGenerate}
            onGenerateAndImage={handleGenerateAndImage}
          />
        </div>
      </div>

      {/* 画像生成フォーム */}
      <div>
        <ImageGenerationForm
          register={register}
          handleSubmit={handleSubmit}
          errors={errors}
          fields={fields}
          watchModel={watchModel}
          watchWidth={watchWidth}
          watchHeight={watchHeight}
          showCustomModel={showCustomModel}
          isGenerating={isGenerating}
          isGeneratingAll={isGeneratingAll}
          handlePresetSize={handlePresetSize}
          handleRandomSeed={handleRandomSeed}
          handleClearSeed={handleClearSeed}
          onSubmit={handleImageGenerate}
          removeCharacter={removeCharacter}
        />
      </div>

      <div className="lg:hidden">
        {renderPresetManager()}
      </div>

      <div className="card lg:hidden mb-20">
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
          <p className="text-blue-400">9. 画像をタップして全画面表示、左右端タップで履歴確認</p>
        </div>
      </div>
    </div>
  );
};