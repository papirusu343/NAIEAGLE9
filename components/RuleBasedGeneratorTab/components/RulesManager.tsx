import React, { useEffect, useMemo, useState } from 'react';

type ScopeMode = 'auto' | 'group' | 'member';
type MergePolicy = 'consensus' | 'majority';

type RuleCondition = {
  member?: {
    tags_any?: string[];
    tags_all?: string[];
  };
  slot?: Record<string, string>;
  series_any?: string[];
  series_all?: string[];
};

type ForbidRule = {
  if?: RuleCondition;
  slot: string;
  values?: string[];
  by_option_tags_any?: string[];
  by_option_tags_all?: string[];
};

type OverrideRule = {
  priority: number;
  lock?: boolean;
  if?: RuleCondition;
  set?: Record<string, string>;
  prefer_option_tags?: Record<string, string[]>;
  restrict_option_tags?: Record<string, string[]>;
  set_from_option_tags?: Record<string, string[]>;
};

type DefaultsConfig = {
  strategy: 'random_from_all';
  targets: string[];
};

type RulesConfig = {
  version: number;
  scopes: Record<string, ScopeMode>;
  mergePolicy?: {
    default: MergePolicy;
    overrides?: Record<string, MergePolicy>;
  };
  engineSettings?: {
    preferBoost?: number;
  };
  forbids?: ForbidRule[];
  overrides?: OverrideRule[];
  defaults?: DefaultsConfig;
};

type OptionCatalog = {
  version: number;
  slots: Record<string, { options: Array<{ value: string; tags?: string[]; weight?: number }> }>;
};

