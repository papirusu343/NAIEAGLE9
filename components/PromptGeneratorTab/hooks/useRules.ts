import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyRulesToWildcards } from '../../../lib/rules/engine';
import { Condition, Context, Effect, Rule } from '../../../types/rules';

const LS_KEY = 'prompt_rules_v1';

function nowIso() {
  return new Date().toISOString();
}

function loadFromLocalStorage(): Rule[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Rule[];
    return [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(rules: Rule[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rules));
  } catch {
    // ignore
  }
}

function genId() {
  // 簡易ID
  return 'r_' + Math.random().toString(36).slice(2, 10);
}

export function useRules() {
  const [rules, setRules] = useState<Rule[]>([]);

  useEffect(() => {
    const loaded = loadFromLocalStorage();
    setRules(loaded.sort((a, b) => a.priority - b.priority));
  }, []);

  useEffect(() => {
    saveToLocalStorage(rules);
  }, [rules]);

  const addRule = useCallback((partial: {
    name: string;
    description?: string;
    enabled?: boolean;
    condition?: Condition;
    effects?: Effect[];
  }) => {
    setRules((prev) => {
      const nextPriority = prev.length > 0 ? Math.max(...prev.map(r => r.priority)) + 10 : 10;
      const rule: Rule = {
        id: genId(),
        name: partial.name,
        description: partial.description,
        enabled: partial.enabled ?? true,
        priority: nextPriority,
        condition: partial.condition,
        effects: partial.effects ?? [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
        version: 1,
      };
      return [...prev, rule].sort((a, b) => a.priority - b.priority);
    });
  }, []);

  const updateRule = useCallback((id: string, patch: Partial<Omit<Rule, 'id'|'createdAt'|'version'>>) => {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, ...patch, updatedAt: nowIso() } : r)
      .sort((a, b) => a.priority - b.priority));
  }, []);

  const deleteRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const toggleEnable = useCallback((id: string) => {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled, updatedAt: nowIso() } : r));
  }, []);

  const reorder = useCallback((id: string, dir: 'up'|'down') => {
    setRules((prev) => {
      const sorted = [...prev].sort((a, b) => a.priority - b.priority);
      const idx = sorted.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      // priority を入れ替え
      const tmp = a.priority;
      a.priority = b.priority;
      b.priority = tmp;
      a.updatedAt = nowIso();
      b.updatedAt = nowIso();
      return sorted;
    });
  }, []);

  const clearAll = useCallback(() => {
    setRules([]);
  }, []);

  const importRules = useCallback((jsonText: string, strategy: 'replace'|'append' = 'append') => {
    try {
      const data = JSON.parse(jsonText);
      if (!Array.isArray(data)) return { ok: false, reason: 'JSONは配列（Rule[]）である必要があります' };
      const imported = data as Rule[];
      setRules((prev) => {
        if (strategy === 'replace') {
          return imported.sort((a, b) => a.priority - b.priority);
        }
        // append の場合、priority の衝突は末尾へ寄せる
        const maxP = prev.length > 0 ? Math.max(...prev.map(r => r.priority)) : 0;
        const appended = imported.map((r, i) => ({ ...r, priority: maxP + 10 * (i + 1), id: genId(), createdAt: nowIso(), updatedAt: nowIso() }));
        return [...prev, ...appended].sort((a, b) => a.priority - b.priority);
      });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, reason: e?.message || 'JSONの解析に失敗しました' };
    }
  }, []);

  const exportRules = useCallback(() => {
    return JSON.stringify(rules, null, 2);
  }, [rules]);

  const apply = useCallback((
    wildcardFiles: Record<string, string[]>,
    context: Context
  ) => {
    return applyRulesToWildcards(wildcardFiles, rules, context);
  }, [rules]);

  return {
    rules,
    addRule,
    updateRule,
    deleteRule,
    toggleEnable,
    reorder,
    clearAll,
    importRules,
    exportRules,
    apply,
  };
}