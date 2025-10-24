import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { eagleAPI, EagleImage } from '../utils/eagle';
import { GenerationParams } from '../types/novelai';

interface GalleryState {
  images: EagleImage[];
  selectedImage: EagleImage | null;
  currentPage: number;
  searchFilters: {
    searchTerm: string;
    modelFilter: string;
    dateFrom: string;
    dateTo: string;
    widthMin: string;
    widthMax: string;
    heightMin: string;
    heightMax: string;
    showFavoritesOnly: boolean; // 🔥 お気に入りフィルタを追加
    folderId?: string; // 🔥 Eagleフォルダフィルタを追加（オプショナルで後方互換）
  };
}

interface ImageGalleryProps {
  onLoadParameters: (params: Partial<GenerationParams>) => void;
  onAnalyzeImage?: (imageUrl: string) => void;
  galleryState: GalleryState;
  onStateChange: (newState: Partial<GalleryState>) => void;
}

const IMAGES_PER_PAGE = 24;

export default function ImageGallery({ onLoadParameters, onAnalyzeImage, galleryState, onStateChange }: ImageGalleryProps) {
  const [loading, setLoading] = useState(false);
  const [loadingParams, setLoadingParams] = useState(false);
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [isExpandedImageInfoCollapsed, setIsExpandedImageInfoCollapsed] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);
  
  // 🔥 検索用のローカル状態（リアルタイム検索を避けるため）
  const [searchInput, setSearchInput] = useState('');
  // 🔥 実際に適用される検索キーワード
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  // 🔥 お気に入り状態を管理するローカルstate
  const [favoritingImages, setFavoritingImages] = useState<Set<string>>(new Set());
  // 🔥 Eagleフォルダ一覧
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);

  // 🔥 初期化時のみデータロードを行う
  useEffect(() => {
    setIsClient(true);
    
    // 検索入力欄を現在の検索キーワードで初期化
    setSearchInput(galleryState.searchFilters.searchTerm);
    setAppliedSearchTerm(galleryState.searchFilters.searchTerm);
    
    // 🔥 初回のみバックグラウンドでデータロード
    if (!isInitialLoaded) {
      loadImagesInitial();
      loadFoldersInitial();
    }
  }, []);

  // 🔥 galleryState.searchFilters.searchTermが変更された時のみappliedSearchTermを更新
  useEffect(() => {
    if (galleryState.searchFilters.searchTerm !== appliedSearchTerm) {
      setAppliedSearchTerm(galleryState.searchFilters.searchTerm);
      setSearchInput(galleryState.searchFilters.searchTerm);
    }
  }, [galleryState.searchFilters.searchTerm]);

  // 🔥 Eagleフォルダ一覧の初期ロード
  const loadFoldersInitial = async () => {
    try {
      setFoldersLoading(true);
      const list = await eagleAPI.getFolders();
      // 重複排除してソート（名前順）
      const unique = Array.from(new Map(list.map(f => [f.id, f])).values()).sort((a, b) =>
        a.name.localeCompare(b.name, 'ja')
      );
      setFolders(unique);
    } catch (error: any) {
      console.warn('フォルダ一覧の取得に失敗しました:', error?.message || error);
    } finally {
      setFoldersLoading(false);
    }
  };

  // 🔥 お気に入り切り替え機能
  const handleToggleFavorite = async (imageId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (favoritingImages.has(imageId)) {
      return; // 既に処理中の場合は何もしない
    }

    try {
      setFavoritingImages(prev => new Set(prev).add(imageId));
      
      const newFavoriteStatus = await eagleAPI.toggleFavorite(imageId);
      
      // ローカルの画像データを更新
      const updatedImages = galleryState.images.map(img => 
        img.id === imageId ? { ...img, isFavorite: newFavoriteStatus } : img
      );
      
      onStateChange({ images: updatedImages });
      
      // 選択中の画像も更新
      if (galleryState.selectedImage?.id === imageId) {
        onStateChange({ 
          selectedImage: { ...galleryState.selectedImage, isFavorite: newFavoriteStatus }
        });
      }
      
      toast.success(newFavoriteStatus ? 'お気に入りに追加しました' : 'お気に入りから削除しました');
    } catch (error: any) {
      console.error('お気に入り切り替えエラー:', error);
      toast.error(`お気に入り切り替えに失敗しました: ${error.message}`);
    } finally {
      setFavoritingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(imageId);
        return newSet;
      });
    }
  };

  // 🔥 お気に入りフィルタ切り替え機能
  const handleToggleFavoriteFilter = () => {
    onStateChange({
      searchFilters: {
        ...galleryState.searchFilters,
        showFavoritesOnly: !galleryState.searchFilters.showFavoritesOnly
      },
      currentPage: 1
    });
  };

  // 🔥 Eagleフォルダフィルタ変更
  const handleFolderFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const folderId = e.target.value || undefined;
    onStateChange({
      searchFilters: {
        ...galleryState.searchFilters,
        folderId
      },
      currentPage: 1
    });
  };

  // 🔥 検索クエリを解析してAND/NOT検索に対応
  const parseSearchQuery = (query: string) => {
    if (!query.trim()) return { andTerms: [], notTerms: [] };
    
    const andTerms: string[] = [];
    const notTerms: string[] = [];
    
    // スペースで分割して各項目を処理
    const parts = query.trim().split(/\s+/);
    
    for (const part of parts) {
      if (part.startsWith('-') && part.length > 1) {
        // NOT検索（-で始まる）
        notTerms.push(part.substring(1).toLowerCase());
      } else if (part.length > 0) {
        // AND検索（通常の項目）
        andTerms.push(part.toLowerCase());
      }
    }
    
    return { andTerms, notTerms };
  };

  // 🔥 useMemoを使用してfilteredImagesの再計算を最適化（AND/NOT検索とお気に入り・フォルダフィルタ対応）
  const filteredImages = useMemo(() => {
    let filtered = galleryState.images;

    // 🔥 フォルダフィルタを適用（指定時）
    const folderId = galleryState.searchFilters.folderId;
    if (folderId) {
      filtered = filtered.filter(image => Array.isArray(image.folders) && image.folders.includes(folderId));
    }

    // 🔥 お気に入りフィルタを適用
    if (galleryState.searchFilters.showFavoritesOnly) {
      filtered = filtered.filter(image => image.isFavorite);
    }

    // 🔥 検索フィルタを適用
    if (appliedSearchTerm) {
      const { andTerms, notTerms } = parseSearchQuery(appliedSearchTerm);
      
      filtered = filtered.filter(image => {
        try {
          const metadata = image.annotation ? JSON.parse(image.annotation) : {};
          
          // 🔥 マルチキャラクタープロンプトも検索対象に含める
          const characterCaptions = [];
          const characterNegativeCaptions = [];
          
          // v4_prompt形式のマルチキャラクター
          if (metadata.v4_prompt?.caption?.char_captions) {
            characterCaptions.push(...metadata.v4_prompt.caption.char_captions.map((char: any) => char.char_caption || ''));
          }
          if (metadata.v4_negative_prompt?.caption?.char_captions) {
            characterNegativeCaptions.push(...metadata.v4_negative_prompt.caption.char_captions.map((char: any) => char.char_caption || ''));
          }
          
          // characters形式のマルチキャラクター
          if (metadata.characters && Array.isArray(metadata.characters)) {
            characterCaptions.push(...metadata.characters.map((char: any) => char.caption || ''));
            characterNegativeCaptions.push(...metadata.characters.map((char: any) => char.negativeCaption || ''));
          }
          
          const searchText = [
            image.name,
            metadata.prompt || '',
            metadata.negativePrompt || '',
            metadata.model || '',
            ...characterCaptions,
            ...characterNegativeCaptions,
            JSON.stringify(metadata)
          ].join(' ').toLowerCase();
          
          // 🔥 AND検索：すべての項目が含まれている必要がある
          const andMatch = andTerms.length === 0 || andTerms.every(term => searchText.includes(term));
          
          // 🔥 NOT検索：除外項目が含まれていない必要がある
          const notMatch = notTerms.length === 0 || !notTerms.some(term => searchText.includes(term));
          
          return andMatch && notMatch;
        } catch {
          // JSON解析エラーの場合はファイル名のみで検索
          const searchText = image.name.toLowerCase();
          const andMatch = andTerms.length === 0 || andTerms.every(term => searchText.includes(term));
          const notMatch = notTerms.length === 0 || !notTerms.some(term => searchText.includes(term));
          return andMatch && notMatch;
        }
      });
    }

    return filtered;
  }, [galleryState.images, appliedSearchTerm, galleryState.searchFilters.showFavoritesOnly, galleryState.searchFilters.folderId]);

  // ページネーション計算
  const totalPages = Math.ceil(filteredImages.length / IMAGES_PER_PAGE);
  const startIndex = (galleryState.currentPage - 1) * IMAGES_PER_PAGE;
  const paginatedImages = filteredImages.slice(startIndex, startIndex + IMAGES_PER_PAGE);

  // 🔥 検索実行関数
  const executeSearch = () => {
    setAppliedSearchTerm(searchInput);
    onStateChange({ 
      searchFilters: { ...galleryState.searchFilters, searchTerm: searchInput },
      currentPage: 1 
    });
  };

  // 🔥 検索クリア関数
  const clearSearch = () => {
    setSearchInput('');
    setAppliedSearchTerm('');
    onStateChange({
      searchFilters: {
        ...galleryState.searchFilters,
        searchTerm: ''
      },
      currentPage: 1
    });
  };

  // 🔥 Enterキーで検索実行
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeSearch();
    }
  };

  // 🔥 検索入力ハンドラー（最適化）
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 🔥 単純にstateを更新するだけ（フィルタリングはしない）
    setSearchInput(e.target.value);
  };

  // 🔥 ページネーションコンポーネント（スマホでさらに小さく）
  const PaginationControls = () => (
    totalPages > 1 ? (
      <div className="flex justify-center items-center space-x-3 md:space-x-4">
        <button
          onClick={() => onStateChange({ currentPage: Math.max(1, galleryState.currentPage - 1) })}
          disabled={galleryState.currentPage === 1}
          className="button-secondary disabled:opacity-50 disabled:cursor-not-allowed text-[11px] md:text-sm px-2 py-1"
        >
          ← 前
        </button>
        <span className="text-[11px] md:text-sm text-gray-400">
          {galleryState.currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onStateChange({ currentPage: Math.min(totalPages, galleryState.currentPage + 1) })}
          disabled={galleryState.currentPage === totalPages}
          className="button-secondary disabled:opacity-50 disabled:cursor-not-allowed text-[11px] md:text-sm px-2 py-1"
        >
          次 →
        </button>
      </div>
    ) : null
  );

  const handleImageClick = (image: EagleImage) => {
    onStateChange({ selectedImage: image });
  };

  const handleImageExpand = (imageUrl: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedImage(imageUrl);
  };

  // 拡大画像での前後ナビゲーション関数を追加
  const navigateExpandedImage = (direction: 'prev' | 'next') => {
    if (!expandedImage) return;
    
    const currentIndex = filteredImages.findIndex(img => img.url === expandedImage);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : filteredImages.length - 1;
    } else {
      newIndex = currentIndex < filteredImages.length - 1 ? currentIndex + 1 : 0;
    }
    
    setExpandedImage(filteredImages[newIndex].url);
  };

  // 拡大画像から対応するEagleImageオブジェクトを取得
  const getExpandedImageData = (): EagleImage | null => {
    if (!expandedImage) return null;
    return filteredImages.find(img => img.url === expandedImage) || null;
  };

  const handleLoadParametersFromExpanded = async (image: EagleImage) => {
    try {
      setLoadingParams(true);
      console.log(`[${new Date().toISOString()}] パラメーター読み込み開始 - Image: ${image.name}`);
      
      if (image.annotation) {
        try {
          const metadata = JSON.parse(image.annotation);
          if (metadata.prompt || metadata.v4_prompt) {
            const params: Partial<GenerationParams> = {
              prompt: metadata.v4_prompt?.caption?.base_caption || metadata.prompt || '',
              negativePrompt: metadata.v4_negative_prompt?.caption?.base_caption || metadata.uc || metadata.negativePrompt || '',
              width: metadata.width || 832,
              height: metadata.height || 1216,
              steps: metadata.steps || 28,
              scale: metadata.scale || 5,
              cfgRescale: metadata.cfgRescale || metadata.cfg_rescale || 0,
              seed: metadata.seed,
              sampler: metadata.sampler || 'k_euler_ancestral',
              model: metadata.model || 'nai-diffusion-4-5-full',
              characters: metadata.v4_prompt?.caption?.char_captions?.map((char: any, index: number) => ({
                caption: char.char_caption,
                negativeCaption: metadata.v4_negative_prompt?.caption?.char_captions?.find((nc: any, idx: number) => 
                  idx === index
                )?.char_caption || '',
                x: char.centers[0]?.x || 0.5,
                y: char.centers[0]?.y || 0.5,
              })) || metadata.characters || [],
            };
            
            onLoadParameters(params);
            toast.success('パラメーターを読み込みました');
            setExpandedImage(null);
            console.log(`[${new Date().toISOString()}] パラメーター読み込み成功`);
            return;
          }
        } catch (parseError) {
          console.warn(`[${new Date().toISOString()}] Failed to parse annotation:`, parseError);
        }
      }

      toast.error('この画像からパラメーターを読み込めませんでした');
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Failed to load parameters:`, error);
      toast.error(`パラメーターの読み込みに失敗しました: ${error.message}`);
    } finally {
      setLoadingParams(false);
    }
  };

  const handleSendToAnalyzerFromExpanded = (image: EagleImage) => {
    if (onAnalyzeImage) {
      onAnalyzeImage(image.url);
      setExpandedImage(null);
    }
  };

  const handleLoadParameters = async (image: EagleImage) => {
    try {
      setLoadingParams(true);
      console.log(`[${new Date().toISOString()}] パラメーター読み込み開始 - Image: ${image.name}`);
      
      if (image.annotation) {
        try {
          const metadata = JSON.parse(image.annotation);
          if (metadata.prompt || metadata.v4_prompt) {
            const params: Partial<GenerationParams> = {
              prompt: metadata.v4_prompt?.caption?.base_caption || metadata.prompt || '',
              negativePrompt: metadata.v4_negative_prompt?.caption?.base_caption || metadata.uc || metadata.negativePrompt || '',
              width: metadata.width || 832,
              height: metadata.height || 1216,
              steps: metadata.steps || 28,
              scale: metadata.scale || 5,
              cfgRescale: metadata.cfgRescale || metadata.cfg_rescale || 0,
              seed: metadata.seed,
              sampler: metadata.sampler || 'k_euler_ancestral',
              model: metadata.model || 'nai-diffusion-4-5-full',
              characters: metadata.v4_prompt?.caption?.char_captions?.map((char: any, index: number) => ({
                caption: char.char_caption,
                negativeCaption: metadata.v4_negative_prompt?.caption?.char_captions?.find((nc: any, idx: number) => 
                  idx === index
                )?.char_caption || '',
                x: char.centers[0]?.x || 0.5,
                y: char.centers[0]?.y || 0.5,
              })) || metadata.characters || [],
            };
            
            onLoadParameters(params);
            toast.success('パラメーターを読み込みました');
            onStateChange({ selectedImage: null });
            console.log(`[${new Date().toISOString()}] パラメーター読み込み成功`);
            return;
          }
        } catch (parseError) {
          console.warn(`[${new Date().toISOString()}] Failed to parse annotation:`, parseError);
        }
      }

      toast.error('この画像からパラメーターを読み込めませんでした');
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Failed to load parameters:`, error);
      toast.error(`パラメーターの読み込みに失敗しました: ${error.message}`);
    } finally {
      setLoadingParams(false);
    }
  };

  const handleSendToAnalyzer = (image: EagleImage) => {
    if (onAnalyzeImage) {
      onAnalyzeImage(image.url);
      onStateChange({ selectedImage: null });
    }
  };

  // キーボードナビゲーション
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!expandedImage) return;
      
      if (e.key === 'ArrowLeft') {
        navigateExpandedImage('prev');
      } else if (e.key === 'ArrowRight') {
        navigateExpandedImage('next');
      } else if (e.key === 'Escape') {
        setExpandedImage(null);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [expandedImage, filteredImages]);

  // 🔥 初期データロード（バックグラウンド実行）
  const loadImagesInitial = async () => {
    try {
      console.log(`[${new Date().toISOString()}] 初期画像読み込み開始（バックグラウンド）`);
      
      const allImages = await eagleAPI.getAllImages();
      
      onStateChange({ images: allImages || [] });
      setIsInitialLoaded(true);
      console.log(`[${new Date().toISOString()}] 初期画像読み込み完了: ${allImages?.length || 0}枚`);
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] 初期画像読み込み失敗:`, error);
      // 初期ロード失敗時はトーストを表示しない（バックグラウンド処理のため）
      setIsInitialLoaded(true); // エラーでも初期化完了とする
    }
  };

  // 🔥 手動更新ボタン用のデータロード
  const loadImages = async () => {
    try {
      setLoading(true);
      console.log(`[${new Date().toISOString()}] 手動画像読み込み開始`);
      
      const allImages = await eagleAPI.getAllImages();
      
      onStateChange({ images: allImages || [] });
      console.log(`[${new Date().toISOString()}] 手動画像読み込み完了: ${allImages?.length || 0}枚`);
      toast.success(`画像を更新しました (${allImages?.length || 0}枚)`);
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] 手動画像読み込み失敗:`, error);
      toast.error(`画像の読み込みに失敗しました: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isClient) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="animate-pulse">
          <div className="h-5 md:h-6 bg-gray-700 rounded w-1/3 md:w-1/4 mb-3 md:mb-4"></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 🔥 初期ロード中でも表示（データがない場合のみローディング表示）
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 md:py-12">
        <div className="animate-spin w-7 h-7 md:w-8 md:h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-300 text-sm md:text-base">画像を読み込み中...</span>
      </div>
    );
  }

  // 🔥 お気に入りカウントを計算
  const favoriteCount = galleryState.images.filter(img => img.isFavorite).length;

  // 🔥 選択中フォルダ名を取得
  const selectedFolderName = folders.find(f => f.id === galleryState.searchFilters.folderId)?.name;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm md:text-xl font-semibold">
          画像ギャラリー ({filteredImages.length} / {galleryState.images.length} 枚)
          {favoriteCount > 0 && (
            <span className="text-xs md:text-sm text-yellow-400 ml-2">
              ⭐ {favoriteCount}
            </span>
          )}
          {!isInitialLoaded && (
            <span className="text-xs md:text-sm text-gray-400 ml-2">読み込み中...</span>
          )}
        </h2>
        <button
          onClick={loadImages}
          className="button-secondary text-xs md:text-sm px-3 py-1"
          disabled={loading}
        >
          🔄 更新
        </button>
      </div>

      {/* 🔥 コンパクトな検索フォーム（上下の余白も縮小） */}
      <div className="card py-2 px-3 md:py-3 md:px-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm md:text-base font-semibold">🔍 検索</h3>
          <button
            onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
            className="text-gray-400 hover:text-gray-100 transition-colors text-xs md:text-sm px-1 py-0.5"
            title={isFilterCollapsed ? '検索を展開' : '検索を折りたたむ'}
          >
            {isFilterCollapsed ? '▼' : '▲'}
          </button>
        </div>
        
        {!isFilterCollapsed && (
          <div className="space-y-2">
            <div className="flex flex-col md:flex-row md:items-end md:space-x-2 space-y-2 md:space-y-0">
              <div className="flex-1">
                <label className="block text-[11px] md:text-sm font-medium mb-1">検索キーワード</label>
                <input
                  type="text"
                  value={searchInput}
                  onChange={handleSearchInputChange}
                  onKeyDown={handleSearchKeyDown}
                  className="input w-full px-2 py-1 md:px-3 md:py-1.5 text-[11px] md:text-sm"
                  placeholder="プロンプト、キャラクター、モデル名、ファイル名..."
                />
              </div>
              {/* 🔥 Eagleフォルダフィルタ（コンパクト） */}
              <div className="w-full md:w-56">
                <label className="block text-[11px] md:text-sm font-medium mb-1">Eagleフォルダ</label>
                <select
                  value={galleryState.searchFilters.folderId || ''}
                  onChange={handleFolderFilterChange}
                  className="input w-full px-2 py-1 md:px-3 md:py-1.5 text-[11px] md:text-sm"
                  disabled={foldersLoading}
                >
                  <option value="">{foldersLoading ? '読み込み中...' : 'すべてのフォルダ'}</option>
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end space-x-1.5">
                <button
                  onClick={executeSearch}
                  className="button-primary px-3 py-1 text-[11px] md:text-sm"
                >
                  🔍 検索
                </button>
                <button
                  onClick={clearSearch}
                  className="button-secondary px-3 py-1 text-[11px] md:text-sm"
                >
                  🗑️ クリア
                </button>
              </div>
            </div>
            
            {/* 🔥 お気に入りフィルタボタン（コンパクト） */}
            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={handleToggleFavoriteFilter}
                className={`px-3 py-1 rounded-md font目中 text-[11px] md:text-sm transition-colors ${
                  galleryState.searchFilters.showFavoritesOnly
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                {galleryState.searchFilters.showFavoritesOnly ? '⭐ お気に入りのみ表示中' : '⭐ お気に入りのみ表示'}
              </button>
              {selectedFolderName && (
                <span className="text-[11px] text-gray-400">
                  フォルダ: <span className="text-blue-400">{selectedFolderName}</span>
                </span>
              )}
            </div>
            
            <div className="text-[11px] md:text-sm text-gray-400">
              {filteredImages.length} / {galleryState.images.length} 枚表示中
              {appliedSearchTerm && (
                <span className="ml-2 text-blue-400">
                  検索: "{appliedSearchTerm}"
                </span>
              )}
              {galleryState.searchFilters.showFavoritesOnly && (
                <span className="ml-2 text-yellow-400">
                  (お気に入りのみ)
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🔥 上部のページネーション（コンパクト） */}
      <PaginationControls />

      {/* 画像グリッド */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
        {paginatedImages.map((image) => {
          // グリッド表示では縮小画像（サムネイル）を使用し、他は原寸のまま
          const thumbSrc = image.thumbUrl || eagleAPI.getImageThumbnail(image.id, 360);
          return (
            <div 
              key={image.url} 
              className="relative aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
              onClick={() => handleImageClick(image)}
            >
              <img
                src={thumbSrc}
                alt={image.name}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                onDoubleClick={(e) => handleImageExpand(image.url, e)}
              />
              
              {/* 🔥 お気に入りボタンを追加 */}
              <button
                onClick={(e) => handleToggleFavorite(image.id, e)}
                disabled={favoritingImages.has(image.id)}
                className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all ${
                  image.isFavorite
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                    : 'bg-black bg-opacity-50 hover:bg-opacity-75 text-gray-300 hover:text-yellow-400'
                } ${favoritingImages.has(image.id) ? 'opacity-50 cursor-wait' : ''}`}
                title={image.isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}
              >
                {favoritingImages.has(image.id) ? '⏳' : image.isFavorite ? '⭐' : '☆'}
              </button>
              
              <div className="absolute bottom-2 left-2 right-2 text-[11px] md:text-xs text白 bg-black bg-opacity-75 rounded px-2 py-1 truncate">
                {image.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* 🔥 下部のページネーション（コンパクト） */}
      <PaginationControls />

      {/* 画像詳細モーダル */}
      {galleryState.selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-3 md:p-4">
          <div className="bg-gray-800 rounded-lg max-w-6xl max-h-[90vh] overflow-auto w-full">
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <h3 className="text-base md:text-lg font-semibold">{galleryState.selectedImage.name}</h3>
                  {/* 🔥 詳細モーダルにもお気に入りボタンを追加 */}
                  <button
                    onClick={(e) => handleToggleFavorite(galleryState.selectedImage!.id, e)}
                    disabled={favoritingImages.has(galleryState.selectedImage.id)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all ${
                      galleryState.selectedImage.isFavorite
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text黄色-400'
                    } ${favoritingImages.has(galleryState.selectedImage.id) ? 'opacity-50 cursor-wait' : ''}`}
                    title={galleryState.selectedImage.isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}
                  >
                    {favoritingImages.has(galleryState.selectedImage.id) ? '⏳' : galleryState.selectedImage.isFavorite ? '⭐' : '☆'}
                  </button>
                </div>
                <button
                  onClick={() => onStateChange({ selectedImage: null })}
                  className="text-gray-400 hover:text-gray-100 text-lg md:text-xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <img
                    src={galleryState.selectedImage.url}
                    alt={galleryState.selectedImage.name}
                    className="w-full rounded-lg cursor-pointer"
                    onClick={(e) => handleImageExpand(galleryState.selectedImage!.url, e)}
                  />
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2 text-sm md:text-base">画像情報</h4>
                    <div className="text-xs md:text-sm text-gray-400 space-y-1">
                      <p>サイズ: {galleryState.selectedImage.width || '不明'} × {galleryState.selectedImage.height || '不明'}</p>
                      <p>ファイルサイズ: {galleryState.selectedImage.size ? (galleryState.selectedImage.size / 1024 / 1024).toFixed(2) + ' MB' : '不明'}</p>
                      <p>形式: {galleryState.selectedImage.ext?.toUpperCase() || '不明'}</p>
                      <p>更新日時: {new Date(galleryState.selectedImage.modificationTime || galleryState.selectedImage.lastModified || galleryState.selectedImage.mtime || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {galleryState.selectedImage.tags && galleryState.selectedImage.tags.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 text-sm md:text-base">タグ</h4>
                      <div className="flex フレックス wrap gap-2">
                        {galleryState.selectedImage.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-gray-900 rounded text-[11px] md:text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {galleryState.selectedImage.annotation && (
                    <div>
                      <h4 className="font-medium mb-2 text-sm md:text-base">メタデータ</h4>
                      <pre className="text-[11px] md:text-xs bg-gray-900 p-3 rounded overflow-auto max-h-48">
                        {galleryState.selectedImage.annotation}
                      </pre>
                    </div>
                  )}
                  
                  <div className="flex flex-col space-y-2 md:space-y-3">
                    <button
                      onClick={() => handleLoadParameters(galleryState.selectedImage!)}
                      disabled={loadingParams}
                      className="button-primary text-xs md:text-sm"
                    >
                      {loadingParams ? '読み込み中...' : '📥 パラメーター読み込み'}
                    </button>
                    
                    {onAnalyzeImage && (
                      <button
                        onClick={() => handleSendToAnalyzer(galleryState.selectedImage!)}
                        className="button-secondary text-xs md:text-sm"
                      >
                        🔍 画像解析に送る
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 拡大画像モーダル */}
      {expandedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 overflow-y-auto"
          onClick={() => setExpandedImage(null)}
        >
          <div className="min-h-screen flex flex-col">
            {/* 画像表示エリア */}
            <div className="relative flex-shrink-0 h-screen md:h-[60vh] flex items-center justify-center p-3 md:p-4">
              {/* 左ナビゲーションボタン */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateExpandedImage('prev');
                }}
                className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text白 p-2 md:p-3 rounded-full hover:bg-opacity-75 transition-all z-10 text-sm md:text-base"
                title="前の画像 (←)"
              >
                ←
              </button>
              
              {/* 右ナビゲーションボタン */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateExpandedImage('next');
                }}
                className="absolute right-3 md:right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text白 p-2 md:p-3 rounded-full hover:bg-opacity-75 transition-all z-10 text-sm md:text-base"
                title="次の画像 (→)"
              >
                →
              </button>
              
              <img
                src={expandedImage}
                alt="Expanded"
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              
              {/* 画像インジケーター */}
              <div className="absolute bottom-3 md:bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text白 px-2 md:px-3 py-1 rounded text-xs md:text-sm">
                {filteredImages.findIndex(img => img.url === expandedImage) + 1} / {filteredImages.length}
              </div>
              
              <button
                onClick={() => setExpandedImage(null)}
                className="absolute top-3 md:top-4 right-3 md:right-4 text白 text-xl md:text-2xl hover:text-gray-300"
                title="閉じる (Esc)"
              >
                ✕
              </button>
            </div>
            
            {/* 詳細情報パネル */}
            <div className="w-full bg-gray-800" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-3 md:p-4 bg-gray-700 border-t border-gray-600">
                <h4 className="text白 font-medium text-sm md:text-base">📋 画像詳細</h4>
                <button
                  onClick={() => setIsExpandedImageInfoCollapsed(!isExpandedImageInfoCollapsed)}
                  className="text-gray-400 hover:text-gray-100 transition-colors text-sm md:text-base"
                  title={isExpandedImageInfoCollapsed ? '詳細を展開' : '詳細を折りたたむ'}
                >
                  {isExpandedImageInfoCollapsed ? '▼' : '▲'}
                </button>
              </div>
              
              {!isExpandedImageInfoCollapsed && (() => {
                const imageData = getExpandedImageData();
                if (!imageData) return null;
                
                let metadata: any = {};
                try {
                  metadata = imageData.annotation ? JSON.parse(imageData.annotation) : {};
                } catch {}

                return (
                  <div className="p-3 md:p-4 space-y-4 max-h-[80vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 基本情報 */}
                      <div>
                        <h5 className="text-xs md:text-sm font-medium text-gray-300 mb-2">基本情報</h5>
                        <div className="text-xs md:text-sm text-gray-400 space-y-1">
                          <p>ファイル名: {imageData.name}</p>
                          <p>サイズ: {imageData.width || '不明'} × {imageData.height || '不明'}</p>
                          <p>ファイルサイズ: {imageData.size ? (imageData.size / 1024 / 1024).toFixed(2) + ' MB' : '不明'}</p>
                          <p>形式: {imageData.ext?.toUpperCase() || '不明'}</p>
                          <p>更新日時: {new Date(imageData.modificationTime || imageData.lastModified || imageData.mtime || 0).toLocaleString()}</p>
                        </div>
                      </div>
                      
                      {/* 生成パラメーター */}
                      {(metadata.prompt || metadata.v4_prompt) && (
                        <div>
                          <h5 className="text-xs md:text-sm font-medium text-gray-300 mb-2">生成パラメーター</h5>
                          <div className="text-xs md:text-sm text-gray-400 space-y-1">
                            <p>モデル: {metadata.model || '不明'}</p>
                            <p>ステップ数: {metadata.steps || '不明'}</p>
                            <p>CFG Scale: {metadata.scale || '不明'}</p>
                            <p>サンプラー: {metadata.sampler || '不明'}</p>
                            {metadata.seed && <p>シード: {metadata.seed}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* プロンプト */}
                    {(metadata.prompt || metadata.v4_prompt) && (
                      <div>
                        <h5 className="text-xs md:text-sm font-medium text-gray-300 mb-2">プロンプト</h5>
                        <div className="text-xs bg-gray-900 p-2 rounded max-h-24 overflow-auto">
                          {metadata.v4_prompt?.caption?.base_caption || metadata.prompt || ''}
                        </div>
                      </div>
                    )}
                    
                    {/* 🔥 マルチキャラクタープロンプト表示 */}
                    {((metadata.v4_prompt?.caption?.char_captions && metadata.v4_prompt.caption.char_captions.length > 0) || 
                      (metadata.characters && Array.isArray(metadata.characters) && metadata.characters.length > 0)) && (
                      <div>
                        <h5 className="text-xs md:text-sm font-medium text-gray-300 mb-2">マルチキャラクタープロンプト</h5>
                        <div className="space-y-2">
                          {/* v4_prompt形式 */}
                          {metadata.v4_prompt?.caption?.char_captions?.map((char: any, index: number) => (
                            <div key={`v4-${index}`} className="bg-gray-900 p-2 rounded">
                              <div className="text-[11px] md:text-xs text-gray-300 mb-1">キャラクター {index + 1}:</div>
                              <div className="text-[11px] md:text-xs text-gray-100 mb-1">{char.char_caption || '(なし)'}</div>
                              {metadata.v4_negative_prompt?.caption?.char_captions?.[index]?.char_caption && (
                                <div className="text-[11px] md:text-xs text-red-300">
                                  ネガティブ: {metadata.v4_negative_prompt.caption.char_captions[index].char_caption}
                                </div>
                              )}
                              {char.centers?.[0] && (
                                <div className="text-[11px] md:text-xs text-blue-300">
                                  位置: ({(char.centers[0].x * 100).toFixed(1)}%, {(char.centers[0].y * 100).toFixed(1)}%)
                                </div>
                              )}
                            </div>
                          )) || 
                          /* characters形式 */
                          metadata.characters?.map((char: any, index: number) => (
                            <div key={`char-${index}`} className="bg-gray-900 p-2 rounded">
                              <div className="text-[11px] md:text-xs text-gray-300 mb-1">キャラクター {index + 1}:</div>
                              <div className="text-[11px] md:text-xs text-gray-100 mb-1">{char.caption || '(なし)'}</div>
                              {char.negativeCaption && (
                                <div className="text-[11px] md:text-xs text-red-300">
                                  ネガティブ: {char.negativeCaption}
                                </div>
                              )}
                              {(char.x !== undefined && char.y !== undefined) && (
                                <div className="text-[11px] md:text-xs text-blue-300">
                                  位置: ({(char.x * 100).toFixed(1)}%, {(char.y * 100).toFixed(1)}%)
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* ネガティブプロンプト */}
                    {(metadata.negativePrompt || metadata.uc || metadata.v4_negative_prompt) && (
                      <div>
                        <h5 className="text-xs md:text-sm font-medium text-gray-300 mb-2">ネガティブプロンプト</h5>
                        <div className="text-xs bg-gray-900 p-2 rounded max-h-24 overflow-auto">
                          {metadata.v4_negative_prompt?.caption?.base_caption || metadata.uc || metadata.negativePrompt || ''}
                        </div>
                      </div>
                    )}
                    
                    {/* タグ */}
                    {imageData.tags && imageData.tags.length > 0 && (
                      <div>
                        <h5 className="text-xs md:text-sm font-medium text-gray-300 mb-2">タグ</h5>
                        <div className="flex flex-wrap gap-1">
                          {imageData.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-gray-900 rounded text-[11px] md:text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* アクションボタン */}
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-2 md:pt-4 pb-2 md:pb-4">
                      <button
                        onClick={() => handleLoadParametersFromExpanded(imageData)}
                        disabled={loadingParams}
                        className="button-primary text-xs md:text-sm w-full sm:w-auto"
                      >
                        {loadingParams ? '読み込み中...' : '📥 パラメーター読み込み'}
                      </button>
                      
                      {onAnalyzeImage && (
                        <button
                          onClick={() => handleSendToAnalyzerFromExpanded(imageData)}
                          className="button-secondary text-xs md:text-sm w-full sm:w-auto"
                        >
                          🔍 画像解析に送る
                        </button>
                      )}
                      
                      {/* 🔥 拡大画像モーダルにもお気に入りボタンを追加 */}
                      <button
                        onClick={(e) => handleToggleFavorite(imageData.id, e)}
                        disabled={favoritingImages.has(imageData.id)}
                        className={`text-xs md:text-sm w-full sm:w-auto px-4 py-2 rounded-md font-medium transition-all ${
                          imageData.isFavorite
                            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        } ${favoritingImages.has(imageData.id) ? 'opacity-50 cursor-wait' : ''}`}
                      >
                        {favoritingImages.has(imageData.id) ? '⏳ 処理中...' : imageData.isFavorite ? '⭐ お気に入り解除' : '☆ お気に入り追加'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}