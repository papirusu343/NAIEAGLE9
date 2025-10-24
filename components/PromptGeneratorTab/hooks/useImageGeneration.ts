import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { GenerationParams, CharacterConfig } from '../../../types/novelai';
import { wildcardManager } from '../../../utils/wildcard';
import { novelAIAPI } from '../../../utils/novelai';
import { promptGenerator, GeneratedPrompt } from '../../../utils/promptGenerator';
import { TemplateData, PromptGeneratorState } from '../types';
import { getEagleFolderIdForModel, DEFAULT_EAGLE_FOLDER_ID } from '../../../utils/modelToEagleFolder';

// 画像履歴の型定義
interface ImageHistoryItem {
  id: string;
  imageUrl: string;
  generatedAt: string;
  params: GenerationParams;
  templateUsed?: string;
}

// ブラウザ履歴保存のキー
const IMAGE_HISTORY_KEY = 'prompt-generator-image-history';
const SESSION_FLAG_KEY = 'prompt-generator-session-flag';

// スマホ判定関数
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 1024;
};

// 幅・高さを 64 の倍数へ常に切り下げ
const snapDownTo64 = (v: number, min = 512, max = 2048) => {
  if (!Number.isFinite(v)) return min;
  let clamped = Math.min(max, Math.max(min, Math.floor(v)));
  clamped = Math.floor(clamped / 64) * 64;
  if (clamped < min) clamped = min;
  return clamped;
};

