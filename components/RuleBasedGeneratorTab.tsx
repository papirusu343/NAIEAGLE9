import React, { useEffect, useState } from 'react';
import { usePromptGeneratorState } from './PromptGeneratorTab/hooks/usePromptGeneratorState';
import { useGenerationParams } from './PromptGeneratorTab/hooks/useGenerationParams';
import { ImageGenerationForm } from './PromptGeneratorTab/components/ImageGenerationForm';
import { useRuleBasedGeneration } from './RuleBasedGeneratorTab/hooks/useRuleBasedGeneration';
import { useRuleImageGeneration } from './RuleBasedGeneratorTab/hooks/useRuleImageGeneration';
import { RuleBasedButtons } from './RuleBasedGeneratorTab/components/RuleBasedButtons';
import { RuleBasedResults } from './RuleBasedGeneratorTab/components/RuleBasedResults';
import { RulesEngineSettings } from './RuleBasedGeneratorTab/components/RulesEngineSettings';
import { OptionCatalogManager } from './RuleBasedGeneratorTab/components/OptionCatalogManager';
import { RulesManager } from './RuleBasedGeneratorTab/components/RulesManager';
import { TraceViewer } from './RuleBasedGeneratorTab/components/TraceViewer';

const LS_KEYS = {
  MAIN: 'rule-gen-main-template',
  CHAR: 'rule-gen-char-template',
  NEG:  'rule-gen-negative-template',
  CNEG: 'rule-gen-character-negative-template',
  SINGLE: 'rule-gen-single-mode', // 単体キャラ生成モード
};