const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const RulesManager: React.FC = () => {
  const [rules, setRules] = useState<RulesConfig | null>(null);
  const [catalog, setCatalog] = useState<OptionCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scopes' | 'forbids' | 'overrides' | 'defaults' | 'raw'>('scopes');
  const [rawJson, setRawJson] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [rRes, cRes] = await Promise.all([fetch('/api/rules'), fetch('/api/option-catalog')]);
        if (!rRes.ok) throw new Error(`rules HTTP ${rRes.status}`);
        if (!cRes.ok) throw new Error(`catalog HTTP ${cRes.status}`);
        const rData = (await rRes.json()) as RulesConfig;
        const cData = (await cRes.json()) as OptionCatalog;
        if (mounted) {
          setRules(rData);
          setCatalog(cData);
          setRawJson(JSON.stringify(rData, null, 2));
        }
      } catch (e: any) {
        setError(`ルール/カタログの読み込みに失敗しました: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const slotNames = useMemo(() => (catalog ? Object.keys(catalog.slots || {}) : []), [catalog]);

  const setScope = (slot: string, scope: ScopeMode) => {
    if (!rules) return;
    setRules({
      ...rules,
      scopes: { ...(rules.scopes || {}), [slot]: scope },
    });
  };

  const setMergeDefault = (policy: MergePolicy) => {
    if (!rules) return;
    setRules({
      ...rules,
      mergePolicy: { ...(rules.mergePolicy || {}), default: policy },
    });
  };

  const addForbid = () => {
    if (!rules) return;
    const next = deepClone(rules);
    next.forbids = next.forbids || [];
    next.forbids.push({
      slot: 'clothes',
      by_option_tags_any: [],
      values: [],
      if: { member: { tags_any: [] } },
    });
    setRules(next);
  };

  const updateForbid = (idx: number, patch: Partial<ForbidRule>) => {
    if (!rules?.forbids) return;
    const next = deepClone(rules);
    next.forbids![idx] = { ...next.forbids![idx], ...patch };
    setRules(next);
  };

  const removeForbid = (idx: number) => {
    if (!rules?.forbids) return;
    const next = deepClone(rules);
    next.forbids!.splice(idx, 1);
    setRules(next);
  };

  const addOverride = () => {
    if (!rules) return;
    const next = deepClone(rules);
    next.overrides = next.overrides || [];
    next.overrides.push({
      priority: 10,
      lock: false,
      if: { member: { tags_any: [] } },
      set: {},
    });
    setRules(next);
  };

  const updateOverride = (idx: number, patch: Partial<OverrideRule>) => {
    if (!rules?.overrides) return;
    const next = deepClone(rules);
    next.overrides![idx] = { ...next.overrides![idx], ...patch };
    setRules(next);
  };

  const removeOverride = (idx: number) => {
    if (!rules?.overrides) return;
    const next = deepClone(rules);
    next.overrides!.splice(idx, 1);
    setRules(next);
  };

  const updateDefaultsTargets = (slot: string) => {
    if (!rules) return;
    const next = deepClone(rules);
    next.defaults = next.defaults || { strategy: 'random_from_all', targets: [] };
    const arr = new Set(next.defaults.targets || []);
    if (arr.has(slot)) arr.delete(slot);
    else arr.add(slot);
    next.defaults.targets = Array.from(arr);
    setRules(next);
  };

  const parseCsv = (s?: string[]) => (Array.isArray(s) ? s.join(', ') : '');
  const toArray = (s: string) =>
    s
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

  const saveRules = async () => {
    if (!rules) return;
    try {
      setSaving(true);
      const normalized = deepClone(rules);
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRawJson(JSON.stringify(normalized, null, 2));
      setError(null);
    } catch (e: any) {
      setError(`保存に失敗しました: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const applyRawJson = () => {
    try {
      const json = JSON.parse(rawJson);
      if (!json || typeof json !== 'object' || !json.scopes) {
        throw new Error('不正なフォーマットです（scopes が見つかりません）');
      }
      setRules(json);
      setError(null);
    } catch (e: any) {
      setError(`RAW 反映に失敗しました: ${e.message}`);
    }
  };

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
        <h4 className="text-lg font-semibold text-gray-100">Rules 管理</h4>
        <div className="flex flex-wrap items-center gap-2">
          <button className={`btn ${activeTab === 'scopes' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('scopes')}>Scopes</button>
          <button className={`btn ${activeTab === 'forbids' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('forbids')}>Forbids</button>
          <button className={`btn ${activeTab === 'overrides' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('overrides')}>Overrides</button>
          <button className={`btn ${activeTab === 'defaults' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('defaults')}>Defaults</button>
          <button className={`btn ${activeTab === 'raw' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('raw')}>RAW</button>
          <button className="btn-primary" onClick={saveRules} disabled={saving || !rules}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {error && <div className="text-red-400 text-sm mb-2">{error}</div>}
      {loading && <div className="text-gray-400 text-sm">読み込み中...</div>}

      {!loading && rules && activeTab === 'scopes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">mergePolicy.default</label>
              <select
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                value={rules.mergePolicy?.default || 'consensus'}
                onChange={(e) => setMergeDefault(e.target.value as MergePolicy)}
              >
                <option value="consensus">consensus（全員一致で揃える）</option>
                <option value="majority">majority（多数決）</option>
              </select>
            </div>
            <div className="text-xs text-gray-400">
              スロットの初期スコープはすべて auto です。ここではデフォルトの統合ポリシーを選べます（per-slot の上書きは将来追加予定）。
            </div>
          </div>
          <div className="space-y-2">
            {slotNames.map((slot) => (
              <div key={slot} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <div className="text-sm text-gray-200 break-words">{slot}</div>
                <div className="sm:col-span-2">
                  <select
                    className="w-full sm:w-48 px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={(rules.scopes?.[slot] as ScopeMode) || 'auto'}
                    onChange={(e) => setScope(slot, e.target.value as ScopeMode)}
                  >
                    <option value="auto">auto</option>
                    <option value="group">group（全員で揃える）</option>
                    <option value="member">member（個別）</option>
                  </select>
                </div>
              </div>
            ))}
            {slotNames.length === 0 && <div className="text-xs text-gray-400">OptionCatalog にスロットがありません。</div>}
          </div>
        </div>
      )}

      {!loading && rules && activeTab === 'forbids' && (
        <div className="space-y-3">
          <button className="btn" onClick={addForbid}>禁止ルールを追加</button>
          {(rules.forbids || []).map((fr, idx) => (
            <div key={idx} className="border border-gray-700 rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-gray-200">Forbid #{idx + 1}</div>
                <button className="btn-danger" onClick={() => removeForbid(idx)}>削除</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-3">
                  <label className="block text-xs text-gray-400 mb-1">slot</label>
                  <select
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={fr.slot}
                    onChange={(e) => updateForbid(idx, { slot: e.target.value })}
                  >
                    {slotNames.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-9">
                  <label className="block text-xs text-gray-400 mb-1">values（禁止する明示値：カンマ区切り）</label>
                  <input
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={parseCsv(fr.values)}
                    onChange={(e) => updateForbid(idx, { values: toArray(e.target.value) })}
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs text-gray-400 mb-1">by_option_tags_any（候補側タグ：いずれか一致で禁止）</label>
                  <input
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={parseCsv(fr.by_option_tags_any)}
                    onChange={(e) => updateForbid(idx, { by_option_tags_any: toArray(e.target.value) })}
                  />
                </div>
                <div className="sm:col-span-6">
                  <label className="block text-xs text-gray-400 mb-1">by_option_tags_all（候補側タグ：すべて一致で禁止）</label>
                  <input
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={parseCsv(fr.by_option_tags_all)}
                    onChange={(e) => updateForbid(idx, { by_option_tags_all: toArray(e.target.value) })}
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs text-gray-400 mb-1">if.member.tags_any</label>
                  <input
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={parseCsv(fr.if?.member?.tags_any)}
                    onChange={(e) =>
                      updateForbid(idx, {
                        if: {
                          ...(fr.if || {}),
                          member: { ...(fr.if?.member || {}), tags_any: toArray(e.target.value) },
                        },
                      })
                    }
                  />
                </div>
                <div className="sm:col-span-6">
                  <label className="block text-xs text-gray-400 mb-1">if.member.tags_all</label>
                  <input
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={parseCsv(fr.if?.member?.tags_all)}
                    onChange={(e) =>
                      updateForbid(idx, {
                        if: {
                          ...(fr.if || {}),
                          member: { ...(fr.if?.member || {}), tags_all: toArray(e.target.value) },
                        },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
          {(rules.forbids || []).length === 0 && <div className="text-xs text-gray-400">禁止ルールはありません。「禁止ルールを追加」で作成できます。</div>}
        </div>
      )}

      {!loading && rules && activeTab === 'overrides' && (
        <div className="space-y-3">
          <button className="btn" onClick={addOverride}>オーバーライドを追加</button>
          {(rules.overrides || []).map((ov, idx) => (
            <div key={idx} className="border border-gray-700 rounded-md p-3 overflow-x-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-gray-200">Override #{idx + 1}</div>
                <button className="btn-danger" onClick={() => removeOverride(idx)}>削除</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 min-w-[700px] sm:min-w-0">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">priority</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={ov.priority}
                    onChange={(e) => updateOverride(idx, { priority: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">lock</label>
                  <select
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={ov.lock ? 'true' : 'false'}
                    onChange={(e) => updateOverride(idx, { lock: e.target.value === 'true' })}
                  >
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs text-gray-400 mb-1">if.member.tags_any</label>
                  <input
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={parseCsv(ov.if?.member?.tags_any)}
                    onChange={(e) =>
                      updateOverride(idx, {
                        if: { ...(ov.if || {}), member: { ...(ov.if?.member || {}), tags_any: toArray(e.target.value) } },
                      })
                    }
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs text-gray-400 mb-1">if.member.tags_all</label>
                  <input
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={parseCsv(ov.if?.member?.tags_all)}
                    onChange={(e) =>
                      updateOverride(idx, {
                        if: { ...(ov.if || {}), member: { ...(ov.if?.member || {}), tags_all: toArray(e.target.value) } },
                      })
                    }
                  />
                </div>

                <div className="sm:col-span-12">
                  <label className="block text-xs text-gray-400 mb-1">if.slot（JSON: {`{ "slotName": "value", ... }`}）</label>
                  <textarea
                    className="w-full min-h-[72px] px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={JSON.stringify(ov.if?.slot || {})}
                    onChange={(e) => {
                      try {
                        const obj = JSON.parse(e.target.value || '{}');
                        updateOverride(idx, { if: { ...(ov.if || {}), slot: obj } });
                      } catch {
                        // ユーザー入力途中のJSONは無視
                      }
                    }}
                  />
                </div>

                <div className="sm:col-span-12">
                  <label className="block text-xs text-gray-400 mb-1">set（JSON: {`{ "slot": "value", ... }`}）</label>
                  <textarea
                    className="w-full min-h-[72px] px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={JSON.stringify(ov.set || {})}
                    onChange={(e) => {
                      try {
                        const obj = JSON.parse(e.target.value || '{}');
                        updateOverride(idx, { set: obj });
                      } catch {}
                    }}
                  />
                </div>

                <div className="sm:col-span-12">
                  <label className="block text-xs text-gray-400 mb-1">prefer_option_tags（JSON: {`{ "slot": ["tag", ...], ... }`}）</label>
                  <textarea
                    className="w-full min-h-[72px] px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={JSON.stringify(ov.prefer_option_tags || {})}
                    onChange={(e) => {
                      try {
                        const obj = JSON.parse(e.target.value || '{}');
                        updateOverride(idx, { prefer_option_tags: obj });
                      } catch {}
                    }}
                  />
                </div>

                <div className="sm:col-span-12">
                  <label className="block text-xs text-gray-400 mb-1">restrict_option_tags（JSON: {`{ "slot": ["tag", ...], ... }`}）</label>
                  <textarea
                    className="w-full min-h-[72px] px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={JSON.stringify(ov.restrict_option_tags || {})}
                    onChange={(e) => {
                      try {
                        const obj = JSON.parse(e.target.value || '{}');
                        updateOverride(idx, { restrict_option_tags: obj });
                      } catch {}
                    }}
                  />
                </div>

                <div className="sm:col-span-12">
                  <label className="block text-xs text-gray-400 mb-1">set_from_option_tags（JSON: {`{ "slot": ["tag", ...], ... }`}）</label>
                  <textarea
                    className="w-full min-h-[72px] px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                    value={JSON.stringify(ov.set_from_option_tags || {})}
                    onChange={(e) => {
                      try {
                        const obj = JSON.parse(e.target.value || '{}');
                        updateOverride(idx, { set_from_option_tags: obj });
                      } catch {}
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
          {(rules.overrides || []).length === 0 && <div className="text-xs text-gray-400">オーバーライドはありません。「オーバーライドを追加」で作成できます。</div>}
        </div>
      )}

      {!loading && rules && activeTab === 'defaults' && (
        <div className="space-y-3">
          <div className="text-xs text-gray-400">
            defaults は「無定義のときのみ」全候補からランダム補完します。forbids 等で候補0件になった場合は補完しません。
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {slotNames.map((slot) => (
              <label key={slot} className="inline-flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={!!rules.defaults?.targets?.includes(slot)}
                  onChange={() => updateDefaultsTargets(slot)}
                />
                <span className="text-sm text-gray-200">{slot}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {!loading && rules && activeTab === 'raw' && (
        <div className="space-y-2">
          <div className="text-xs text-gray-400">
            上級者向け：ルールJSONを直接編集できます。保存前に「RAWを反映」で上のフォームに展開します。
          </div>
          <textarea
            className="w-full h-64 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white font-mono text-sm"
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn" onClick={applyRawJson}>RAW を反映</button>
            <button className="btn-primary" onClick={saveRules} disabled={saving || !rules}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};