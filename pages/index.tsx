import React, { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import TabNavigation from '../components/TabNavigation';
import GenerationForm from '../components/GenerationForm';
import ImageGallery from '../components/ImageGallery';
import WildcardEditor from '../components/WildcardEditor';
import ImageAnalyzer from '../components/ImageAnalyzer';
import { PromptGeneratorTab } from '../components/PromptGeneratorTab';
import { TemplateEditorTab } from '../components/TemplateEditorTab';
import { GroupSettingsTab } from '../components/GroupSettingsTab';
import { RulesSettingsTab } from '../components/RulesSettingsTab';
import { RuleBasedGeneratorTab } from '../components/RuleBasedGeneratorTab';
import { GenerationParams, WildcardFile } from '../types/novelai';
import { novelAIAPI } from '../utils/novelai';
import { eagleAPI, EagleImage } from '../utils/eagle';
import { wildcardManager } from '../utils/wildcard';
import { getEagleFolderIdForModel, DEFAULT_EAGLE_FOLDER_ID } from '../utils/modelToEagleFolder';

const tabs = [
  {
    id: 'generate',
    label: '画像生成',
    icon: <span className="text-lg">🎨</span>,
  },
  {
    id: 'prompt-generator',
    label: 'ランダムプロンプト生成',
    icon: <span className="text-lg">🤖</span>,
  },
  {
    id: 'rule-generator',
    label: 'ルールベース生成',
    icon: <span className="text-lg">🧩</span>,
  },
  {
    id: 'group-settings',
    label: 'グループ/振る舞い',
    icon: <span className="text-lg">👥⚙️</span>,
  },
  {
    id: 'rules-settings',
    label: 'ルール設定',
    icon: <span className="text-lg">⚖️</span>,
  },
  {
    id: 'gallery',
    label: '画像ギャラリー',
    icon: <span className="text-lg">🖼️</span>,
  },
  {
    id: 'analyzer',
    label: '画像解析',
    icon: <span className="text-lg">📷</span>,
  },
  {
    id: 'wildcards',
    label: 'ワイルドカード',
    icon: <span className="text-lg">🎲</span>,
  },
  {
    id: 'template-editor',
    label: 'JSON編集',
    icon: <span className="text-lg">📝</span>,
  },
];

interface GenerationHistoryItem {
  id: string;
  imageUrl: string;
  timestamp: Date;
  params: GenerationParams;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('generate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generationParams, setGenerationParams] = useState<Partial<GenerationParams>>({});
  const [currentFormParams, setCurrentFormParams] = useState<Partial<GenerationParams>>({});
  const [lastError, setLastError] = useState<string | null>(null);
  const [wildcardFiles, setWildcardFiles] = useState<WildcardFile[]>([]);
  const [wildcardMap, setWildcardMap] = useState<Map<string, string[]>>(new Map());

  const [generationHistory, setGenerationHistory] = useState<GenerationHistoryItem[]>([]);

  const [expandedImageIndex, setExpandedImageIndex] = useState<number | null>(null);
  const [expandedImageSource, setExpandedImageSource] = useState<'single' | 'history' | null>(null);

  const [galleryState, setGalleryState] = useState<{
    images: EagleImage[];
    selectedImage: EagleImage | null;
    currentPage: number;
    searchFilters: any;
  }>({
    images: [],
    selectedImage: null,
    currentPage: 1,
    searchFilters: {
      searchTerm: '',
      modelFilter: '',
      dateFrom: '',
      dateTo: '',
      widthMin: '',
      widthMax: '',
      heightMin: '',
      heightMax: '',
    },
  });

  const [analyzeImageUrl, setAnalyzeImageUrl] = useState<string | null>(null);

  useEffect(() => {
    loadWildcardFiles();
  }, []);

  const loadWildcardFiles = async () => {
    try {
      const response = await fetch('/api/wildcards');
      if (response.ok) {
        const data = await response.json();
        setWildcardFiles(data.files);

        const map = new Map<string, string[]>();
        data.files.forEach((file: WildcardFile) => {
          const lines = file.content
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
          map.set(file.name, lines);
        });
        setWildcardMap(map);
      }
    } catch (error) {
      console.warn('Failed to load wildcard files:', error);
    }
  };

  const handleFormParamsChange = (params: Partial<GenerationParams>) => {
    setCurrentFormParams(params);
  };

  const addToHistory = (imageUrl: string, params: GenerationParams) => {
    const historyItem: GenerationHistoryItem = {
      id: `${Date.now()}-${Math.random()}`,
      imageUrl,
      timestamp: new Date(),
      params,
    };

    setGenerationHistory((prev) => {
      const newHistory = [historyItem, ...prev];
      return newHistory.slice(0, 100);
    });
  };

  const getCurrentImageSet = useCallback(() => {
    if (expandedImageSource === 'history') {
      return generationHistory.map((item) => item.imageUrl);
    } else if (generatedImage) {
      return [generatedImage];
    }
    return [];
  }, [generatedImage, generationHistory, expandedImageSource]);

  const handleImageExpand = useCallback((imageUrl: string, source: 'single' | 'history' = 'single') => {
    const currentImages = getCurrentImageSetForSource(source);
    const targetIndex = currentImages.indexOf(imageUrl);

    setExpandedImageIndex(targetIndex >= 0 ? targetIndex : 0);
    setExpandedImageSource(source);
  }, []);

  const getCurrentImageSetForSource = (source: 'single' | 'history') => {
    if (source === 'history') {
      return generationHistory.map((item) => item.imageUrl);
    } else if (source === 'single' && generatedImage) {
      return [generatedImage];
    }
    return [];
  };

  const navigateImage = useCallback(
    (direction: 'prev' | 'next') => {
      if (expandedImageIndex === null || !expandedImageSource) return;

      const currentImages = getCurrentImageSet();
      if (currentImages.length === 0) return;

      let newIndex = expandedImageIndex;
      if (direction === 'prev') {
        newIndex = expandedImageIndex > 0 ? expandedImageIndex - 1 : currentImages.length - 1;
      } else {
        newIndex = expandedImageIndex < currentImages.length - 1 ? expandedImageIndex + 1 : 0;
      }

      setExpandedImageIndex(newIndex);
    },
    [expandedImageIndex, expandedImageSource, getCurrentImageSet]
  );

  const closeExpandedImage = useCallback(() => {
    setExpandedImageIndex(null);
    setExpandedImageSource(null);
  }, []);

  const isImageExpanded = expandedImageIndex !== null;

  const switchToHistoryMode = () => {
    if (generationHistory.length > 0) {
      setExpandedImageIndex(0);
      setExpandedImageSource('history');
    }
  };

  const handleGeneratedImageClick = () => {
    if (generationHistory.length > 0) {
      switchToHistoryMode();
    } else if (generatedImage) {
      handleImageExpand(generatedImage, 'single');
    }
  };

  const getDisplayImage = () => {
    if (generationHistory.length > 0) {
      return generationHistory[0].imageUrl;
    }
    return generatedImage;
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (expandedImageIndex === null) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          navigateImage('prev');
          break;
        case 'ArrowRight':
          event.preventDefault();
          navigateImage('next');
          break;
        case 'Escape':
          event.preventDefault();
          closeExpandedImage();
          break;
        case 'h':
        case 'H':
          if (generationHistory.length > 0) {
            event.preventDefault();
            switchToHistoryMode();
          }
          break;
      }
    };

    if (expandedImageIndex !== null) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [expandedImageIndex, navigateImage, closeExpandedImage, generationHistory.length]);

  useEffect(() => {
    if (expandedImageIndex !== null && expandedImageSource) {
      const currentImages = getCurrentImageSet();

      if (expandedImageIndex >= currentImages.length && currentImages.length > 0) {
        setExpandedImageIndex(currentImages.length - 1);
      }

      if (currentImages.length === 0) {
        closeExpandedImage();
      }
    }
  }, [generatedImage, generationHistory, expandedImageIndex, expandedImageSource, getCurrentImageSet, closeExpandedImage]);

  useEffect(() => {
    if (isImageExpanded && expandedImageSource === 'history' && generationHistory.length > 0) {
      setExpandedImageIndex(0);
    }
  }, [generationHistory.length, isImageExpanded, expandedImageSource]);

  const handleGenerate = async (params: GenerationParams) => {
    setIsGenerating(true);
    setGeneratedImage(null);
    setLastError(null);
    setGenerationParams(params);

    let loadingToast: string | undefined;

    try {
      const eagleConnected = await eagleAPI.testConnection();
      if (!eagleConnected) {
        console.warn('Eagle API接続失敗 - 画像生成は続行しますがEagle保存はスキップされます');
      }

      if (!isImageExpanded) {
        loadingToast = toast.loading('🎲 ワイルドカードを処理中...', { duration: 0 });
      }

      const processedPrompt = await wildcardManager.processWildcards(params.prompt, wildcardMap);
      const processedNegativePrompt = await wildcardManager.processWildcards(params.negativePrompt, wildcardMap);

      const processedCharacters = await Promise.all(
        params.characters.map(async (char) => ({
          ...char,
          caption: await wildcardManager.processWildcards(char.caption, wildcardMap),
          negativeCaption: char.negativeCaption
            ? await wildcardManager.processWildcards(char.negativeCaption, wildcardMap)
            : char.negativeCaption,
        }))
      );

      const processedParams = {
        ...params,
        prompt: processedPrompt,
        negativePrompt: processedNegativePrompt,
        characters: processedCharacters,
      };

      if (!isImageExpanded && loadingToast) {
        toast.loading('🎨 画像を生成中...', { id: loadingToast });
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(processedParams),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!isImageExpanded && loadingToast) {
        toast.loading('📦 画像を展開中...', { id: loadingToast });
      }

      const zipBlob = await response.blob();
      const { imageBlob, filename } = await novelAIAPI.extractImageFromZip(zipBlob);

      const imageUrl = URL.createObjectURL(imageBlob);
      setGeneratedImage(imageUrl);

      addToHistory(imageUrl, processedParams);

      if (eagleConnected) {
        try {
          if (!isImageExpanded && loadingToast) {
            toast.loading('🦅 Eagleに保存中...', { id: loadingToast });
          }

          const metadata = {
            prompt: processedParams.prompt,
            negativePrompt: processedParams.negativePrompt,
            originalPrompt: params.prompt,
            originalNegativePrompt: params.negativePrompt,
            width: processedParams.width,
            height: processedParams.height,
            steps: processedParams.steps,
            scale: processedParams.scale,
            cfgRescale: processedParams.cfgRescale,
            seed: processedParams.seed,
            sampler: processedParams.sampler,
            model: processedParams.model === 'custom' ? processedParams.customModel : processedParams.model,
            characters: processedParams.characters,
            generatedAt: new Date().toISOString(),
            modelType: 'NovelAI',
            v4_prompt: {
              caption: {
                base_caption: processedParams.prompt,
                char_captions: processedParams.characters.map((char) => ({
                  char_caption: char.caption,
                  centers: [{ x: char.x, y: char.y }],
                })),
              },
            },
            v4_negative_prompt: {
              caption: {
                base_caption: processedParams.negativePrompt,
                char_captions: processedParams.characters.map((char) => ({
                  char_caption: char.negativeCaption || '',
                  centers: [{ x: char.x, y: char.y }],
                })),
              },
            },
          };

          const tags = ['NovelAI', processedParams.model === 'custom' ? processedParams.customModel : processedParams.model, processedParams.sampler].filter(Boolean);

          const normalizedModel = (processedParams.model === 'custom' ? processedParams.customModel : processedParams.model) || '';
          const folderId = getEagleFolderIdForModel(normalizedModel) || DEFAULT_EAGLE_FOLDER_ID;

          const settings = {
            website: 'NovelAI',
            tags: tags,
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
            if (!isImageExpanded && loadingToast) {
              toast.success('✅ 画像の生成とEagle保存が完了しました！', { id: loadingToast });
            }
          } else {
            throw new Error(eagleResult.message || 'Eagle APIからエラーが返されました');
          }
        } catch (eagleError: any) {
          console.warn('Eagle保存に失敗:', eagleError);
          if (!isImageExpanded) {
            if (loadingToast) {
              toast.success('✅ 画像生成完了！（Eagle保存は失敗）', { id: loadingToast });
            }
            toast.error(`🦅 Eagle保存エラー: ${eagleError.message}`, { duration: 8000 });
          }
        }
      } else {
        if (!isImageExpanded && loadingToast) {
          toast.success('✅ 画像生成完了！（Eagleは未接続）', { id: loadingToast });
        }
      }
    } catch (error: any) {
      console.error('Generation error:', error);

      if (loadingToast && !isImageExpanded) {
        toast.dismiss(loadingToast);
      }

      const errorMessage = error.message || '予期しないエラーが発生しました';
      setLastError(errorMessage);

      if (!isImageExpanded) {
        toast.error('❌ 生成に失敗しました', {
          duration: 6000,
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadParameters = (params: Partial<GenerationParams>) => {
    setGenerationParams(params);
    setActiveTab('generate');
    setLastError(null);
    toast.success('📥 パラメーターを読み込みました');
  };

  const handleClearError = () => {
    setLastError(null);
  };

  const handleWildcardUpdate = () => {
    loadWildcardFiles();
  };

  const handleAnalyzeImage = (imageUrl: string) => {
    setAnalyzeImageUrl(imageUrl);
    setActiveTab('analyzer');
    toast.success('画像を解析タブに送信しました');
  };

  const handleGalleryStateChange = (newState: Partial<typeof galleryState>) => {
    setGalleryState((prev) => ({ ...prev, ...newState }));
  };

  const handleGenerateFromExpanded = () => {
    if (currentFormParams.prompt) {
      handleGenerate(currentFormParams as GenerationParams);
    } else {
      toast.error('プロンプトが設定されていません');
    }
  };

  const clearHistory = () => {
    setGenerationHistory([]);
    if (expandedImageSource === 'history') {
      closeExpandedImage();
    }
    toast.success('履歴をクリアしました');
  };

  const handlePromptGenerated = (mainPrompt: string, characterPrompts: string[]) => {
    console.log('Prompt generated:', mainPrompt, characterPrompts);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'generate' && (
          <div className="flex flex-col lg:grid lg:grid-cols-3 gap-8">
            <div className="flex flex-col lg:contents">
              <div className="order-1 lg:order-none lg:col-start-3 lg:row-start-1 space-y-6">
                {lastError && (
                  <div className="card border-red-500 bg-red-900/20">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-red-400">🚨 エラー詳細</h3>
                      <button onClick={handleClearError} className="text-red-400 hover:text-red-300">
                        ✕
                      </button>
                    </div>
                    <div className="text-sm text-red-100 whitespace-pre-line max-h-64 overflow-y-auto">{lastError}</div>
                  </div>
                )}

                <div className="card">
                  <h3 className="text-lg font-semibold mb-4">生成結果</h3>
                  {getDisplayImage() ? (
                    <div className="space-y-4">
                      <img
                        src={getDisplayImage()!}
                        alt="Generated"
                        className="w-full rounded-lg border border-gray-700 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={handleGeneratedImageClick}
                      />
                      <div className="flex space-x-2">
                        <a href={getDisplayImage()!} download="generated-image.png" className="button-primary flex-1 text-center">
                          📥 ダウンロード
                        </a>
                      </div>
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

                {generationHistory.length > 0 && (
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">📚 生成履歴 ({generationHistory.length}件)</h3>
                      <div className="flex space-x-2">
                        <button onClick={switchToHistoryMode} className="button-secondary text-sm">
                          📖 履歴を表示
                        </button>
                        <button onClick={clearHistory} className="button-secondary text-sm text-red-400 hover:text-red-300">
                          🗑️ クリア
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                      {generationHistory.slice(0, 12).map((item, index) => (
                        <div key={item.id} className="relative group">
                          <div className="aspect-square overflow-hidden rounded border border-gray-700">
                            <img
                              src={item.imageUrl}
                              alt={`History ${index + 1}`}
                              className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => handleImageExpand(item.imageUrl, 'history')}
                            />
                          </div>
                          <div className="absolute top-1 left-1 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded">{index + 1}</div>
                        </div>
                      ))}
                    </div>
                    {generationHistory.length > 12 && <div className="text-center text-sm text-gray-400 mt-2">他 {generationHistory.length - 12} 件</div>}
                  </div>
                )}

                <div className="card order-last lg:order-none">
                  <h3 className="text-lg font-semibold mb-4">💡 使用方法</h3>
                  <div className="text-sm text-gray-400 space-y-2">
                    <p>1. プロンプトを入力してください（ワイルドカード使用可能）</p>
                    <p>2. 必要に応じてマルチキャラクター設定を追加してください</p>
                    <p>3. 使用したいモデルを選択してください</p>
                    <p>4. 画像サイズを設定してください</p>
                    <p>5. 生成パラメーターを調整してください</p>
                    <p>6. 「画像を生成」ボタンをクリックしてください</p>
                    <p>7. 生成された画像は自動的にEagleに保存されます（接続時）</p>
                  </div>
                </div>
              </div>

              <div className="order-2 lg:order-none lg:col-span-2 lg:row-start-1">
                <GenerationForm onGenerate={handleGenerate} isGenerating={isGenerating} initialParams={generationParams} wildcardFiles={wildcardMap} onParamsChange={handleFormParamsChange} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'prompt-generator' && <PromptGeneratorTab onPromptGenerated={handlePromptGenerated} wildcardFiles={wildcardMap} />}

        {activeTab === 'rule-generator' && <RuleBasedGeneratorTab />}

        {activeTab === 'group-settings' && <GroupSettingsTab />}

        {activeTab === 'rules-settings' && <RulesSettingsTab />}

        {activeTab === 'gallery' && (
          <ImageGallery onLoadParameters={handleLoadParameters} onAnalyzeImage={handleAnalyzeImage} galleryState={galleryState} onStateChange={handleGalleryStateChange} />
        )}

        {activeTab === 'analyzer' && (
          <ImageAnalyzer onLoadParameters={handleLoadParameters} initialImageUrl={analyzeImageUrl} onImageUrlProcessed={() => setAnalyzeImageUrl(null)} />
        )}

        {activeTab === 'wildcards' && <WildcardEditor wildcardFiles={wildcardFiles} onWildcardUpdate={handleWildcardUpdate} />}

        {activeTab === 'template-editor' && <TemplateEditorTab />}
      </div>

      {/* スマホ固定の生成ボタン */}
      {activeTab === 'generate' && (
        <div className="lg:hidden fixed bottom-6 left-4 right-4 z-40">
          <button
            onClick={() => {
              const form = document.querySelector('form');
              if (form) {
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                form.dispatchEvent(submitEvent);
              }
            }}
            disabled={isGenerating}
            className={`w-full py-3 px-4 rounded-lg text-white font-medium shadow-md transform transition-all duration-200 ${
              isGenerating ? 'bg-gray-600 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 active:scale-98 border border-gray-600'
            }`}
          >
            {isGenerating ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                生成中...
              </div>
            ) : (
              '🎨 画像を生成'
            )}
          </button>
        </div>
      )}

      {/* 拡大画像モーダル */}
      {expandedImageIndex !== null && expandedImageSource && (() => {
        const currentImages = getCurrentImageSet();
        if (currentImages.length === 0) return null;

        const currentImage = currentImages[expandedImageIndex];
        const hasMultipleImages = currentImages.length > 1;

        return (
          <div className="fixed inset-0 bg-black bg-opacity-98 flex items-center justify-center z-50" onClick={closeExpandedImage}>
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="relative" style={{ transform: 'translateY(-40px)' }}>
                <img src={currentImage} alt={`Image ${expandedImageIndex + 1}`} className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
              </div>

              {hasMultipleImages && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateImage('prev');
                  }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 flex items-center justify-center text-white opacity-50 hover:opacity-100 transition-opacity"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              {hasMultipleImages && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateImage('next');
                  }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 flex items-center justify-center text-white opacity-50 hover:opacity-100 transition-opacity"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleGenerateFromExpanded();
                }}
                disabled={isGenerating}
                className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded text-white text-sm transition-all duration-200 ${
                  isGenerating ? 'bg-gray-700 cursor-not-allowed opacity-40' : 'bg-gray-800 hover:bg-gray-700 border border-gray-600 opacity-60 hover:opacity-80'
                }`}
              >
                {isGenerating ? (
                  <div className="flex items-center">
                    <div className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full mr-2"></div>
                    生成中...
                  </div>
                ) : (
                  'Generate'
                )}
              </button>

              {expandedImageSource !== 'history' && generationHistory.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    switchToHistoryMode();
                  }}
                  className="absolute bottom-8 right-4 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded border border-gray-600 opacity-50 hover:opacity-75 transition-all"
                >
                  History
                </button>
              )}

              <button onClick={closeExpandedImage} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white opacity-50 hover:opacity-100 transition-opacity">
                ✕
              </button>

              {hasMultipleImages && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-xs opacity-40">
                  {expandedImageIndex + 1} / {currentImages.length}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: '#f9fafb',
            border: '1px solid #374151',
            maxWidth: '500px',
          },
        }}
      />
    </Layout>
  );
}