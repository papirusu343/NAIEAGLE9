import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { ImageAnalysisResult, GenerationParams, ParameterReflectionSettings, MODELS, SAMPLERS } from '../types/novelai';

interface ImageAnalyzerProps {
  onLoadParameters: (params: Partial<GenerationParams>) => void;
  initialImageUrl?: string | null;
  onImageUrlProcessed?: () => void;
}

interface ComparisonResult {
  key: string;
  value1: any;
  value2: any;
  isDifferent: boolean;
  type: 'both' | 'only1' | 'only2';
}

export default function ImageAnalyzer({ onLoadParameters, initialImageUrl, onImageUrlProcessed }: ImageAnalyzerProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // メタデータ比較用の状態
  const [compareMode, setCompareMode] = useState(false);
  const [selectedImage2, setSelectedImage2] = useState<string | null>(null);
  const [analysisResult2, setAnalysisResult2] = useState<ImageAnalysisResult | null>(null);
  const [isAnalyzing2, setIsAnalyzing2] = useState(false);
  const [analysisError2, setAnalysisError2] = useState<string | null>(null);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  
  const [reflectionSettings, setReflectionSettings] = useState<ParameterReflectionSettings>({
    model: true,
    prompt: true,
    negativePrompt: true,
    characters: true,
    width: true,
    height: true,
    steps: true,
    scale: true,
    cfgRescale: true,
    seed: false,
    sampler: true,
  });

  // 解析処理を継続するためのRef
  const analysisRef = useRef<{
    isRunning: boolean;
    controller: AbortController | null;
  }>({ isRunning: false, controller: null });

  const analysisRef2 = useRef<{
    isRunning: boolean;
    controller: AbortController | null;
  }>({ isRunning: false, controller: null });

  // 初期画像URLが渡された場合の処理
  useEffect(() => {
    if (initialImageUrl) {
      setSelectedImage(initialImageUrl);
      analyzeImageFromUrl(initialImageUrl, 1);
      if (onImageUrlProcessed) {
        onImageUrlProcessed();
      }
    }
  }, [initialImageUrl]);

  // メタデータ比較の実行
  useEffect(() => {
    if (compareMode && analysisResult && analysisResult2) {
      performComparison();
    }
  }, [compareMode, analysisResult, analysisResult2]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('画像ファイルを選択してください');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setSelectedImage(e.target.result as string);
          analyzeImage(file, 1);
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const onDrop2 = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('画像ファイルを選択してください');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setSelectedImage2(e.target.result as string);
          analyzeImage(file, 2);
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    multiple: false
  });

  const { getRootProps: getRootProps2, getInputProps: getInputProps2, isDragActive: isDragActive2 } = useDropzone({
    onDrop: onDrop2,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    multiple: false
  });

  const analyzeImageFromUrl = async (imageUrl: string, imageNum: number) => {
    const controller = new AbortController();
    const setAnalyzing = imageNum === 1 ? setIsAnalyzing : setIsAnalyzing2;
    const setResult = imageNum === 1 ? setAnalysisResult : setAnalysisResult2;
    const setError = imageNum === 1 ? setAnalysisError : setAnalysisError2;
    const analysisRefCurrent = imageNum === 1 ? analysisRef : analysisRef2;

    // 既存の解析をキャンセル
    if (analysisRefCurrent.current.controller) {
      analysisRefCurrent.current.controller.abort();
    }

    analysisRefCurrent.current = { isRunning: true, controller };

    setAnalyzing(true);
    setResult(null);
    setError(null);

    const loadingToast = toast.loading(`🔍 画像${imageNum}を解析中...`, { duration: 0 });

    try {
      toast.loading('📊 メタデータを抽出中...', { id: loadingToast });
      
      // URLから画像を取得
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error('画像の取得に失敗しました');
      }
      
      const imageBlob = await response.blob();
      
      if (controller.signal.aborted) return;
      
      await analyzeImageBlob(imageBlob, loadingToast, controller, imageNum);

    } catch (error: any) {
      console.error(`Image analysis from URL failed (image ${imageNum}):`, error);
      
      if (!controller.signal.aborted) {
        const errorMessage = error.message || '画像の解析に失敗しました';
        setError(errorMessage);
        toast.error('❌ 解析に失敗しました', { id: loadingToast });
      }
    } finally {
      if (!controller.signal.aborted) {
        setAnalyzing(false);
        analysisRefCurrent.current.isRunning = false;
      }
    }
  };

  const analyzeImage = async (file: File, imageNum: number) => {
    const controller = new AbortController();
    const setAnalyzing = imageNum === 1 ? setIsAnalyzing : setIsAnalyzing2;
    const setResult = imageNum === 1 ? setAnalysisResult : setAnalysisResult2;
    const setError = imageNum === 1 ? setAnalysisError : setAnalysisError2;
    const analysisRefCurrent = imageNum === 1 ? analysisRef : analysisRef2;

    // 既存の解析をキャンセル
    if (analysisRefCurrent.current.controller) {
      analysisRefCurrent.current.controller.abort();
    }

    analysisRefCurrent.current = { isRunning: true, controller };

    setAnalyzing(true);
    setResult(null);
    setError(null);

    const loadingToast = toast.loading(`🔍 画像${imageNum}を解析中...`, { duration: 0 });

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      if (controller.signal.aborted) return;
      
      const imageBlob = new Blob([arrayBuffer], { type: file.type });
      await analyzeImageBlob(imageBlob, loadingToast, controller, imageNum);

    } catch (error: any) {
      console.error(`Image analysis failed (image ${imageNum}):`, error);
      
      if (!controller.signal.aborted) {
        const errorMessage = error.message || '画像の解析に失敗しました';
        setError(errorMessage);
        toast.error('❌ 解析に失敗しました', { id: loadingToast });
      }
    } finally {
      if (!controller.signal.aborted) {
        setAnalyzing(false);
        analysisRefCurrent.current.isRunning = false;
      }
    }
  };

  const analyzeImageBlob = async (imageBlob: Blob, loadingToast: string, controller: AbortController, imageNum: number) => {
    const setResult = imageNum === 1 ? setAnalysisResult : setAnalysisResult2;
    
    // PNGメタデータを読み取り
    toast.loading('📊 メタデータを抽出中...', { id: loadingToast });
    const arrayBuffer = await imageBlob.arrayBuffer();
    
    if (controller.signal.aborted) return;
    
    const uint8Array = new Uint8Array(arrayBuffer);
    
    let metadata: any = {};
    let extractedParams: Partial<GenerationParams> = {};

    // ファイル形式に応じてメタデータを抽出
    if (imageBlob.type === 'image/png') {
      metadata = extractPngMetadata(uint8Array);
    } else {
      // JPEG等の場合はEXIFを試行
      metadata = await extractExifMetadata(arrayBuffer);
    }

    if (controller.signal.aborted) return;

    toast.loading('⚙️ パラメーターを解析中...', { id: loadingToast });

    // NovelAIのメタデータを解析
    extractedParams = parseAllMetadata(metadata);

    if (controller.signal.aborted) return;

    // 解析結果が空の場合
    if (Object.keys(extractedParams).length === 0) {
      throw new Error('画像からパラメーターを抽出できませんでした。\n\n考えられる原因:\n• この画像にはAI生成パラメーターが含まれていません\n• サポートされていない形式です\n• メタデータが削除されています');
    }

    setResult({
      metadata,
      extractedParams
    });

    toast.success(`✅ 画像${imageNum}の解析が完了しました`, { id: loadingToast });
  };

  const performComparison = () => {
    if (!analysisResult || !analysisResult2) return;

    const results: ComparisonResult[] = [];
    const allKeys = new Set([
      ...Object.keys(analysisResult.extractedParams),
      ...Object.keys(analysisResult2.extractedParams)
    ]);

    allKeys.forEach(key => {
      const value1 = analysisResult.extractedParams[key as keyof GenerationParams];
      const value2 = analysisResult2.extractedParams[key as keyof GenerationParams];
      
      let type: 'both' | 'only1' | 'only2' = 'both';
      if (value1 !== undefined && value2 === undefined) {
        type = 'only1';
      } else if (value1 === undefined && value2 !== undefined) {
        type = 'only2';
      }

      const isDifferent = JSON.stringify(value1) !== JSON.stringify(value2);

      results.push({
        key,
        value1,
        value2,
        isDifferent,
        type
      });
    });

    setComparisonResults(results);
  };

  const extractPngMetadata = (uint8Array: Uint8Array): any => {
    const metadata: any = {};
    let offset = 8; // PNG署名をスキップ

    try {
      while (offset < uint8Array.length - 8) {
        // チャンクの長さを読み取り
        const length = new DataView(uint8Array.buffer, offset, 4).getUint32(0, false);
        offset += 4;

        // チャンクタイプを読み取り
        const type = new TextDecoder().decode(uint8Array.slice(offset, offset + 4));
        offset += 4;

        if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
          try {
            const chunkData = uint8Array.slice(offset, offset + length);
            
            if (type === 'tEXt') {
              const text = new TextDecoder('latin1').decode(chunkData);
              const nullIndex = text.indexOf('\0');
              if (nullIndex !== -1) {
                const key = text.substring(0, nullIndex);
                const value = text.substring(nullIndex + 1);
                metadata[key] = value;
              }
            } else if (type === 'iTXt') {
              const text = new TextDecoder('utf-8').decode(chunkData);
              const nullIndex = text.indexOf('\0');
              if (nullIndex !== -1) {
                const key = text.substring(0, nullIndex);
                // iTXtは複雑な構造なので簡易解析
                const remaining = text.substring(nullIndex + 1);
                const secondNull = remaining.indexOf('\0');
                if (secondNull !== -1) {
                  const value = remaining.substring(secondNull + 1);
                  metadata[key] = value;
                }
              }
            }
            // zTXt（圧縮テキスト）は未対応（外部依存なく安全に解凍できないため）
          } catch (chunkError) {
            console.warn('Failed to parse chunk:', type, chunkError);
          }
        }

        offset += length + 4; // データ + CRC

        // 無限ループ防止
        if (length > 100000000) break;
      }
    } catch (error) {
      console.warn('PNG metadata extraction error:', error);
    }

    return metadata;
  };

  const extractExifMetadata = async (arrayBuffer: ArrayBuffer): Promise<any> => {
    // 簡易EXIF解析（完全な実装ではありません）
    const metadata: any = {};
    
    try {
      const uint8Array = new Uint8Array(arrayBuffer);
      const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
      
      // テキスト内からJSONパターンを検索
      const jsonMatches = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
      if (jsonMatches) {
        for (const match of jsonMatches) {
          try {
            const parsed = JSON.parse(match);
            if (parsed.prompt || parsed.v4_prompt || parsed.steps) {
              Object.assign(metadata, { Comment: match });
              break;
            }
          } catch (e) {
            // JSON解析失敗は無視
          }
        }
      }
    } catch (error) {
      console.warn('EXIF extraction failed:', error);
    }

    return metadata;
  };

  // 既知ハッシュ→モデル名マップ（提供情報に基づく）
  const SOURCE_HASH_MAP: Record<string, string> = {
    // NAI Diffusion V4.5
    '4BDE2A90': 'nai-diffusion-4-5-full',
    'B9F340FD': 'nai-diffusion-4-5-full',
    'C02D4F98': 'nai-diffusion-4-5-curated',
    // NAI Diffusion V4
    '37442FCA': 'nai-diffusion-4-full',
    '7ABFFA2A': 'nai-diffusion-4-curated',
    // V3 (Anime / Furry)
    '7BCCAA2C': 'nai-diffusion-anime-v3',
    'C1E1DE52': 'nai-diffusion-anime-v3',
    '37C2B166': 'nai-diffusion-furry-v3',
    // V2 (Anime)
    'F1022D28': 'nai-diffusion-anime-v2',
  };

  // NovelAI/StableDiffusion系のSource/Software表記からモデル（派生含む）を推定
  const detectNovelAIModelFromSource = (sourceText: string): string | undefined => {
    if (!sourceText) return undefined;

    // 1) 末尾などに含まれる8桁HEXハッシュでの厳密判定（優先）
    const hashMatch = sourceText.match(/\b([A-F0-9]{8})\b/i);
    if (hashMatch) {
      const hash = hashMatch[1].toUpperCase();
      const mapped = SOURCE_HASH_MAP[hash];
      if (mapped) return mapped;
    }

    // 2) 旧来のバージョン＋バリアント表記のゆるやかな判定
    // 例: "NovelAI Diffusion V4.5 (Curated)" / "NovelAI Diffusion V4 (Inpainting)"
    const re = /NovelAI\s+Diffusion\s+(V[\d.]+)(?:\s*\(([^)]+)\))?/i;
    const m = sourceText.match(re);
    if (!m) return undefined;

    const versionRaw = (m[1] || '').toLowerCase(); // v4.5, v4
    const variantRaw = (m[2] || '').toLowerCase(); // curated, inpainting, full, etc.

    const version = versionRaw.includes('4.5') ? '4-5' : versionRaw.includes('4') ? '4' : undefined;
    if (!version) return undefined;

    // variantの正規化
    let variant: 'curated' | 'inpainting' | 'full' | undefined;
    if (variantRaw.includes('curated') || variantRaw.includes('curate')) {
      variant = 'curated';
    } else if (variantRaw.includes('inpaint')) {
      variant = 'inpainting';
    } else if (variantRaw.includes('full') || variantRaw.includes('base')) {
      variant = 'full';
    } else if (variantRaw.trim().length === 0) {
      // 明示されていない場合は未確定（誤認回避のためデフォルト付与はしない）
      variant = undefined;
    }

    if (!variant) {
      // バリアント不明な場合は確定しない（hash一致がない限り保留）
      return undefined;
    }

    if (version === '4-5') {
      return `nai-diffusion-4-5-${variant}`;
    }
    if (version === '4') {
      return `nai-diffusion-4-${variant}`;
    }
    return undefined;
  };

  // メタデータ内の文字列値に含まれるJSONを幅広く探索して追加入手
  const tryParseAnyJsonInMetadata = (metadata: any): any[] => {
    const found: any[] = [];
    Object.values(metadata).forEach((val) => {
      if (typeof val !== 'string') return;
      const s = val.trim();
      if (!s.startsWith('{') && !s.startsWith('[')) return;
      try {
        const parsed = JSON.parse(s);
        found.push(parsed);
      } catch {
        // ignore
      }
    });
    return found;
  };

  const parseAllMetadata = (metadata: any): Partial<GenerationParams> => {
    let extracted: Partial<GenerationParams> = {};

    // NovelAI形式のComment JSONを優先解析
    if (metadata.Comment) {
      try {
        const commentData = JSON.parse(metadata.Comment);
        extracted = parseNovelAIParams(commentData);
      } catch (error) {
        console.warn('Failed to parse Comment JSON:', error);
      }
    }

    // Descriptionからもパラメーター抽出を試行
    if (Object.keys(extracted).length === 0 && metadata.Description) {
      extracted.prompt = metadata.Description;
    }

    // Titleも確認
    if (!extracted.prompt && metadata.Title && metadata.Title !== 'AI generated image') {
      extracted.prompt = metadata.Title;
    }

    // Source/Software からモデル情報（派生含む）を抽出（強化版）
    let detectedModel: string | undefined;
    if (metadata.Source) {
      detectedModel = detectNovelAIModelFromSource(metadata.Source);
    }
    if (!detectedModel && metadata.Software) {
      detectedModel = detectNovelAIModelFromSource(metadata.Software);
    }
    if (detectedModel) {
      extracted.model = detectedModel;
    }

    // 追加: 他のキーの中にJSONがそのまま入っている場合も探索して補完
    // 例: iTXt に JSON文字列が格納されているが Comment キーではないケース
    const extraJsons = tryParseAnyJsonInMetadata(metadata);
    for (const obj of extraJsons) {
      try {
        const maybe = parseNovelAIParams(obj);
        // 既に値があるものは維持、空のもののみ補完
        extracted = { ...maybe, ...extracted };
      } catch {
        // ignore
      }
    }

    // 他の形式も試行
    if (Object.keys(extracted).length === 0) {
      // Automatic1111形式
      extracted = parseAutomatic1111Format(metadata);
    }

    if (Object.keys(extracted).length === 0) {
      // ComfyUI形式
      extracted = parseComfyUIFormat(metadata);
    }

    return extracted;
  };

  const parseNovelAIParams = (params: any): Partial<GenerationParams> => {
    const extracted: Partial<GenerationParams> = {};

    try {
      // V4形式のパラメーター解析
      if (params.v4_prompt?.caption?.base_caption) {
        extracted.prompt = params.v4_prompt.caption.base_caption;
      } else if (params.prompt) {
        extracted.prompt = params.prompt;
      }

      if (params.v4_negative_prompt?.caption?.base_caption) {
        extracted.negativePrompt = params.v4_negative_prompt.caption.base_caption;
      } else if (params.uc) {
        extracted.negativePrompt = params.uc;
      }

      // キャラクター情報
      if (params.v4_prompt?.caption?.char_captions && params.v4_prompt.caption.char_captions.length > 0) {
        extracted.characters = params.v4_prompt.caption.char_captions.map((char: any, index: number) => ({
          caption: char.char_caption || '',
          negativeCaption: params.v4_negative_prompt?.caption?.char_captions?.[index]?.char_caption || '',
          x: char.centers?.[0]?.x || 0.5,
          y: char.centers?.[0]?.y || 0.5,
        }));
      }

      // 基本パラメーター
      if (params.width) extracted.width = parseInt(params.width);
      if (params.height) extracted.height = parseInt(params.height);
      if (params.steps) extracted.steps = parseInt(params.steps);
      if (params.scale) extracted.scale = parseFloat(params.scale);
      if (params.cfg_rescale !== undefined) extracted.cfgRescale = parseFloat(params.cfg_rescale);
      if (params.seed) extracted.seed = parseInt(params.seed);
      if (params.sampler) extracted.sampler = params.sampler;

      // モデル名（JSON内に含まれる場合は採用）
      if (typeof params.model === 'string' && params.model.trim()) {
        extracted.model = params.model.trim();
      }

      // 以前はここでモデル未検出時に 'nai-diffusion-4-5-full' をデフォルト付与していたが、
      // 誤認の原因となるため削除（未設定のままとする）
    } catch (error) {
      console.warn('NovelAI parameter parsing error:', error);
    }

    return extracted;
  };

  const parseAutomatic1111Format = (metadata: any): Partial<GenerationParams> => {
    const extracted: Partial<GenerationParams> = {};

    // Automatic1111のparameters形式を解析
    if (metadata.parameters) {
      const lines = metadata.parameters.split('\n');
      let prompt = '';
      let negativePrompt = '';
      let paramsLine = '';

      let currentSection = 'prompt';
      for (const line of lines) {
        if (line.startsWith('Negative prompt:')) {
          currentSection = 'negative';
          negativePrompt = line.replace('Negative prompt:', '').trim();
        } else if (line.includes('Steps:')) {
          paramsLine = line;
          break;
        } else if (currentSection === 'prompt') {
          prompt += (prompt ? ' ' : '') + line.trim();
        } else if (currentSection === 'negative') {
          negativePrompt += (negativePrompt ? ' ' : '') + line.trim();
        }
      }

      if (prompt) extracted.prompt = prompt;
      if (negativePrompt) extracted.negativePrompt = negativePrompt;

      // パラメーター行を解析
      if (paramsLine) {
        const stepMatch = paramsLine.match(/Steps:\s*(\d+)/);
        if (stepMatch) extracted.steps = parseInt(stepMatch[1]);

        const samplerMatch = paramsLine.match(/Sampler:\s*([^,]+)/);
        if (samplerMatch) extracted.sampler = samplerMatch[1].trim();

        const cfgMatch = paramsLine.match(/CFG scale:\s*([\d.]+)/);
        if (cfgMatch) extracted.scale = parseFloat(cfgMatch[1]);

        const seedMatch = paramsLine.match(/Seed:\s*(\d+)/);
        if (seedMatch) extracted.seed = parseInt(seedMatch[1]);

        const sizeMatch = paramsLine.match(/Size:\s*(\d+)x(\d+)/);
        if (sizeMatch) {
          extracted.width = parseInt(sizeMatch[1]);
          extracted.height = parseInt(sizeMatch[2]);
        }
      }
    }

    return extracted;
  };

  const parseComfyUIFormat = (metadata: any): Partial<GenerationParams> => {
    const extracted: Partial<GenerationParams> = {};

    // ComfyUIのworkflow形式を解析
    if (metadata.workflow || metadata.prompt) {
      try {
        const workflowData = JSON.parse(metadata.workflow || metadata.prompt);
        // ComfyUIのワークフロー解析ロジック（簡易版）
        // 実際の実装はより複雑になります
      } catch (error) {
        console.warn('ComfyUI format parsing failed:', error);
      }
    }

    return extracted;
  };

  const handleReflectionSettingChange = (key: keyof ParameterReflectionSettings) => {
    setReflectionSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleApplyParameters = () => {
    if (!analysisResult?.extractedParams) {
      toast.error('解析されたパラメーターがありません');
      return;
    }

    const filteredParams: Partial<GenerationParams> = {};

    // 選択された項目のみ反映
    Object.entries(reflectionSettings).forEach(([key, enabled]) => {
      if (enabled && analysisResult.extractedParams[key as keyof GenerationParams] !== undefined) {
        (filteredParams as any)[key] = analysisResult.extractedParams[key as keyof GenerationParams];
      }
    });

    onLoadParameters(filteredParams);
    toast.success('選択されたパラメーターを反映しました');
  };

  const clearImage = () => {
    // 進行中の解析をキャンセル
    if (analysisRef.current.controller) {
      analysisRef.current.controller.abort();
    }
    
    setSelectedImage(null);
    setAnalysisResult(null);
    setAnalysisError(null);
    setIsAnalyzing(false);
  };

  const clearImage2 = () => {
    // 進行中の解析をキャンセル
    if (analysisRef2.current.controller) {
      analysisRef2.current.controller.abort();
    }
    
    setSelectedImage2(null);
    setAnalysisResult2(null);
    setAnalysisError2(null);
    setIsAnalyzing2(false);
  };

  const clearComparison = () => {
    setCompareMode(false);
    setComparisonResults([]);
    clearImage2();
  };

  const retryAnalysis = () => {
    if (selectedImage) {
      // 元のファイルがないので、再アップロードが必要
      toast.info('画像を再度アップロードしてください');
      clearImage();
    }
  };

  const formatValue = (value: any): string => {
    if (value === undefined || value === null) {
      return '未設定';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const renderComparisonTable = () => {
    if (!comparisonResults.length) return null;

    const differentItems = comparisonResults.filter(item => item.isDifferent);
    const sameItems = comparisonResults.filter(item => !item.isDifferent);

    return (
      <div className="space-y-6">
        {/* 異なる項目 */}
        {differentItems.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 text-yellow-400">⚠️ 異なる項目 ({differentItems.length})</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-gray-800 rounded-lg">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="px-4 py-2 text-left">パラメーター</th>
                    <th className="px-4 py-2 text-left">画像1</th>
                    <th className="px-4 py-2 text-left">画像2</th>
                  </tr>
                </thead>
                <tbody>
                  {differentItems.map((item, index) => (
                    <tr key={index} className="border-t border-gray-600 bg-yellow-900/20">
                      <td className="px-4 py-2 font-medium text-yellow-400">{item.key}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={item.type === 'only2' ? 'text-gray-500' : ''}>
                          {formatValue(item.value1)}
                        </span>
                        {item.type === 'only1' && <span className="ml-2 text-blue-400">（画像1のみ）</span>}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span className={item.type === 'only1' ? 'text-gray-500' : ''}>
                          {formatValue(item.value2)}
                        </span>
                        {item.type === 'only2' && <span className="ml-2 text-green-400">（画像2のみ）</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 同じ項目 */}
        {sameItems.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 text-green-400">✅ 同じ項目 ({sameItems.length})</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-gray-800 rounded-lg">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="px-4 py-2 text-left">パラメーター</th>
                    <th className="px-4 py-2 text-left">値</th>
                  </tr>
                </thead>
                <tbody>
                  {sameItems.map((item, index) => (
                    <tr key={index} className="border-t border-gray-600 bg-green-900/20">
                      <td className="px-4 py-2 font-medium text-green-400">{item.key}</td>
                      <td className="px-4 py-2 text-sm">{formatValue(item.value1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* モード切り替え */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">📷 画像解析</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setCompareMode(false);
                clearComparison();
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !compareMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🔍 単一解析
            </button>
            <button
              onClick={() => setCompareMode(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                compareMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              ⚖️ メタデータ比較
            </button>
          </div>
        </div>
        
        {compareMode && (
          <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-blue-400 mb-2">💡 メタデータ比較モード</h4>
            <p className="text-sm text-blue-100">
              2つの画像のメタデータを比較して、異なる点を強調表示します。
              両方の画像をアップロードすると自動的に比較が開始されます。
            </p>
          </div>
        )}
      </div>

      {/* 画像アップロード */}
      <div className={`grid gap-6 ${compareMode ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* 画像1 */}
        <div className="card">
          <h4 className="font-medium mb-4">{compareMode ? '📷 画像1' : '📷 画像アップロード'}</h4>
          
          {!selectedImage ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              <input {...getInputProps()} />
              <div className="space-y-4">
                <div className="text-6xl">📷</div>
                <div>
                  <p className="text-lg font-medium">
                    {isDragActive ? '画像をドロップしてください' : '画像をドラッグ&ドロップまたはクリックして選択'}
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    PNG, JPG, JPEG, WebP形式をサポート
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={selectedImage}
                  alt="Selected 1"
                  className="w-full max-w-md mx-auto rounded-lg border border-gray-700"
                />
                <button
                  onClick={clearImage}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
              
              {isAnalyzing && (
                <div className="text-center py-4">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-gray-400">画像1を解析中...</p>
                  <p className="text-xs text-gray-500 mt-1">タブを変更しても解析は継続されます</p>
                </div>
              )}

              {analysisError && (
                <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-red-400">🚨 解析エラー</h4>
                    <button
                      onClick={() => setAnalysisError(null)}
                      className="text-red-400 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-sm text-red-100 whitespace-pre-line">{analysisError}</p>
                  <button
                    onClick={retryAnalysis}
                    className="button-secondary mt-3 text-sm"
                  >
                    🔄 再試行
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 画像2（比較モードのみ） */}
        {compareMode && (
          <div className="card">
            <h4 className="font-medium mb-4">📷 画像2</h4>
            
            {!selectedImage2 ? (
              <div
                {...getRootProps2()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive2 
                    ? 'border-green-500 bg-green-500/10' 
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <input {...getInputProps2()} />
                <div className="space-y-4">
                  <div className="text-6xl">📷</div>
                  <div>
                    <p className="text-lg font-medium">
                      {isDragActive2 ? '画像をドロップしてください' : '比較する画像をアップロード'}
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      PNG, JPG, JPEG, WebP形式をサポート
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <img
                    src={selectedImage2}
                    alt="Selected 2"
                    className="w-full max-w-md mx-auto rounded-lg border border-gray-700"
                  />
                  <button
                    onClick={clearImage2}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
                
                {isAnalyzing2 && (
                  <div className="text-center py-4">
                    <div className="animate-spin w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-gray-400">画像2を解析中...</p>
                    <p className="text-xs text-gray-500 mt-1">タブを変更しても解析は継続されます</p>
                  </div>
                )}

                {analysisError2 && (
                  <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-red-400">🚨 解析エラー</h4>
                      <button
                        onClick={() => setAnalysisError2(null)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-sm text-red-100 whitespace-pre-line">{analysisError2}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* メタデータ比較結果 */}
      {compareMode && analysisResult && analysisResult2 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">⚖️ メタデータ比較結果</h3>
            <button
              onClick={clearComparison}
              className="button-secondary text-sm"
            >
              🗑️ 比較をクリア
            </button>
          </div>
          
          {comparisonResults.length > 0 ? (
            <>
              <div className="mb-4 p-4 bg-gray-800 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {comparisonResults.filter(item => item.isDifferent).length}
                    </div>
                    <div className="text-gray-400">異なる項目</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">
                      {comparisonResults.filter(item => !item.isDifferent).length}
                    </div>
                    <div className="text-gray-400">同じ項目</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-400">
                      {comparisonResults.length}
                    </div>
                    <div className="text-gray-400">総項目数</div>
                  </div>
                </div>
              </div>
              
              {renderComparisonTable()}
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p>比較データがありません</p>
            </div>
          )}
        </div>
      )}

      {/* メタデータ表示（単一解析モード） */}
      {!compareMode && analysisResult && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">🔍 解析結果</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 生メタデータ */}
            <div>
              <h4 className="font-medium mb-3">生メタデータ</h4>
              <pre className="text-xs bg-gray-900 p-4 rounded overflow-auto max-h-96 whitespace-pre-wrap">
                {JSON.stringify(analysisResult.metadata, null, 2)}
              </pre>
            </div>

            {/* 抽出されたパラメーター */}
            <div>
              <h4 className="font-medium mb-3">抽出されたパラメーター</h4>
              {Object.keys(analysisResult.extractedParams).length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {Object.entries(analysisResult.extractedParams).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <span className="font-medium text-blue-400">{key}:</span>
                      <span className="ml-2 text-gray-300">
                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>パラメーターが抽出されませんでした</p>
                  <p className="text-xs mt-1">この画像にはAI生成情報が含まれていない可能性があります</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* パラメーター反映設定（単一解析モードのみ） */}
      {!compareMode && analysisResult?.extractedParams && Object.keys(analysisResult.extractedParams).length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">⚙️ パラメーター反映設定</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            {Object.entries(reflectionSettings).map(([key, enabled]) => {
              const hasValue = analysisResult.extractedParams[key as keyof GenerationParams] !== undefined;
              return (
                <label 
                  key={key} 
                  className={`flex items-center space-x-2 cursor-pointer ${
                    !hasValue ? 'opacity-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={enabled && hasValue}
                    onChange={() => handleReflectionSettingChange(key as keyof ParameterReflectionSettings)}
                    disabled={!hasValue}
                    className="rounded"
                  />
                  <span className="text-sm">{key}</span>
                  {hasValue && <span className="text-xs text-green-400">✓</span>}
                </label>
              );
            })}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleApplyParameters}
              className="button-primary flex-1"
            >
              ✅ 選択されたパラメーターを生成フォームに反映
            </button>
            
            <button
              onClick={() => {
                setReflectionSettings({
                  model: true,
                  prompt: true,
                  negativePrompt: true,
                  characters: true,
                  width: true,
                  height: true,
                  steps: true,
                  scale: true,
                  cfgRescale: true,
                  seed: false,
                  sampler: true,
                });
              }}
              className="button-secondary"
            >
              🔄 デフォルトに戻す
            </button>
          </div>
        </div>
      )}

      {/* 使用方法 */}
      <div className="card">
        <h4 className="font-medium mb-3">💡 使用方法</h4>
        <div className="text-sm text-gray-400 space-y-2">
          <p>• <strong>単一解析:</strong> NovelAI、Automatic1111などで生成された画像をアップロードしてメタデータを抽出</p>
          <p>• <strong>メタデータ比較:</strong> 2つの画像のメタデータを比較して異なる点を強調表示</p>
          <p>• PNGのtEXtチャンク、EXIFデータなどに対応</p>
          <p>• 解析処理は他のタブに移動しても継続されます</p>
          <p>• 比較結果では異なる項目は黄色、同じ項目は緑色で表示されます</p>
        </div>
      </div>
    </div>
  );
}