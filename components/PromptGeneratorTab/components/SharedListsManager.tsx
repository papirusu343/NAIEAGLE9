import React, { useEffect, useMemo, useState } from 'react';

export type SharedLists = {
  outfits: string[];
  poses: string[];
};

interface SharedListsManagerProps {
  value?: Partial<SharedLists>;
  onChange: (v: SharedLists) => void;
}

const normalizeLines = (text: string): string[] => {
  return text
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
};

const uniqueSorted = (arr: string[]): string[] => {
  return Array.from(new Set(arr.map(s => s.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'ja')
  );
};

export const SharedListsManager: React.FC<SharedListsManagerProps> = ({ value, onChange }) => {
  const initial = useMemo<SharedLists>(
    () => ({
      outfits: value?.outfits ?? [],
      poses: value?.poses ?? []
    }),
    [value]
  );

  const [outfitsText, setOutfitsText] = useState<string>(initial.outfits.join('\n'));
  const [posesText, setPosesText] = useState<string>(initial.poses.join('\n'));

  // 外部値が更新された場合は同期
  useEffect(() => {
    setOutfitsText((value?.outfits ?? []).join('\n'));
  }, [value?.outfits]);

  useEffect(() => {
    setPosesText((value?.poses ?? []).join('\n'));
  }, [value?.poses]);

  const handleSave = () => {
    const next: SharedLists = {
      outfits: uniqueSorted(normalizeLines(outfitsText)),
      poses: uniqueSorted(normalizeLines(posesText))
    };
    onChange(next);
  };

  const handleDedupSortOutfits = () => {
    const next = uniqueSorted(normalizeLines(outfitsText));
    setOutfitsText(next.join('\n'));
  };

  const handleDedupSortPoses = () => {
    const next = uniqueSorted(normalizeLines(posesText));
    setPosesText(next.join('\n'));
  };

  const handleClearOutfits = () => setOutfitsText('');
  const handleClearPoses = () => setPosesText('');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 服装 */}
        <div className="rounded border border-gray-700 p-4 bg-gray-800/40">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-lg font-semibold text-gray-100">👗 服装リスト (outfits)</h5>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDedupSortOutfits}
                className="button-secondary text-xs"
              >
                重複削除＆ソート
              </button>
              <button
                onClick={handleClearOutfits}
                className="button-secondary text-xs text-red-300"
              >
                クリア
              </button>
            </div>
          </div>
          <textarea
            value={outfitsText}
            onChange={(e) => setOutfitsText(e.target.value)}
            className="textarea w-full"
            rows={12}
            placeholder={`一行に一つずつ服装を記入\n例:\nschool uniform\ncasual clothes\nidol costume\nkimono`}
          />
          <p className="text-xs text-gray-400 mt-2">
            • 改行区切りで複数登録できます（保存時に重複は自動削除・ソート可能）
          </p>
        </div>

        {/* ポーズ */}
        <div className="rounded border border-gray-700 p-4 bg-gray-800/40">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-lg font-semibold text-gray-100">🕺 ポーズリスト (poses)</h5>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDedupSortPoses}
                className="button-secondary text-xs"
              >
                重複削除＆ソート
              </button>
              <button
                onClick={handleClearPoses}
                className="button-secondary text-xs text-red-300"
              >
                クリア
              </button>
            </div>
          </div>
          <textarea
            value={posesText}
            onChange={(e) => setPosesText(e.target.value)}
            className="textarea w-full"
            rows={12}
            placeholder={`一行に一つずつポーズを記入\n例:\npeace sign\nhands on hips\narms crossed\ndynamic jump`}
          />
          <p className="text-xs text-gray-400 mt-2">
            • 改行区切りで複数登録できます（保存時に重複は自動削除・ソート可能）
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="button-primary"
        >
          💾 保存
        </button>
      </div>

      <div className="text-xs text-gray-400">
        <p>• ルールで outfit / pose が出力されなかった場合、このリストからランダムに補完します（ルールベース生成のみ）</p>
        <p>• テンプレでは [group_unique:outfit], [group_unique:pose] として参照できます</p>
      </div>
    </div>
  );
};

export default SharedListsManager;