import React from 'react';
import { RuleConfig, SlotRule, LinkRule, GroupConfig, CharacterCatalog } from '../../types';

interface Props {
  value: RuleConfig;
  onChange: (v: RuleConfig) => void;
  groupConfig: GroupConfig;
  characterCatalog: CharacterCatalog;
}

export const RulesManager: React.FC<Props> = ({ value, onChange }) => {
  const slotRules = value?.slotRules ?? [];
  const linkRules = value?.linkRules ?? [];

  const addSlotRule = () => {
    const next: SlotRule = {
      when: {},
      then: []
    };
    onChange({ ...value, slotRules: [...slotRules, next] });
  };

  const removeSlotRule = (idx: number) => {
    const next = slotRules.slice();
    next.splice(idx, 1);
    onChange({ ...value, slotRules: next });
  };

  const updateSlotRule = (idx: number, patch: Partial<SlotRule>) => {
    const next = slotRules.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...value, slotRules: next });
  };

  const addLinkRule = (preset: 'tie' | 'restrict' | 'cond') => {
    let rule: LinkRule;
    if (preset === 'tie') {
      rule = { type: 'tie', tie: 'same', slot: 'bodyType', who: ['A','B'] } as LinkRule;
    } else if (preset === 'restrict') {
      rule = { type: 'link', action: 'restrictToValue', who: 'B', slot: 'bodyType', valueFrom: { who: 'A', slot: 'bodyType' } } as LinkRule;
    } else {
      rule = { type: 'link', action: 'conditionalWeight', if: { 'A.bodyType': 'leg_focus' }, then: [{ who: 'B', slot: 'bodyType', target: { id: 'upper_focus' }, factor: 2.0 }] } as LinkRule;
    }
    onChange({ ...value, linkRules: [...linkRules, rule] });
  };

  const removeLinkRule = (idx: number) => {
    const next = linkRules.slice();
    next.splice(idx, 1);
    onChange({ ...value, linkRules: next });
  };

  return (
    <div className="space-y-6">
      {/* Slot Rules */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-base font-semibold text-gray-200">スロットルール（add/forbid/weight/restrictToGroup）</h5>
          <button
            onClick={addSlotRule}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
          >
            + ルールを追加
          </button>
        </div>

        {slotRules.length === 0 && (
          <div className="text-sm text-gray-400">スロットルールはありません。</div>
        )}

        <div className="space-y-3">
          {slotRules.map((rule, idx) => (
            <div key={idx} className="p-3 rounded border border-gray-700 bg-gray-800/50">
              <div className="text-sm text-gray-300 mb-2">when 条件（JSON 直編集雛形）</div>
              <textarea
                className="w-full px-2 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                rows={3}
                value={JSON.stringify(rule.when ?? {}, null, 2)}
                onChange={(e) => {
                  try {
                    const obj = JSON.parse(e.target.value);
                    updateSlotRule(idx, { when: obj });
                  } catch {
                    // 編集途中は無視
                  }
                }}
              />
              <div className="text-sm text-gray-300 mt-3">then アクション配列（JSON 直編集雛形）</div>
              <textarea
                className="w-full px-2 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                rows={4}
                value={JSON.stringify(rule.then ?? [], null, 2)}
                onChange={(e) => {
                  try {
                    const arr = JSON.parse(e.target.value);
                    if (Array.isArray(arr)) {
                      updateSlotRule(idx, { then: arr as any });
                    }
                  } catch {
                    // 無視
                  }
                }}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => removeSlotRule(idx)}
                  className="px-3 py-1.5 text-red-400 hover:text-red-300 text-sm"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Link Rules */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-base font-semibold text-gray-200">リンクルール（A/B連動の雛形）</h5>
          <div className="flex gap-2">
            <button
              onClick={() => addLinkRule('tie')}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white rounded text-sm"
            >
              + tie same
            </button>
            <button
              onClick={() => addLinkRule('restrict')}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white rounded text-sm"
            >
              + restrictToValue
            </button>
            <button
              onClick={() => addLinkRule('cond')}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white rounded text-sm"
            >
              + 条件付き weight
            </button>
          </div>
        </div>

        {linkRules.length === 0 && (
          <div className="text-sm text-gray-400">リンクルールはありません。</div>
        )}

        <div className="space-y-3">
          {linkRules.map((rule, idx) => (
            <div key={idx} className="p-3 rounded border border-gray-700 bg-gray-800/50">
              <div className="text-xs text-gray-400 mb-1">type: {(rule as any).type}</div>
              <textarea
                className="w-full px-2 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                rows={4}
                value={JSON.stringify(rule, null, 2)}
                onChange={(e) => {
                  try {
                    const obj = JSON.parse(e.target.value);
                    const next = linkRules.slice();
                    next[idx] = obj as LinkRule;
                    onChange({ ...value, linkRules: next });
                  } catch {
                    // 無視
                  }
                }}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => removeLinkRule(idx)}
                  className="px-3 py-1.5 text-red-400 hover:text-red-300 text-sm"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-gray-400">
        <div>・slotRules: when → then（restrictToGroup → add → forbid → weight の順で評価想定）</div>
        <div>・linkRules: tie same / restrictToValue / 条件付きweight（後者は今後の実装対象）</div>
        <div>・本UIは雛形です。評価ロジックへの適用はルールベース生成タブでテストできます。</div>
      </div>
    </div>
  );
};