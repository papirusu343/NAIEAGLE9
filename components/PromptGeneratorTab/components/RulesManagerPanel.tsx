import React, { useMemo, useState } from 'react';
import { Condition, ConditionOp, Effect, Rule } from '../../../types/rules';

interface Props {
  rules: Rule[];
  addRule: (partial: { name: string; description?: string; enabled?: boolean; condition?: Condition; effects?: Effect[] }) => void;
  updateRule: (id: string, patch: Partial<Omit<Rule, 'id'|'createdAt'|'version'>>) => void;
  deleteRule: (id: string) => void;
  toggleEnable: (id: string) => void;
  reorder: (id: string, dir: 'up'|'down') => void;
  importRules: (jsonText: string, strategy?: 'replace'|'append') => { ok: boolean; reason?: string };
  exportRules: () => string;
  className?: string;
}

type EffectType = 'add'|'deny'|'adjust';

const opOptions: { value: ConditionOp; label: string }[] = [
  { value: 'eq',  label: '='  },
  { value: 'neq', label: '≠'  },
  { value: 'lt',  label: '<'  },
  { value: 'lte', label: '≤'  },
  { value: 'gt',  label: '>'  },
  { value: 'gte', label: '≥'  },
  { value: 'in',  label: 'in' },
  { value: 'nin', label: 'not in' },
];

