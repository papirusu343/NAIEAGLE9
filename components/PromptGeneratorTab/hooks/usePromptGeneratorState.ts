import { useState, useEffect, useRef } from 'react';
import { PromptGeneratorState, Group, GroupConfig } from '../types';

const K = {
  SELECTED_TEMPLATE: 'prompt-generator-selected-template',
  MAIN_PROMPT_TEMPLATE: 'prompt-generator-main-prompt-template',
  CHARACTER_PROMPT_TEMPLATE: 'prompt-generator-character-prompt-template',
  MAIN_NEGATIVE_PROMPT_TEMPLATE: 'prompt-generator-main-negative-prompt-template',
  CHARACTER_NEGATIVE_PROMPT_TEMPLATE: 'prompt-generator-character-negative-prompt-template',
  GROUP_CONFIG: 'prompt-generator-group-config',
  GENERATION_BEHAVIOR: 'prompt-generator-generation-behavior',
  CHARACTER_CATALOG: 'prompt-generator-character-catalog',
  RULE_CONFIG: 'prompt-generator-rule-config'
} as const;

function safeParseJSON<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try { return JSON.parse(text) as T; } catch { return fallback; }
}

// 自動ID生成（時刻+短ランダム）
function genGroupId(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const M = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  const rand = Math.random().toString(16).slice(2, 6);
  return `grp-${y}${M}${d}-${h}${m}${s}-${rand}`;
}

// 読み込み時正規化: ID 付与、label 破棄、members/tags を配列に正規化
function normalizeGroups(input: GroupConfig): GroupConfig {
  const seen = new Set<string>();
  const groups: Group[] = (input?.groups ?? []).map((g: any) => {
    let id = String(g?.id || '').trim();
    if (!id) id = genGroupId();
    // 重複回避: 衝突時は振り直し
    while (seen.has(id)) id = genGroupId();
    seen.add(id);

    // members 正規化
    let members: string[] = [];
    if (Array.isArray(g?.members)) {
      members = g.members.map((x: any) => String(x)).filter(Boolean);
    } else if (typeof g?.members === 'string') {
      members = String(g.members).split(',').map(s => s.trim()).filter(Boolean);
    }

    // tags 正規化
    let tags: string[] | undefined = undefined;
    if (Array.isArray(g?.tags)) {
      const arr = g.tags.map((x: any) => String(x).trim()).filter(Boolean);
      tags = arr.length > 0 ? arr : undefined;
    } else if (typeof g?.tags === 'string') {
      const arr = String(g.tags).split(',').map(s => s.trim()).filter(Boolean);
      tags = arr.length > 0 ? arr : undefined;
    }

    const weight = typeof g?.weight === 'number' ? g.weight : undefined;

    const normalized: Group = {
      id,
      members,
      weight,
      ...(tags ? { tags } : {})
      // label は保持しない（破棄）
    };
    return normalized;
  });

  return { groups };
}

// 保存前に label を完全に落としてクリーンにする
function sanitizeGroupsForSave(cfg: GroupConfig): GroupConfig {
  return {
    groups: (cfg.groups ?? []).map(g => ({
      id: g.id,
      members: Array.isArray(g.members) ? g.members.slice() : [],
      ...(typeof g.weight === 'number' ? { weight: g.weight } : {}),
      ...(Array.isArray(g.tags) && g.tags.length > 0 ? { tags: g.tags.slice() } : {})
    }))
  };
}

// localStorage 初期ロード（テンプレはここで確実に復元）
function loadInitialStateFromLocalStorage(): PromptGeneratorState {
  if (typeof window === 'undefined') {
    return {
      selectedTemplate: '',
      mainPromptTemplate: '2girls, masterpiece, [common:location]',
      characterPromptTemplate: '1girl, [group_unique:name]',
      mainNegativePromptTemplate: '',
      characterNegativePromptTemplate: '',
      groupConfig: { groups: [] },
      generationBehavior: {
        generationOrder: 'unordered',
        roleAssignment: 'shuffleAll',
        partySizeMode: 'auto',
        fixedPartySize: 2
      },
      characterCatalog: { characters: [] },
      ruleConfig: { slotRules: [], linkRules: [] }
    };
  }

  const selectedTemplate = localStorage.getItem(K.SELECTED_TEMPLATE) || '';
  const mainPromptTemplate = localStorage.getItem(K.MAIN_PROMPT_TEMPLATE) || '2girls, masterpiece, [common:location]';
  const characterPromptTemplate = localStorage.getItem(K.CHARACTER_PROMPT_TEMPLATE) || '1girl, [group_unique:name]';
  const mainNegativePromptTemplate = localStorage.getItem(K.MAIN_NEGATIVE_PROMPT_TEMPLATE) || '';
  const characterNegativePromptTemplate = localStorage.getItem(K.CHARACTER_NEGATIVE_PROMPT_TEMPLATE) || '';

  const rawGroups = safeParseJSON<GroupConfig>(localStorage.getItem(K.GROUP_CONFIG), { groups: [] });
  const groupConfig = normalizeGroups(rawGroups);

  const generationBehavior = safeParseJSON(
    K.GENERATION_BEHAVIOR in localStorage ? localStorage.getItem(K.GENERATION_BEHAVIOR) : null,
    {
      generationOrder: 'unordered',
      roleAssignment: 'shuffleAll',
      partySizeMode: 'auto',
      fixedPartySize: 2
    }
  );

  const characterCatalog = safeParseJSON(localStorage.getItem(K.CHARACTER_CATALOG), { characters: [] as any[] });
  const ruleConfig = safeParseJSON(localStorage.getItem(K.RULE_CONFIG), { slotRules: [] as any[], linkRules: [] as any[] });

  return {
    selectedTemplate,
    mainPromptTemplate,
    characterPromptTemplate,
    mainNegativePromptTemplate,
    characterNegativePromptTemplate,
    groupConfig,
    generationBehavior,
    characterCatalog,
    ruleConfig
  };
}