export const useImageGeneration = (
  templates: TemplateData[],
  state: PromptGeneratorState,
  wildcardFiles: Map<string, string[]>,
  setValue: any,
  watch: any,
  fields: any[],
  remove: any,
  append: any,
  saveParams: (params: GenerationParams) => void
) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const sessionFlag = sessionStorage.getItem(SESSION_FLAG_KEY);
        if (!sessionFlag) {
          localStorage.removeItem(IMAGE_HISTORY_KEY);
          sessionStorage.setItem(SESSION_FLAG_KEY, 'active');
          setImageHistory([]);
          setCurrentHistoryIndex(-1);
          setGeneratedImage(null);
        } else {
          const savedHistory = localStorage.getItem(IMAGE_HISTORY_KEY);
            if (savedHistory) {
              const history = JSON.parse(savedHistory);
              setImageHistory(history);
              if (history.length > 0) {
                setCurrentHistoryIndex(0);
                setGeneratedImage(history[0].imageUrl);
              }
            }
        }
      } catch (error) {
        console.warn('Failed to load image history:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleBeforeUnload = () => {
        sessionStorage.removeItem(SESSION_FLAG_KEY);
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, []);

  const saveHistoryToStorage = (history: ImageHistoryItem[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(IMAGE_HISTORY_KEY, JSON.stringify(history));
      } catch (error) {
        console.warn('Failed to save image history:', error);
      }
    }
  };

  const addToHistory = (imageUrl: string, params: GenerationParams, templateUsed?: string) => {
    const newItem: ImageHistoryItem = {
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      imageUrl,
      generatedAt: new Date().toISOString(),
      params,
      templateUsed
    };
    setImageHistory(prev => {
      const newHistory = [newItem, ...prev];
      saveHistoryToStorage(newHistory);
      return newHistory;
    });
    setCurrentHistoryIndex(0);
    setGeneratedImage(imageUrl);
  };

  const clearHistory = () => {
    setImageHistory([]);
    setCurrentHistoryIndex(-1);
    setGeneratedImage(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(IMAGE_HISTORY_KEY);
    }
  };

  const handleGenerateAndImage = useCallback(async () => {
    if (!(state as any).selectedTemplate) {
      toast.error('テンプレートを選択してください');
      return;
    }

    if (isGenerating) {
      toast.error('処理中です。しばらくお待ちください。');
      return;
    }

    setIsGeneratingAll(true);
    let loadingToast: string | undefined;

    try {
      if (!isMobile()) {
        loadingToast = toast.loading('プロンプトを生成中...', { duration: 0 });
      }

      const template = templates.find(t => t.name === (state as any).selectedTemplate);
      if (!template) {
        throw new Error('Selected template not found');
      }

      const generated = await new Promise<GeneratedPrompt>((resolve, reject) => {
        setTimeout(() => {
          try {
            const result = promptGenerator.generatePrompt(
              template.data,
              (state as any).mainPromptTemplate,
              (state as any).characterPromptTemplate
            );
            result.mainPrompt = promptGenerator.expandWildcardsUntilStable(
              result.mainPrompt,
              wildcardFiles
            );
            result.characterPrompts = result.characterPrompts.map(p =>
              promptGenerator.expandWildcardsUntilStable(p, wildcardFiles)
            );
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, 0);
      });

      setValue('prompt', generated.mainPrompt, { shouldFocus: false });

      if ((state as any).mainNegativePromptTemplate.trim()) {
        const processedNegativePrompt = promptGenerator.expandTemplateAndWildcardsUntilStable(
          (state as any).mainNegativePromptTemplate,
          generated.usedData.commonSelections,
          generated.usedData.memberCommonSelections,
          {},
          {},
          wildcardFiles
        );
        setValue('negativePrompt', processedNegativePrompt, { shouldFocus: false });
      }

      const currentLength = fields.length;
      for (let i = currentLength - 1; i >= 0; i--) {
        remove(i);
      }

      // テンプレート結果（characterPrompts.length）のみを採用してフィールド生成
      for (let i = 0; i < generated.characterPrompts.length; i++) {
        let characterNegativeCaption = '';
        if ((state as any).characterNegativePromptTemplate.trim()) {
          characterNegativeCaption = promptGenerator.expandTemplateAndWildcardsUntilStable(
            (state as any).characterNegativePromptTemplate,
            generated.usedData.commonSelections,
            generated.usedData.memberCommonSelections,
            generated.usedData.characterSelections[i] || {},
            {},
            wildcardFiles
          );
        }
        const caption = generated.characterPrompts[i] ?? '';
        append({
          caption,
          negativeCaption: characterNegativeCaption,
          x: 0.5,
          y: 0.5,
        }, { shouldFocus: false });
      }

      if (!isMobile()) {
        toast.loading('画像を生成中...', { id: loadingToast });
      }

      const data = watch();

      // === 幅・高さ補正（切り下げ） ===
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

      const processedCharacters = await Promise.all(
        data.characters.map(async (char: CharacterConfig) => ({
          ...char,
          caption: char.caption
            ? await wildcardManager.processWildcards(char.caption, wildcardFiles)
            : char.caption,
          negativeCaption: char.negativeCaption
            ? await wildcardManager.processWildcards(char.negativeCaption, wildcardFiles)
            : char.negativeCaption,
        }))
      );

      const processedParams: GenerationParams = {
        ...data,
        prompt: generated.mainPrompt,
        negativePrompt: data.negativePrompt,
        characters: processedCharacters,
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
      addToHistory(imageUrl, processedParams, (state as any).selectedTemplate);

      if (!isMobile()) {
        toast.loading('画像をEagleに保存中...', { id: loadingToast });
      }

      try {
        const metadata = {
          generatedAt: new Date().toISOString(),
          generationParams: processedParams,
          generatedFrom: 'PromptGenerator',
          templateUsed: (state as any).selectedTemplate,
          v4_prompt: {
            caption: {
              base_caption: processedParams.prompt,
              char_captions: processedParams.characters.map((c: CharacterConfig) => ({
                char_caption: c.caption,
                centers: [{ x: c.x, y: c.y }]
              }))
            }
          },
          v4_negative_prompt: {
            caption: {
              base_caption: processedParams.negativePrompt,
              char_captions: processedParams.characters.map((c: CharacterConfig) => ({
                char_caption: c.negativeCaption || '',
                centers: [{ x: c.x, y: c.y }]
              }))
            }
          }
        };

        const tags = [
          'NovelAI',
          'PromptGenerator',
          processedParams.model === 'custom' ? processedParams.customModel : processedParams.model,
          processedParams.sampler,
          (state as any).selectedTemplate
        ].filter(Boolean);

        const normalizedModel = (processedParams.model === 'custom'
          ? processedParams.customModel
          : processedParams.model) || '';
        const folderId = getEagleFolderIdForModel(normalizedModel) || DEFAULT_EAGLE_FOLDER_ID;

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
      console.error('Generation failed:', error);
      if (loadingToast) {
        toast.error(`生成に失敗しました: ${error.message}`, { id: loadingToast });
      } else {
        toast.error(`生成に失敗しました: ${error.message}`);
      }
    } finally {
      setIsGeneratingAll(false);
    }
  }, [state, templates, wildcardFiles, setValue, watch, fields.length, remove, append, isGenerating, saveParams]);

  const handleImageGenerate = async (data: GenerationParams) => {
    setIsGenerating(true);
    let loadingToast: string | undefined;

    try {
      if (!isMobile()) {
        loadingToast = toast.loading('画像を生成中...', { duration: 0 });
      }

      // === 幅・高さ補正（切り下げ）===
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

      const processedPrompt = await wildcardManager.processWildcards(data.prompt, wildcardFiles);
      const processedNegativePrompt = await wildcardManager.processWildcards(data.negativePrompt, wildcardFiles);

      const processedCharacters = await Promise.all(
        data.characters.map(async (char: CharacterConfig) => ({
          ...char,
          caption: char.caption
            ? await wildcardManager.processWildcards(char.caption, wildcardFiles)
            : char.caption,
          negativeCaption: char.negativeCaption
            ? await wildcardManager.processWildcards(char.negativeCaption, wildcardFiles)
            : char.negativeCaption,
        }))
      );

      const processedParams: GenerationParams = {
        ...data,
        prompt: processedPrompt,
        negativePrompt: processedNegativePrompt,
        characters: processedCharacters,
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
      addToHistory(imageUrl, processedParams, (state as any).selectedTemplate);

      if (!isMobile()) {
        toast.loading('画像をEagleに保存中...', { id: loadingToast });
      }

      try {
        const metadata = {
          generatedAt: new Date().toISOString(),
          generationParams: processedParams,
          generatedFrom: 'PromptGenerator',
          templateUsed: (state as any).selectedTemplate,
          v4_prompt: {
            caption: {
              base_caption: processedParams.prompt,
              char_captions: processedParams.characters.map((c: CharacterConfig) => ({
                char_caption: c.caption,
                centers: [{ x: c.x, y: c.y }]
              }))
            }
          },
          v4_negative_prompt: {
            caption: {
              base_caption: processedParams.negativePrompt,
              char_captions: processedParams.characters.map((c: CharacterConfig) => ({
                char_caption: c.negativeCaption || '',
                centers: [{ x: c.x, y: c.y }]
              }))
            }
          }
        };

        const tags = [
          'NovelAI',
          'PromptGenerator',
          processedParams.model === 'custom' ? processedParams.customModel : processedParams.model,
          processedParams.sampler,
          (state as any).selectedTemplate
        ].filter(Boolean);

        const normalizedModel = (processedParams.model === 'custom'
          ? processedParams.customModel
          : processedParams.model) || '';
        const folderId = getEagleFolderIdForModel(normalizedModel) || DEFAULT_EAGLE_FOLDER_ID;

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
      console.error('Generation failed:', error);
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
    handleGenerateAndImage,
    handleImageGenerate,
    clearHistory
  };
};