export const RulesManagerPanel: React.FC<Props> = ({
  rules, addRule, updateRule, deleteRule, toggleEnable, reorder, importRules, exportRules, className
}) => {
  const [showEditor, setShowEditor] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftEnabled, setDraftEnabled] = useState(true);

  const [condKey, setCondKey] = useState('');
  const [condOp, setCondOp] = useState<ConditionOp>('eq');
  const [condValue, setCondValue] = useState('');

  const [effType, setEffType] = useState<EffectType>('deny');
  const [targetKey, setTargetKey] = useState('');
  const [itemsText, setItemsText] = useState(''); // カンマ区切り
  const [adjustMult, setAdjustMult] = useState<number>(0.5);

  const [importText, setImportText] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const buildEffects = (): Effect[] => {
    const items = itemsText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (!targetKey || items.length === 0) return [];

    if (effType === 'add') {
      return [{ type: 'add', targetKey, items }];
    }
    if (effType === 'deny') {
      return [{ type: 'deny', targetKey, ids: items }];
    }
    // adjust
    return [{ type: 'adjust', targetKey, items, mult: Number.isFinite(adjustMult) ? adjustMult : 1 }];
  };

  const handleCreate = () => {
    const effects = buildEffects();
    addRule({
      name: draftName || '(無題のルール)',
      description: draftDesc || undefined,
      enabled: draftEnabled,
      condition: condKey ? { key: condKey, op: condOp, value: parseValue(condValue, condOp) } : undefined,
      effects
    });
    // reset
    setShowEditor(false);
    setDraftName('');
    setDraftDesc('');
    setDraftEnabled(true);
    setCondKey('');
    setCondOp('eq');
    setCondValue('');
    setEffType('deny');
    setTargetKey('');
    setItemsText('');
    setAdjustMult(0.5);
  };

  const handleExport = () => {
    const json = exportRules();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rules.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (strategy: 'replace'|'append') => {
    const res = importRules(importText, strategy);
    if (!res.ok) {
      alert(res.reason || 'インポートに失敗しました');
    } else {
      setImportOpen(false);
      setImportText('');
    }
  };

  return (
    <div className={className}>
      <div className="rounded border border-gray-700 p-3 bg-gray-800/40 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-200">🧠 ルール管理</h4>
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
              onClick={() => setShowEditor((v) => !v)}
              title="新規ルールを追加"
            >
              + 追加
            </button>
            <button
              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded"
              onClick={handleExport}
              title="エクスポート"
            >
              ⭳ Export
            </button>
            <button
              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded"
              onClick={() => setImportOpen(true)}
              title="インポート"
            >
              ⭱ Import
            </button>
          </div>
        </div>

        {showEditor && (
          <div className="rounded border border-gray-700 p-3 bg-gray-900/50 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-300 mb-1">ルール名</label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="例: 自室→制服の確率を下げる"
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="text-xs text-gray-300">
                  <input
                    type="checkbox"
                    className="mr-1 align-middle"
                    checked={draftEnabled}
                    onChange={(e) => setDraftEnabled(e.target.checked)}
                  />
                  有効
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-300 mb-1">説明（任意）</label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  placeholder="このルールの目的をメモ"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-300 mb-1">条件キー</label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  value={condKey}
                  onChange={(e) => setCondKey(e.target.value)}
                  placeholder="例: situation"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">演算</label>
                <select
                  className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  value={condOp}
                  onChange={(e) => setCondOp(e.target.value as ConditionOp)}
                >
                  {opOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">条件値</label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  value={condValue}
                  onChange={(e) => setCondValue(e.target.value)}
                  placeholder='例: room（in/nin の場合は "a,b,c"）'
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
              <div>
                <label className="block text-xs text-gray-300 mb-1">効果タイプ</label>
                <select
                  className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  value={effType}
                  onChange={(e) => setEffType(e.target.value as EffectType)}
                >
                  <option value="deny">deny（除外）</option>
                  <option value="adjust">adjust（重み倍率）</option>
                  <option value="add">add（追加）</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">対象キー（wildcard名）</label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  value={targetKey}
                  onChange={(e) => setTargetKey(e.target.value)}
                  placeholder='例: outfit（__は不要）'
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-300 mb-1">アイテム（カンマ区切り）</label>
                <input
                  className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  value={itemsText}
                  onChange={(e) => setItemsText(e.target.value)}
                  placeholder="例: uniform,pajamas"
                />
              </div>
            </div>

            {effType === 'adjust' && (
              <div>
                <label className="block text-xs text-gray-300 mb-1">倍率（例: 0.5, 1.6）</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-40 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  value={adjustMult}
                  onChange={(e) => setAdjustMult(parseFloat(e.target.value))}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                className="px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded"
                onClick={() => setShowEditor(false)}
              >
                キャンセル
              </button>
              <button
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded"
                onClick={handleCreate}
              >
                追加する
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {rules.length === 0 && (
            <div className="text-xs text-gray-400">ルールはまだありません。「+ 追加」から作成してください。</div>
          )}
          {rules
            .slice()
            .sort((a, b) => a.priority - b.priority)
            .map((r, idx) => (
            <div key={r.id} className="rounded border border-gray-700 bg-gray-900/40 p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50"
                    onClick={() => reorder(r.id, 'up')}
                    disabled={idx === 0}
                    title="上へ"
                  >
                    ↑
                  </button>
                  <button
                    className="px-2 py-0.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50"
                    onClick={() => reorder(r.id, 'down')}
                    disabled={idx === rules.length - 1}
                    title="下へ"
                  >
                    ↓
                  </button>
                  <label className="text-xs text-gray-300">
                    <input
                      type="checkbox"
                      className="mr-1 align-middle"
                      checked={r.enabled}
                      onChange={() => toggleEnable(r.id)}
                    />
                    有効
                  </label>
                  <div className="text-sm text-gray-100 font-medium">{r.name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-2 py-0.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                    onClick={() => {
                      if (confirm('このルールを削除しますか？')) deleteRule(r.id);
                    }}
                  >
                    削除
                  </button>
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {r.description || '（説明なし）'}
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-gray-800 p-2 border border-gray-700">
                  <div className="text-gray-300 mb-1">条件</div>
                  <div className="text-gray-400">
                    {r.condition
                      ? `${r.condition.key} ${opOptions.find(o => o.value === r.condition!.op)?.label ?? r.condition.op} ${formatCondValue(r.condition)}`
                      : '（常時）'}
                  </div>
                </div>
                <div className="rounded bg-gray-800 p-2 border border-gray-700">
                  <div className="text-gray-300 mb-1">効果</div>
                  <div className="space-y-1">
                    {r.effects.map((e, i) => (
                      <div key={i} className="text-gray-400">
                        {e.type === 'add' && `add → ${e.targetKey}: [${e.items.join(', ')}]`}
                        {e.type === 'deny' && `deny → ${e.targetKey}: [${e.ids.join(', ')}]`}
                        {e.type === 'adjust' && `adjust → ${e.targetKey}: [${e.items.join(', ')}], mult=${e.mult}`}
                      </div>
                    ))}
                    {r.effects.length === 0 && <div className="text-gray-500">（効果なし）</div>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {importOpen && (
          <div className="rounded border border-gray-700 p-3 bg-gray-900/60 space-y-2">
            <div className="text-sm text-gray-200">インポート</div>
            <textarea
              className="w-full h-40 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='Rule[] の JSON を貼り付け'
            />
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded"
                onClick={() => setImportOpen(false)}
              >
                閉じる
              </button>
              <button
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
                onClick={() => handleImport('append')}
              >
                追記インポート
              </button>
              <button
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
                onClick={() => handleImport('replace')}
              >
                置き換え
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function parseValue(v: string, op: ConditionOp) {
  if (op === 'in' || op === 'nin') {
    return v.split(',').map(s => s.trim()).filter(Boolean);
  }
  // 数値に見えたら数値に
  if (/^-?\d+(\.\d+)?$/.test(v)) {
    return Number(v);
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

function formatCondValue(cond: Condition) {
  const v = cond.value as any;
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  return String(v);
}