export const RuleBasedGeneratorTab: React.FC = () => {
  const { state, isClient } = usePromptGeneratorState();
  const {
    register,
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

  // タブ専用テンプレート（localStorage保存）
  const [mainTemplate, setMainTemplate] = useState<string>('');
  const [charTemplate, setCharTemplate] = useState<string>('');
  const [negativeTemplate, setNegativeTemplate] = useState<string>('');
  const [characterNegativeTemplate, setCharacterNegativeTemplate] = useState<string>('');

  // 単体キャラ生成モード（localStorage保存）
  const [singleMode, setSingleMode] = useState<boolean>(false);

  // GUIパネルの開閉
  const [showOptionCatalog, setShowOptionCatalog] = useState(false);
  const [showRulesManager, setShowRulesManager] = useState(false);

  useEffect(() => {
    if (!isClient) return;
    const m = localStorage.getItem(LS_KEYS.MAIN) || 'masterpiece, best quality, [common:location]';
    const c = localStorage.getItem(LS_KEYS.CHAR) || '1girl, [group_unique:name], outfit: [group_unique:outfit], pose: [group_unique:pose]';
    const n = localStorage.getItem(LS_KEYS.NEG)  || '';
    const cn = localStorage.getItem(LS_KEYS.CNEG) || '';
    const s = localStorage.getItem(LS_KEYS.SINGLE);
    setMainTemplate(m);
    setCharTemplate(c);
    setNegativeTemplate(n);
    setCharacterNegativeTemplate(cn);
    setSingleMode(s === '1' || s === 'true');
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(LS_KEYS.MAIN, mainTemplate);
  }, [isClient, mainTemplate]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(LS_KEYS.CHAR, charTemplate);
  }, [isClient, charTemplate]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(LS_KEYS.NEG, negativeTemplate);
  }, [isClient, negativeTemplate]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(LS_KEYS.CNEG, characterNegativeTemplate);
  }, [isClient, characterNegativeTemplate]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(LS_KEYS.SINGLE, singleMode ? '1' : '0');
  }, [isClient, singleMode]);

  const {
    loading,
    generatedMain,
    generatedChars,
    ruleTrace: ruleTraceText,
    handleGenerate
  } = useRuleBasedGeneration(
    state as any,
    setValue,
    fields,
    remove,
    append,
    mainTemplate,
    charTemplate,
    negativeTemplate,
    characterNegativeTemplate,
    singleMode
  );

  const {
    isGenerating,
    isGeneratingAll,
    generatedImage,
    imageHistory,
    currentHistoryIndex,
    ruleTrace: ruleTraceImage,
    handleGenerateAndImage,
    handleImageGenerate
  } = useRuleImageGeneration(
    state as any,
    setValue,
    watch,
    fields,
    remove,
    append,
    saveParams,
    mainTemplate,
    charTemplate,
    negativeTemplate,
    characterNegativeTemplate,
    singleMode
  );

  const mergedTrace = ruleTraceImage || ruleTraceText || null;

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6 px-3 sm:px-0">
      {/* 上段: 左（結果表示）／右（テンプレ編集＋ボタン） ※モバイルで結果を先頭に */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 右カラム（PC）／先頭（モバイル）：結果表示 */}
        <div className="order-1 md:order-2">
          <RuleBasedResults
            generatedMain={generatedMain}
            generatedChars={generatedChars}
            generatedImage={generatedImage}
            imageHistory={imageHistory}
            currentHistoryIndex={currentHistoryIndex}
            onGenerateAndImage={handleGenerateAndImage}
          />
        </div>

        {/* 左カラム（PC）／2番目（モバイル）：設定＋操作 */}
        <div className="order-2 md:order-1 space-y-6">
          <h3 className="text-xl font-semibold mb-2 text-gray-100">⚙️ ルールベース生成</h3>

          {/* 単体キャラ生成トグル */}
          <div className="card">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h4 className="text-lg font-semibold text-gray-100 mb-1">単体キャラ生成モード</h4>
                <p className="text-xs text-gray-400">
                  オンの間はキャラクターカタログからランダムに1人を選び、グループ/振る舞い設定を無視して生成します。
                </p>
              </div>
              <label className="inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={singleMode}
                  onChange={(e) => setSingleMode(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-600 transition-colors relative">
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${singleMode ? 'translate-x-5' : ''}`}></span>
                </div>
              </label>
            </div>
          </div>

          {/* ルールエンジン設定（GUI） */}
          <RulesEngineSettings />

          {/* 管理GUIトグル */}
          <div className="card">
            <div className="flex flex-wrap items-center gap-2">
              <button className={`btn ${showOptionCatalog ? 'btn-primary' : ''}`} onClick={() => setShowOptionCatalog(v => !v)}>
                Option Catalog 管理 {showOptionCatalog ? '▲' : '▼'}
              </button>
              <button className={`btn ${showRulesManager ? 'btn-primary' : ''}`} onClick={() => setShowRulesManager(v => !v)}>
                Rules 管理 {showRulesManager ? '▲' : '▼'}
              </button>
            </div>
            <div className="mt-3 space-y-4">
              {showOptionCatalog && <OptionCatalogManager />}
              {showRulesManager && <RulesManager />}
            </div>
          </div>

          {/* 1) メイン（ポジティブ） */}
          <div className="card">
            <h4 className="text-lg font-semibold text-gray-100 mb-3">メインプロンプト（このタブ専用・ポジティブ）</h4>
            <textarea
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={mainTemplate}
              onChange={(e) => setMainTemplate(e.target.value)}
              placeholder="例: masterpiece, best quality, [common:location]"
            />
            <p className="text-xs text-gray-400 mt-1">
              記法: [common:], [member_common:], [group_unique:] と __wildcard__、{'{a|b|c}'} が利用できます
            </p>
          </div>

          {/* 2) メイン（ネガティブ） */}
          <div className="card">
            <h4 className="text-lg font-semibold text-gray-100 mb-3">ネガティブプロンプト（このタブ専用・メイン）</h4>
            <textarea
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={negativeTemplate}
              onChange={(e) => setNegativeTemplate(e.target.value)}
              placeholder="例: lowres, bad anatomy, blurry"
            />
            <p className="text-xs text-gray-400 mt-1">
              ここで入力した内容は、生成時にフォームの Negative Prompt（メイン）に反映されます。
            </p>
          </div>

          {/* 3) キャラクター（ポジティブ） */}
          <div className="card">
            <h4 className="text-lg font-semibold text-gray-100 mb-3">キャラクタープロンプト（このタブ専用・ポジティブ）</h4>
            <textarea
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={charTemplate}
              onChange={(e) => setCharTemplate(e.target.value)}
              placeholder="例: 1girl, [group_unique:name], outfit: [group_unique:outfit], pose: [group_unique:pose]"
            />
            <p className="text-xs text-gray-400 mt-1">
              ルールで追加したスロット（例: outfit, pose など）を [group_unique:slot] で参照します
            </p>
          </div>

          {/* 4) キャラクター（ネガティブ） */}
          <div className="card">
            <h4 className="text-lg font-semibold text-gray-100 mb-3">キャラクターネガティブプロンプト（このタブ専用）</h4>
            <textarea
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={characterNegativeTemplate}
              onChange={(e) => setCharacterNegativeTemplate(e.target.value)}
              placeholder="例: [group_unique:bad_traits] など（空でも可）"
            />
            <p className="text-xs text-gray-400 mt-1">
              各キャラクターの negativeCaption に適用されます。テンプレに [group_unique:キー] も利用できます。
            </p>
          </div>

          {/* 操作ボタン */}
          <div className="card">
            <RuleBasedButtons
              loading={loading}
              isGeneratingAll={isGeneratingAll}
              isGenerating={isGenerating}
              onGenerate={handleGenerate}
              onGenerateAndImage={handleGenerateAndImage}
            />
          </div>

          {/* トレースビュー */}
          <TraceViewer traces={mergedTrace} />
        </div>
      </div>

      {/* 下段: 画像生成フォーム（既存を再利用） */}
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
    </div>
  );
};