export const usePromptGeneratorState = () => {
  const [state, setState] = useState<PromptGeneratorState>(loadInitialStateFromLocalStorage);
  const [isClient, setIsClient] = useState(false);

  // デバウンス（サーバー同期はカタログ/ルール/グループのみ）
  const saveCatalogTimer = useRef<number | null>(null);
  const saveRuleTimer = useRef<number | null>(null);
  const saveGroupsTimer = useRef<number | null>(null);

  // サーバーから「カタログ/ルール/グループ」を取得（あれば優先）
  const hydrateFromServer = async () => {
    try {
      const [catalogResp, rulesResp, groupsResp] = await Promise.allSettled([
        fetch('/api/catalog'),
        fetch('/api/rules'),
        fetch('/api/groups')
      ]);

      let serverCatalog: any = null;
      let serverRules: any = null;
      let serverGroups: GroupConfig | null = null;

      if (catalogResp.status === 'fulfilled' && catalogResp.value.ok) {
        try {
          serverCatalog = await catalogResp.value.json();
        } catch {
          serverCatalog = null;
        }
      }
      if (rulesResp.status === 'fulfilled' && rulesResp.value.ok) {
        try {
          serverRules = await rulesResp.value.json();
        } catch {
          serverRules = null;
        }
      }
      if (groupsResp.status === 'fulfilled' && groupsResp.value.ok) {
        try {
          serverGroups = normalizeGroups(await groupsResp.value.json());
        } catch {
          serverGroups = null;
        }
      }

      setState(prev => ({
        ...prev,
        // テンプレ入力欄はサーバーと同期しない
        characterCatalog: serverCatalog && Array.isArray(serverCatalog.characters) ? serverCatalog : prev.characterCatalog,
        ruleConfig: serverRules && typeof serverRules === 'object' ? serverRules : prev.ruleConfig,
        groupConfig: serverGroups && Array.isArray(serverGroups.groups) ? serverGroups : prev.groupConfig
      }));
    } catch (e) {
      console.warn('Server hydrate skipped:', e);
    }
  };

  useEffect(() => {
    setIsClient(true);
    hydrateFromServer();
  }, []);

  // 状態変更の保存（localStorage + サーバー（対象のみ））
  useEffect(() => {
    if (!isClient) return;

    // グループは毎回正規化してから保存
    const normalizedGroups = normalizeGroups(state.groupConfig);

    try {
      // テンプレ（ローカルのみ）
      localStorage.setItem(K.SELECTED_TEMPLATE, state.selectedTemplate);
      localStorage.setItem(K.MAIN_PROMPT_TEMPLATE, state.mainPromptTemplate);
      localStorage.setItem(K.CHARACTER_PROMPT_TEMPLATE, state.characterPromptTemplate);
      localStorage.setItem(K.MAIN_NEGATIVE_PROMPT_TEMPLATE, state.mainNegativePromptTemplate);
      localStorage.setItem(K.CHARACTER_NEGATIVE_PROMPT_TEMPLATE, state.characterNegativePromptTemplate);

      // 設定（ローカル）
      localStorage.setItem(K.GROUP_CONFIG, JSON.stringify(sanitizeGroupsForSave(normalizedGroups)));
      localStorage.setItem(K.GENERATION_BEHAVIOR, JSON.stringify(state.generationBehavior));
      localStorage.setItem(K.CHARACTER_CATALOG, JSON.stringify(state.characterCatalog));
      localStorage.setItem(K.RULE_CONFIG, JSON.stringify(state.ruleConfig));
    } catch (e) {
      console.warn('Failed to save state to localStorage:', e);
    }

    // サーバー同期（カタログ/ルール/グループのみ）
    try {
      if (saveCatalogTimer.current) window.clearTimeout(saveCatalogTimer.current);
      saveCatalogTimer.current = window.setTimeout(async () => {
        try {
          await fetch('/api/catalog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.characterCatalog)
          });
        } catch (e) {
          console.warn('Failed to save catalog to server:', e);
        }
      }, 800);

      if (saveRuleTimer.current) window.clearTimeout(saveRuleTimer.current);
      saveRuleTimer.current = window.setTimeout(async () => {
        try {
          await fetch('/api/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.ruleConfig)
          });
        } catch (e) {
          console.warn('Failed to save rules to server:', e);
        }
      }, 800);

      if (saveGroupsTimer.current) window.clearTimeout(saveGroupsTimer.current);
      saveGroupsTimer.current = window.setTimeout(async () => {
        try {
          await fetch('/api/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sanitizeGroupsForSave(normalizedGroups))
          });
        } catch (e) {
          console.warn('Failed to save groups to server:', e);
        }
      }, 800);
    } catch (e) {
      console.warn('Server sync skipped:', e);
    }
  }, [state, isClient]);

  const updateState = (patch: Partial<PromptGeneratorState>) => {
    setState(prev => {
      // groupConfig を更新する場合は正規化して反映（ID 自動付与/label除去/tags 正規化）
      const next: PromptGeneratorState = { ...prev, ...patch };
      if (patch.groupConfig) {
        next.groupConfig = normalizeGroups(patch.groupConfig);
      }
      return next;
    });
  };

  return { state, updateState, isClient };
}