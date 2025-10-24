// モデル名に応じてEagleの保存先フォルダIDを返すユーティリティ
// 既定フォルダ（フォールバック）
export const DEFAULT_EAGLE_FOLDER_ID = 'LUOVAHFV3SGUZ';

// 正規化ヘルパー（小文字化・トリミング・空白をハイフンに）
const normalize = (s?: string | null) =>
  (s || '').toString().trim().toLowerCase().replace(/\s+/g, '-');

// モデル名 → フォルダID マッピング
// 例: 'nai-diffusion-4-5-full' などの正規化済み名称をキーにする
const MODEL_TO_FOLDER_ID: Record<string, string> = {
  'nai-diffusion-4-5-full': 'MECT5YZSA7TPT',
  'nai-diffusion-4-5-curated': 'MECT6P75FTEGK',
  'nai-diffusion-4-full': 'MECT70BF3UPYS',
  'nai-diffusion-4-curated': 'MECT77QTN0THN',
  'nai-diffusion-anime-v3': 'MECT7M4307N1B',
  'nai-diffusion-furry-v3': 'MECT7TLF5CB30',
};

// モデル名からフォルダIDを取得（該当なしは undefined）
export function getEagleFolderIdForModel(rawModel?: string | null): string | undefined {
  const key = normalize(rawModel);

  // 既知の別表記を正規化（必要に応じて追加）
  // 例: 'nai diffusion 4.5 full' → 'nai-diffusion-4-5-full'
  const normalizedKey = key
    .replace(/nai[-\s]*diffusion/g, 'nai-diffusion')
    .replace(/v?4\.5/g, '4-5')
    .replace(/v?4\b/g, '4');

  return MODEL_TO_FOLDER_ID[normalizedKey] || MODEL_TO_FOLDER_ID[key];
}