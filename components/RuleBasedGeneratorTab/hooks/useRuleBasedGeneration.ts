import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { PromptGeneratorState } from '../../PromptGeneratorTab/types';
import { promptGenerator } from '../../../utils/promptGenerator';
import { applyRules, type RuleTrace } from '../../../utils/rulesEngine';

const LS_KEYS = {
  PREFER_BOOST: 'rb-engine-preferBoost',
  DEFAULTS_TARGETS: 'rb-engine-defaultsTargets',
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

export const useRuleBasedGeneration = (
  state: PromptGeneratorState,
  setValue: any,
  fields: any[],
  remove: any,
  append: any,
  mainTemplate: string,
  charTemplate: string,
  negativeTemplate: string,
  characterNegativeTemplate: string,
  singleCharacterMode: boolean
) => {
  const [loading, setLoading] = useState(false);
  const [generatedMain, setGeneratedMain] = useState<string>('');
  const [generatedChars, setGeneratedChars] = useState<string[]>([]);
  const [ruleTrace, setRuleTrace] = useState<RuleTrace[] | null>(null);

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

  const handleGenerate = useCallback(async () => {
    try {
      setLoading(true);

      // GUI設定の読み込み
      const { preferBoost, defaultsTargets } = readGuiOverrides();

      // 1) メンバー割り当て
      let assignedMembers: string[] | null = null;

      if (singleCharacterMode) {
        // 単体キャラ: カタログからランダムに1人
        const catalog = (state as any).characterCatalog?.characters ?? [];
        const ids: string[] = Array.isArray(catalog) ? catalog.map((c: any) => String(c?.id || '').trim()).filter(Boolean) : [];
        if (ids.length === 0) {
          toast.error('キャラクターカタログに有効なIDがありません。');
          throw new Error('Empty character catalog');
        }
        const idx = (Math.random() * ids.length) | 0;
        assignedMembers = [ids[idx]];
      } else {
        // 通常: グループ＋振る舞い設定
        const groupConfig = (state as any).groupConfig as { groups?: { id: string; members: string[]; weight?: number }[] };
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
      const partySize = singleCharacterMode
        ? 1
        : assignedMembers?.length ?? (behavior?.partySizeMode === 'fixed' && behavior.fixedPartySize ? Math.max(1, behavior.fixedPartySize) : 2);

      const emptySelections = Array.from({ length: partySize }, () => ({} as Record<string, string>));
      const emptyCandidates = Array.from({ length: partySize }, () => ({} as Record<string, string[]>));

      // 3) ルール適用（GUI設定を ruleConfig にマージ）
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

      // 3.5) [group_unique:name] に name_prompt（未設定は空文字）
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

      // 3.6) [series] 集約（ユニーク→", "結合）
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

      // 4) テンプレの [series] 事前置換
      const processedMainTemplate = (mainTemplate || '').split('[series]').join(seriesValue);
      const processedCharTemplate = (charTemplate || '').split('[series]').join(seriesValue);

      // 5) 展開
      const wildcardFiles = new Map<string, string[]>();
      const out = promptGenerator.generatePromptFromSelections(
        processedMainTemplate,
        processedCharTemplate,
        {}, // [series] は事前置換済み
        {},
        enhancedSelections,
        rulesResult.characterCandidatesList,
        wildcardFiles
      );

      // 6) フォーム反映
      setValue('prompt', out.mainPrompt, { shouldFocus: false });
      setValue('negativePrompt', negativeTemplate || '', { shouldFocus: false });

      const currentLength = fields.length;
      for (let i = currentLength - 1; i >= 0; i--) {
        remove(i);
      }

      for (let i = 0; i < out.characterPrompts.length; i++) {
        // キャラネガにも [series] を事前適用
        const processedCharacterNegativeTemplate = (characterNegativeTemplate || '').split('[series]').join(seriesValue);

        let characterNegativeCaption = '';
        if (processedCharacterNegativeTemplate && processedCharacterNegativeTemplate.trim()) {
          characterNegativeCaption = promptGenerator.expandTemplateAndWildcardsUntilStable(
            processedCharacterNegativeTemplate,
            {}, // [series] は事前置換済み
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

      setGeneratedMain(out.mainPrompt);
      setGeneratedChars(out.characterPrompts);
    } catch (e: any) {
      console.error(e);
      if (e?.message !== 'Empty character catalog') {
        toast.error(`生成に失敗しました: ${e.message || e}`);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, setValue, fields.length, remove, append, mainTemplate, charTemplate, negativeTemplate, characterNegativeTemplate, singleCharacterMode]);

  return {
    loading,
    generatedMain,
    generatedChars,
    ruleTrace,
    handleGenerate
  };
};