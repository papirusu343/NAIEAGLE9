export interface NovelAIRequest {
  input: string;
  model: string;
  action: string;
  parameters: {
    width: number;
    height: number;
    scale: number;
    sampler: string;
    steps: number;
    seed: number;
    n_samples: number;
    ucPreset: number;
    qualityToggle: boolean;
    sm: boolean;
    sm_dyn: boolean;
    dynamic_thresholding: boolean;
    controlnet_strength: number;
    legacy: boolean;
    add_original_image: boolean;
    cfg_rescale: number;
    noise_schedule: string;
    legacy_v3_extend: boolean;
    reference_information_extracted_multiple: any[];
    reference_strength_multiple: any[];
    uncond_scale: number;
    skip_cfg_above_sigma: null;
    skip_cfg_below_sigma: number;
    lora_unet_weights: null;
    lora_clip_weights: null;
    deliberate_euler_ancestral_bug: boolean;
    prefer_brownian: boolean;
    cfg_sched_eligibility: string;
    explike_fine_detail: boolean;
    minimize_sigma_inf: boolean;
    uncond_per_vibe: boolean;
    wonky_vibe_correlation: boolean;
    v4_prompt?: {
      caption: {
        base_caption: string;
        char_captions: CharCaption[];
      };
      use_coords: boolean;
      use_order: boolean;
      legacy_uc: boolean;
    };
    v4_negative_prompt?: {
      caption: {
        base_caption: string;
        char_captions: CharCaption[];
      };
      use_coords: boolean;
      use_order: boolean;
      legacy_uc: boolean;
    };
  };
}

export interface CharCaption {
  char_caption: string;
  centers: Center[];
}
export interface Center {
  x: number;
  y: number;
}

export interface GenerationParams {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  steps: number;
  scale: number;
  cfgRescale: number;
  seed?: number;
  sampler: string;
  model: string;
  customModel?: string;
  characters: CharacterConfig[];
  useCoords?: boolean;
}

export interface CharacterConfig {
  caption: string;
  negativeCaption?: string;
  x: number;
  y: number;
}

export interface EagleImage {
  id: string;
  name: string;
  size: number;
  ext: string;
  tags: string[];
  folders: string[];
  isDeleted: boolean;
  url: string;
  annotation: string;
  modificationTime: number;
  height: number;
  width: number;
  lastModified: number;
  palettes: any[];
  noThumbnail: boolean;
  metadata?: ImageMetadata;
  thumbUrl?: string;
  mtime?: number;
}

export interface ImageMetadata {
  prompt?: string;
  negativePrompt?: string;
  parameters?: any;
  v4_prompt?: any;
  v4_negative_prompt?: any;
  uc?: string;
  width?: number;
  height?: number;
  steps?: number;
  scale?: number;
  cfgRescale?: number;
  cfg_rescale?: number;
  seed?: number;
  sampler?: string;
  model?: string;
}

export interface EagleResponse<T> {
  status: string;
  data: T;
}

export interface WildcardFile {
  name: string;
  content: string;
}

export interface ImageAnalysisResult {
  metadata: any;
  extractedParams: Partial<GenerationParams>;
}

export interface ParameterReflectionSettings {
  model: boolean;
  prompt: boolean;
  negativePrompt: boolean;
  characters: boolean;
  width: boolean;
  height: boolean;
  steps: boolean;
  scale: boolean;
  cfgRescale: boolean;
  seed: boolean;
  sampler: boolean;
  useCoords: boolean;
}

export const MODELS = [
  { name: 'NAI Diffusion V4.5', value: 'nai-diffusion-4-5-full', description: '最新モデル - 最高品質' },
  { name: 'NAI Diffusion V4.5 Curated', value: 'nai-diffusion-4-5-curated', description: '最新モデル - キュレーション版' },
  { name: 'NAI Diffusion V4', value: 'nai-diffusion-4-full', description: 'V4モデル - フル版' },
  { name: 'NAI Diffusion V4 Curated', value: 'nai-diffusion-4-curated', description: 'V4モデル - キュレーション版' },
  { name: 'NAI Diffusion V3', value: 'nai-diffusion-3', description: 'V3モデル - 安定版' },
  { name: 'Custom Model', value: 'custom', description: 'カスタムモデル' },
];

export const SAMPLERS = [
  'k_euler',
  'k_euler_ancestral',
  'k_heun',
  'k_dpm_2',
  'k_dpm_2_ancestral',
  'k_lms',
  'plms',
  'ddim',
  'k_dpm_fast',
  'k_dpm_adaptive',
  'k_dpmpp_2s_ancestral',
  'k_dpmpp_2m',
  'k_dpmpp_sde',
  'ddim_v3'
];

/**
 * プリセットサイズ
 * - Small Portrait (512x768) / Small Landscape (768x512) を削除
 * - Tall Portrait (704x1472) を追加
 * 704 / 1472 は 64 の倍数で入力ステップやバリデーション範囲 (512〜2048) に適合
 */
export const PRESET_SIZES = [
  { name: 'Portrait\n(縦)',     width: 832,  height: 1216 },
  { name: 'Landscape\n(横)',    width: 1216, height: 832 },
  { name: 'Square\n(正方形)',  width: 1024, height: 1024 },
  { name: 'Tall Portrait\n(縦長)', width: 704,  height: 1472 },
];

export const STORAGE_KEYS = {
  LAST_GENERATION_PARAMS: 'naieagle5_last_generation_params',
  GENERATION_HISTORY: 'naieagle5_generation_history',
  WILDCARD_HISTORY: 'naieagle5_wildcard_history',
  GALLERY_FILTERS: 'naieagle5_gallery_filters',
  API_KEY: 'naieagle5_api_key',
  EAGLE_SETTINGS: 'naieagle5_eagle_settings',
} as const;

export type NovelAIGenerateRequest = NovelAIRequest;