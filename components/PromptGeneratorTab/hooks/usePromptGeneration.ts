import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { PromptGeneratorState } from '../types';
import { promptGenerator } from '../../../utils/promptGenerator';

/**
 * ランダムプロンプト生成タブ用の生成フック
 * - state内のテンプレ（メイン/キャラ/ネガティブ）を用いて展開
 * - ワイルドカードは引数の wildcardFiles を使用
 * - グループやlabelには依存しない（固定グループ設定はこのフックでは未使用）
 * - 生成後、フォーム（prompt/negativePrompt/characters）にも反映する
 */
type Templates = Array<{ name: string; data: any }>;

type UsePromptGenerationReturn = {
  loading: boolean;
  generatedPrompt: {
    mainPrompt: string;
    characterPrompts: string[];
  } | null;
  handleGenerate: () => Promise<void>;
};

export const usePromptGeneration = (
  templates: Templates,
  state: PromptGeneratorState,
  wildcardFiles: Map<string, string[]>,
  setValue: (name: string, value: any, options?: any) => void,
  fields: Array<{ id: string }>,
  remove: (index: number) => void,
  append: (value: any, options?: any) => void
): UsePromptGenerationReturn => {
  const [loading, setLoading] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<{
    mainPrompt: string;
    characterPrompts: string[];
  } | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!state) return;
    setLoading(true);

    try {
      // 使用するテンプレ
      const mainTemplate = (state as any).mainPromptTemplate || '';
      const charTemplate = (state as any).characterPromptTemplate || '';
      const mainNegativeTemplate = (state as any).mainNegativePromptTemplate || '';
      const characterNegativeTemplate = (state as any).characterNegativePromptTemplate || '';

      // 何人分展開するか（テンプレ主体。固定人数が未指定の場合のフォールバックは2人）
      // ランダムタブでは groupConfig に依存せず、テンプレの構造や使用側の想定に合わせて最低2人分用意
      const defaultPartySize = 2;

      // selections/candidates は空ベース（ランダムタブではルール適用なし）
      const emptySelections = Array.from({ length: defaultPartySize }, () => ({} as Record<string, string>));
      const emptyCandidates = Array.from({ length: defaultPartySize }, () => ({} as Record<string, string[]>));

      // 主要プロンプトとキャラプロンプトを展開
      // ルールベースと同一APIを利用（selections/candidates は空のため、テンプレとワイルドカード中心の展開）
      const out = promptGenerator.generatePromptFromSelections(
        mainTemplate,
        charTemplate,
        {}, // common
        {}, // memberCommon
        emptySelections,
        emptyCandidates,
        wildcardFiles
      );

      // ネガティブ（メイン）はそのままテンプレを安定展開
      const expandedMainNegative = mainNegativeTemplate
        ? promptGenerator.expandTemplateAndWildcardsUntilStable(
            mainNegativeTemplate,
            {},
            {},
            {},
            {},
            wildcardFiles
          )
        : '';

      // キャラネガティブは各キャラ分展開（selections/candidates は空だが、ワイルドカードは有効）
      const expandedCharNegatives: string[] = [];
      for (let i = 0; i < out.characterPrompts.length; i++) {
        const neg = characterNegativeTemplate
          ? promptGenerator.expandTemplateAndWildcardsUntilStable(
              characterNegativeTemplate,
              {},
              {},
              emptySelections[i] || {},
              emptyCandidates[i] || {},
              wildcardFiles
            )
          : '';
        expandedCharNegatives.push(neg);
      }

      // フォームへ反映（既存のcharactersをクリアして再構築）
      setValue('prompt', out.mainPrompt, { shouldFocus: false });
      setValue('negativePrompt', expandedMainNegative, { shouldFocus: false });

      for (let i = fields.length - 1; i >= 0; i--) {
        remove(i);
      }
      for (let i = 0; i < out.characterPrompts.length; i++) {
        append(
          {
            caption: out.characterPrompts[i],
            negativeCaption: expandedCharNegatives[i] || '',
            x: 0.5,
            y: 0.5
          },
          { shouldFocus: false }
        );
      }

      // プレビュー用に保存
      setGeneratedPrompt({
        mainPrompt: out.mainPrompt,
        characterPrompts: out.characterPrompts
      });
    } catch (e: any) {
      console.error(e);
      toast.error(`生成に失敗しました: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }, [state, wildcardFiles, setValue, fields.length, remove, append]);

  return {
    loading,
    generatedPrompt,
    handleGenerate
  };
};

export default usePromptGeneration;