import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { GenerationParams, CharacterConfig } from '../../../types/novelai';
import { promptGenerator } from '../../../utils/promptGenerator';
import { applyRules, type RuleTrace } from '../../../utils/rulesEngine';
import { getEagleFolderIdForModel, DEFAULT_EAGLE_FOLDER_ID } from '../../../utils/modelToEagleFolder';
import { novelAIAPI } from '../../../utils/novelai';

const LS_KEYS = {
  PREFER_BOOST: 'rb-engine-preferBoost',
  DEFAULTS_TARGETS: 'rb-engine-defaultsTargets',
};

// 履歴アイテム（メモリのみ）
interface ImageHistoryItem {
  id: string;
  imageUrl: string;
  generatedAt: string;
  params: GenerationParams;
}

const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 1024;
};

const snapDownTo64 = (v: number, min = 512, max = 2048) => {
  if (!Number.isFinite(v)) return min;
  let clamped = Math.min(max, Math.max(min, Math.floor(v)));
  clamped = Math.floor(clamped / 64) * 64;
  if (clamped < min) clamped = min;
  return clamped;
};

// 重み付きランダムでグループを選ぶ（weight 省略時は 1.0）
function pickWeightedGroup(groups: { id: string; members: string[]; weight?: number }[]) {
  if (!groups?.length) return null;
  const weights = groups.map(g => (typeof g.weight === 'number' && g.weight >= 0 ? g.weight : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * (total || 1);
  for (let i = 0; i < groups.length; i++) {
    r -= weights[i];
    if (r <= 0) return groups[i];
  }
  return groups[groups.length - 1];
}

function shuffle<T>(arr: T[]) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const useRuleImageGeneration = (
  state: any,
  setValue: any,
  watch: any,
  fields: any[],
  remove: any,
  append: any,
  saveParams: (params: GenerationParams) => void,
  mainTemplate: string,
  charTemplate: string,
  negativeTemplate: string,
  characterNegativeTemplate: string,
  singleCharacterMode: boolean
) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  // 履歴はメモリのみ保持（リロードで消える）
  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [ruleTrace, setRuleTrace] = useState<RuleTrace[] | null>(null);

  const addToHistory = (imageUrl: string, params: GenerationParams) => {
    const newItem: ImageHistoryItem = {
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      imageUrl,
      generatedAt: new Date().toISOString(),
      params
    };
    setImageHistory(prev => {
      const next = [newItem, ...prev].slice(0, 50);
      return next;
    });
    setCurrentHistoryIndex(0);
    setGeneratedImage(imageUrl);
  };

  const readGuiOverrides = () => {
    let preferBoost = 2.0;
    let defaultsTargets: string[] | undefined = undefined;
    if (typeof window !== 'undefined') {
      const pb = window.localStorage.getItem(LS_KEYS.PREFER_BOOST);
      const dt = window.localStorage.getItem(LS_KEYS.DEFAULTS_TARGETS);
      if (pb) {
        const num = parseFloat(pb);
        if (!Number.isNaN(num) && num >= 1) preferBoost = num;
      }
      if (dt) {
        try {
          const arr = JSON.parse(dt);
          if (Array.isArray(arr)) defaultsTargets = arr.filter((s: any) => typeof s === 'string');
        } catch {}
      }
    }
    return { preferBoost, defaultsTargets };
  };

  const makePromptsViaRules = async () => {
    // GUI設定の読み込み
    const { preferBoost, defaultsTargets } = readGuiOverrides();

    // 1) メンバー割り当て
    let assignedMembers: string[] | null = null;

    if (singleCharacterMode) {
      const catalog = (state as any).characterCatalog?.characters ?? [];
      const ids: string[] = Array.isArray(catalog) ? catalog.map((c: any) => String(c?.id || '').trim()).filter(Boolean) : [];
      if (ids.length === 0) {
        toast.error('キャラクターカタログに有効なIDがありません。');
        throw new Error('Empty character catalog');
      }
      const idx = (Math.random() * ids.length) | 0;
      assignedMembers = [ids[idx]];
    } else {
      const groupConfig = (state as any).groupConfig as { id?: string; groups?: { id: string; members: string[]; weight?: number }[] };
      const behavior = (state as any).generationBehavior as {
        generationOrder: 'unordered' | 'sequential';
        roleAssignment: 'shuffleAll' | 'randomA_restInOrder';
        partySizeMode: 'auto' | 'fixed';
        fixedPartySize?: number;
      };

      if (groupConfig?.groups && groupConfig.groups.length > 0) {
        const chosen = pickWeightedGroup(groupConfig.groups);
        if (chosen) {
          const members = chosen.members.slice();
          let partySize = members.length;
          if (behavior?.partySizeMode === 'fixed' && typeof behavior.fixedPartySize === 'number' && behavior.fixedPartySize > 0) {
            partySize = Math.min(behavior.fixedPartySize, members.length);
          }
          if (behavior?.roleAssignment === 'shuffleAll') {
            assignedMembers = shuffle(members).slice(0, partySize);
          } else {
            const idx = members.length ? (Math.random() * members.length) | 0 : 0;
            const A = members[idx];
            const rest = members.filter((_, i) => i !== idx);
            assignedMembers = [A, ...rest].slice(0, partySize);
          }
        }
      }
    }

    // 2) selections/candidates 初期化
    const behavior = (state as any).generationBehavior as any;
    const partySize =
      singleCharacterMode
        ? 1
        : assignedMembers?.length ??
          (behavior?.partySizeMode === 'fixed' && behavior.fixedPartySize ? Math.max(1, behavior.fixedPartySize) : 2);

    const emptySelections = Array.from({ length: partySize }, () => ({} as Record<string, string>));
    const emptyCandidates = Array.from({ length: partySize }, () => ({} as Record<string, string[]>));

    // 2.x) ルール適用（GUI設定を ruleConfig にマージ）
    const baseRuleConfig = (state as any).ruleConfig || {};
    const mergedRuleConfig = {
      ...baseRuleConfig,
      engineSettings: {
        ...(baseRuleConfig.engineSettings || {}),
        preferBoost
      },
      defaults: {
        ...(baseRuleConfig.defaults || { strategy: 'random_from_all', targets: [] }),
        ...(defaultsTargets ? { targets: defaultsTargets } : {})
      }
    };

    const rulesResult = await applyRules({
      assignedMembers,
      characterCatalog: (state as any).characterCatalog,
      ruleConfig: mergedRuleConfig,
      characterSelections: emptySelections,
      characterCandidatesList: emptyCandidates
    });

    setRuleTrace(rulesResult.trace || null);

    // 3) name_prompt を name に強制
    const catalogList = (state as any).characterCatalog?.characters ?? [];
    const catalogMap: Record<string, any> = Object.fromEntries(
      Array.isArray(catalogList) ? catalogList.map((c: any) => [String(c?.id || '').trim(), c]) : []
    );

    const enhancedSelections = rulesResult.characterSelections.map((sel: Record<string, string>, i: number) => {
      const memberId = assignedMembers?.[i];
      const entry = memberId ? catalogMap[memberId] : undefined;
      const display = typeof entry?.name_prompt === 'string' ? entry.name_prompt.trim() : '';
      return { ...sel, name: display };
    });

    // 3.1) [series] 集約
    const seriesUnique = Array.from(
      new Set(
        (assignedMembers ?? [])
          .map(id => {
            const entry = catalogMap[id];
            return typeof entry?.series === 'string' ? entry.series.trim() : '';
          })
          .filter(Boolean)
      )
    );
    const seriesValue = seriesUnique.length === 0 ? '' : seriesUnique.length === 1 ? seriesUnique[0] : seriesUnique.join(', ');

    // 3.2) テンプレの [series] 事前置換
    const processedMainTemplate = (mainTemplate || '').split('[series]').join(seriesValue);
    const processedCharTemplate = (charTemplate || '').split('[series]').join(seriesValue);

    // 3.3) 展開
    const wildcardFiles = new Map<string, string[]>();
    const out = promptGenerator.generatePromptFromSelections(
      processedMainTemplate,
      processedCharTemplate,
      {},
      {},
      enhancedSelections,
      rulesResult.characterCandidatesList,
      wildcardFiles
    );

    // 4) フォーム反映
    setValue('prompt', out.mainPrompt, { shouldFocus: false });
    setValue('negativePrompt', negativeTemplate || '', { shouldFocus: false });

    const currentLength = fields.length;
    for (let i = currentLength - 1; i >= 0; i--) {
      remove(i);
    }
    for (let i = 0; i < out.characterPrompts.length; i++) {
      const processedCharacterNegativeTemplate = (characterNegativeTemplate || '').split('[series]').join(seriesValue);

      let characterNegativeCaption = '';
      if (processedCharacterNegativeTemplate && processedCharacterNegativeTemplate.trim()) {
        characterNegativeCaption = promptGenerator.expandTemplateAndWildcardsUntilStable(
          processedCharacterNegativeTemplate,
          {},
          {},
          enhancedSelections[i] || {},
          rulesResult.characterCandidatesList[i] || {},
          wildcardFiles
        );
      }

      append(
        {
          caption: out.characterPrompts[i],
          negativeCaption: characterNegativeCaption,
          x: 0.5,
          y: 0.5
        },
        { shouldFocus: false }
      );
    }

    return out;
  };

  const handleGenerateAndImage = useCallback(async () => {
    if (isGenerating) {
      toast.error('処理中です。しばらくお待ちください。');
      return;
    }
    setIsGeneratingAll(true);
    let loadingToast: string | undefined;

    try {
      if (!isMobile()) {
        loadingToast = toast.loading('ルール適用中...', { duration: 0 });
      }

      const out = await makePromptsViaRules();

      if (!isMobile()) {
        toast.loading('画像を生成中...', { id: loadingToast });
      }

      const data = watch();

      // 幅・高さ補正
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

      const processedParams: GenerationParams = {
        ...data,
        prompt: out.mainPrompt,
        negativePrompt: data.negativePrompt,
        characters: data.characters as CharacterConfig[],
      };

      saveParams(processedParams);

      if (!isMobile()) {
        toast.loading('画像を生成中...', { id: loadingToast });
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processedParams),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!isMobile()) {
        toast.loading('画像を展開中...', { id: loadingToast });
      }

      const zipBlob = await response.blob();
      const { imageBlob, filename } = await novelAIAPI.extractImageFromZip(zipBlob);
      const imageUrl = URL.createObjectURL(imageBlob);
      addToHistory(imageUrl, processedParams);

      if (!isMobile()) {
        toast.loading('画像をEagleに保存中...', { id: loadingToast });
      }

      try {
        const tags = [
          'NovelAI',
          'RuleBased',
          processedParams.model === 'custom' ? processedParams.customModel : processedParams.model,
          processedParams.sampler
        ].filter(Boolean);

        const normalizedModel = (processedParams.model === 'custom'
          ? processedParams.customModel
          : processedParams.model) || '';
        const folderId = getEagleFolderIdForModel(normalizedModel) || DEFAULT_EAGLE_FOLDER_ID;

        const metadata = {
          generatedAt: new Date().toISOString(),
          generationParams: processedParams,
          generatedFrom: 'RuleBasedGenerator',
        };

        const settings = {
          website: 'NovelAI',
          tags,
          annotation: JSON.stringify(metadata, null, 2),
          folderId,
        };

        const formData = new FormData();
        formData.append('image', imageBlob, filename);
        formData.append('settings', JSON.stringify(settings));

        const eagleResponse = await fetch('/api/save-to-eagle', {
          method: 'POST',
          body: formData,
        });

        const eagleResult = await eagleResponse.json();

        if (eagleResponse.ok && eagleResult.success) {
          if (!isMobile()) {
            toast.success('画像の生成とEagle保存が完了しました！', { id: loadingToast });
          }
        } else {
          throw new Error(eagleResult.message || 'Eagle APIからエラーが返されました');
        }
      } catch (eagleError: any) {
        console.warn('Eagle保存に失敗:', eagleError);
        toast.success('画像生成完了！（Eagle保存は失敗）', { id: loadingToast });
        toast.error(`Eagle保存エラー: ${eagleError.message}`, { duration: 8000 });
      }
    } catch (error: any) {
      console.error(error);
      if (loadingToast) {
        toast.error(`生成に失敗しました: ${error.message}`, { id: loadingToast });
      } else {
        toast.error(`生成に失敗しました: ${error.message}`);
      }
    } finally {
      setIsGeneratingAll(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating, watch, setValue, saveParams, mainTemplate, charTemplate, negativeTemplate, characterNegativeTemplate, singleCharacterMode]);

  const handleImageGenerate = async (data: GenerationParams) => {
    setIsGenerating(true);
    let loadingToast: string | undefined;
    try {
      if (!isMobile()) {
        loadingToast = toast.loading('ルール適用中...', { duration: 0 });
      }

      // まずルールでプロンプトをフォームに反映
      const out = await makePromptsViaRules();

      // サイズ補正
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

      const processedParams: GenerationParams = {
        ...data,
        prompt: out.mainPrompt,
        characters: data.characters as CharacterConfig[],
      };

      saveParams(processedParams);

      if (!isMobile()) {
        toast.loading('画像を生成中...', { id: loadingToast });
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processedParams),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!isMobile()) {
        toast.loading('画像を展開中...', { id: loadingToast });
      }

      const zipBlob = await response.blob();
      const { imageBlob, filename } = await novelAIAPI.extractImageFromZip(zipBlob);
      const imageUrl = URL.createObjectURL(imageBlob);
      addToHistory(imageUrl, processedParams);

      if (!isMobile()) {
        toast.loading('画像をEagleに保存中...', { id: loadingToast });
      }

      try {
        const tags = [
          'NovelAI',
          'RuleBased',
          processedParams.model === 'custom' ? processedParams.customModel : processedParams.model,
          processedParams.sampler
        ].filter(Boolean);

        const normalizedModel = (processedParams.model === 'custom'
          ? processedParams.customModel
          : processedParams.model) || '';
        const folderId = getEagleFolderIdForModel(normalizedModel) || DEFAULT_EAGLE_FOLDER_ID;

        const metadata = {
          generatedAt: new Date().toISOString(),
          generationParams: processedParams,
          generatedFrom: 'RuleBasedGenerator',
        };

        const settings = {
          website: 'NovelAI',
          tags,
          annotation: JSON.stringify(metadata, null, 2),
          folderId,
        };

        const formData = new FormData();
        formData.append('image', imageBlob, filename);
        formData.append('settings', JSON.stringify(settings));

        const eagleResponse = await fetch('/api/save-to-eagle', {
          method: 'POST',
          body: formData,
        });

        const eagleResult = await eagleResponse.json();

        if (eagleResponse.ok && eagleResult.success) {
          if (!isMobile()) {
            toast.success('画像の生成とEagle保存が完了しました！', { id: loadingToast });
          }
        } else {
          throw new Error(eagleResponse.message || 'Eagle APIからエラーが返されました');
        }
      } catch (eagleError: any) {
        console.warn('Eagle保存に失敗:', eagleError);
        toast.success('画像生成完了！（Eagle保存は失敗）', { id: loadingToast });
        toast.error(`Eagle保存エラー: ${eagleError.message}`, { duration: 8000 });
      }
    } catch (error: any) {
      console.error(error);
      if (loadingToast) {
        toast.error(`画像生成に失敗しました: ${error.message}`, { id: loadingToast });
      } else {
        toast.error(`画像生成に失敗しました: ${error.message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    isGeneratingAll,
    generatedImage,
    imageHistory,
    currentHistoryIndex,
    ruleTrace,
    handleGenerateAndImage,
    handleImageGenerate
  };
};