import React, { useMemo } from 'react';

export interface GroupItem {
  id: string;              // 表示のみ（編集不可）
  members: string[];       // キャラID配列
  weight?: number;         // 抽選重み
  tags?: string[];         // 追加: グループのタグ
  // 旧データ互換: label は受け取っても無視します（保存時に落とす）
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  label?: string;
}

export interface GroupConfigValue {
  groups: GroupItem[];
}

interface Props {
  value: GroupConfigValue;
  onChange: (v: GroupConfigValue) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const genGroupId = () => {
  const d = new Date();
  const rand = Math.random().toString(16).slice(2, 6);
  return `grp-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${rand}`;
};

// label を保存前に完全に除去
const sanitizeForSave = (groups: GroupItem[]): GroupItem[] => {
  return groups.map(g => {
    const out: GroupItem = {
      id: g.id,
      members: Array.isArray(g.members) ? g.members.slice() : [],
      weight: typeof g.weight === 'number' ? g.weight : undefined,
      tags: Array.isArray(g.tags) ? g.tags.slice() : undefined,
    };
    return out;
  });
};

export const GroupsManager: React.FC<Props> = ({ value, onChange }) => {
  const groups = useMemo(() => value?.groups ?? [], [value]);

  const addGroup = () => {
    const newGroup: GroupItem = {
      id: genGroupId(),
      members: [],
      weight: 1,
      tags: []
    };
    onChange({ groups: sanitizeForSave([...groups, newGroup]) });
  };

  const updateGroup = (idx: number, patch: Partial<GroupItem>) => {
    const next = groups.slice();
    const merged: GroupItem = { ...next[idx], ...patch };

    // 互換: label は使わないので常に除去
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete (merged as any).label;

    next[idx] = merged;
    onChange({ groups: sanitizeForSave(next) });
  };

  const removeGroup = (idx: number) => {
    const next = groups.slice();
    next.splice(idx, 1);
    onChange({ groups: sanitizeForSave(next) });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-100">固定グループ管理</h4>
        <button
          onClick={addGroup}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
        >
          グループを追加
        </button>
      </div>

      {groups.length === 0 && (
        <div className="text-sm text-gray-400">グループがまだありません。「グループを追加」を押してください。</div>
      )}

      <div className="space-y-2">
        {groups.map((g, i) => (
          <div key={g.id} className="p-3 rounded border border-gray-700 bg-gray-800/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-3">
                {/* ID は表示のみ（編集欄なし） */}
                <div>
                  <div className="text-xs text-gray-400">ID（自動採番・表示のみ）</div>
                  <div className="font-mono text-sm text-gray-200 break-all">{g.id}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {/* メンバー（カンマ区切り） */}
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">メンバー（キャラIDをカンマ区切り）</label>
                    <input
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                      value={(g.members || []).join(', ')}
                      onChange={(e) => {
                        const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        updateGroup(i, { members: arr });
                      }}
                      placeholder="imas.cg.shibuya_rin, imas.cg.honda_mio, ..."
                    />
                  </div>

                  {/* 重み */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">重み（整数）</label>
                    <input
                      type="number"
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                      value={typeof g.weight === 'number' ? g.weight : 1}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        updateGroup(i, { weight: Number.isFinite(v) ? v : 1 });
                      }}
                      min={0}
                    />
                  </div>
                </div>

                {/* タグ（カンマ区切り） */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">タグ（カンマ区切り）</label>
                  <input
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    value={(g.tags || []).join(', ')}
                    onChange={(e) => {
                      const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      updateGroup(i, { tags: arr });
                    }}
                    placeholder="sisters, 2girls, idol"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => removeGroup(i)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GroupsManager;