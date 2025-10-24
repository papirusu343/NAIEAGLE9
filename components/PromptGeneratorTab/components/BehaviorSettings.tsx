import React from 'react';

type GenerationBehavior = {
  generationOrder: 'unordered' | 'sequential';
  roleAssignment: 'shuffleAll' | 'randomA_restInOrder';
  partySizeMode: 'auto' | 'fixed';
  fixedPartySize?: number;
};

interface BehaviorSettingsProps {
  value: GenerationBehavior;
  onChange: (v: GenerationBehavior) => void;
}

export const BehaviorSettings: React.FC<BehaviorSettingsProps> = ({ value, onChange }) => {
  const v = value || {
    generationOrder: 'unordered',
    roleAssignment: 'shuffleAll',
    partySizeMode: 'auto',
    fixedPartySize: 2
  };

  const update = (patch: Partial<GenerationBehavior>) => {
    onChange({ ...v, ...patch });
  };

  return (
    <div className="card">
      <h3 className="text-base sm:text-lg font-semibold mb-3">振る舞い設定</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-sm text-gray-300 mb-1">生成順序</div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="generationOrder"
              checked={v.generationOrder === 'unordered'}
              onChange={() => update({ generationOrder: 'unordered' })}
            />
            順序なし（デフォルト）
          </label>
          <label className="flex items-center gap-2 text-sm mt-1">
            <input
              type="radio"
              name="generationOrder"
              checked={v.generationOrder === 'sequential'}
              onChange={() => update({ generationOrder: 'sequential' })}
            />
            順序あり（A→B→…）
          </label>
        </div>

        <div>
          <div className="text-sm text-gray-300 mb-1">役割割り当て</div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="roleAssignment"
              checked={v.roleAssignment === 'shuffleAll'}
              onChange={() => update({ roleAssignment: 'shuffleAll' })}
            />
            全員シャッフル（デフォルト）
          </label>
          <label className="flex items-center gap-2 text-sm mt-1">
            <input
              type="radio"
              name="roleAssignment"
              checked={v.roleAssignment === 'randomA_restInOrder'}
              onChange={() => update({ roleAssignment: 'randomA_restInOrder' })}
            />
            Aのみランダム／残りは順序通り
          </label>
        </div>

        <div>
          <div className="text-sm text-gray-300 mb-1">人数の扱い</div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="partySizeMode"
              checked={v.partySizeMode === 'auto'}
              onChange={() => update({ partySizeMode: 'auto' })}
            />
            自動（グループ人数に合わせる・デフォルト）
          </label>
          <div className="flex items-center gap-2 text-sm mt-1">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="partySizeMode"
                checked={v.partySizeMode === 'fixed'}
                onChange={() => update({ partySizeMode: 'fixed' })}
              />
              固定
            </label>
            <input
              type="number"
              min={1}
              className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              value={v.fixedPartySize ?? 2}
              onChange={(e) => update({ fixedPartySize: Math.max(1, Number(e.target.value) || 1) })}
              disabled={v.partySizeMode !== 'fixed'}
            />
          </div>
        </div>
      </div>
    </div>
  );
};