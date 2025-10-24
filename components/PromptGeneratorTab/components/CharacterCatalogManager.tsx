import React, { useMemo, useState, useEffect } from 'react';
import { CharacterCatalog, CharacterEntry } from '../../types';

interface Props {
  value: CharacterCatalog;
  onChange: (v: CharacterCatalog) => void;
}

export const CharacterCatalogManager: React.FC<Props> = ({ value, onChange }) => {
  const [q, setQ] = useState('');
  // 新規追加フォームの内部保持（raw文字列で扱う）
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newTagsRaw, setNewTagsRaw] = useState('');
  // 旧 aliases は配列だったが、今後は name_prompt に単一文字列として入れる想定
  const [newNamePrompt, setNewNamePrompt] = useState('');
  const [newSeries, setNewSeries] = useState('');

  const characters = value?.characters ?? [];

  // 検索は id/name/tags/name_prompt/aliases を対象
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return characters;
    return characters.filter(c =>
      c.id.toLowerCase().includes(term) ||
      (c.name || '').toLowerCase().includes(term) ||
      (c.name_prompt || '').toLowerCase().includes(term) ||
      (c.series || '').toLowerCase().includes(term) ||
      (c.tags || []).some(t => t.toLowerCase().includes(term)) ||
      (c.aliases || []).some(a => a.toLowerCase().includes(term))
    );
  }, [q, characters]);

  const upsert = (entry: CharacterEntry) => {
    const idx = characters.findIndex(c => c.id === entry.id);
    if (idx >= 0) {
      const next = characters.slice();
      next[idx] = entry;
      onChange({ characters: next });
    } else {
      onChange({ characters: [...characters, entry] });
    }
  };

  const remove = (id: string) => {
    onChange({ characters: characters.filter(c => c.id !== id) });
  };

  const handleAdd = () => {
    const id = (newId || '').trim();
    if (!id) return;
    if (characters.some(c => c.id === id)) return;

    const tags = newTagsRaw.split(',').map(s => s.trim()).filter(Boolean);

    upsert({
      id,
      name: newName.trim() || undefined,
      // 新仕様: name_prompt は単一文字列（テンプレ用）。空文字は undefined にする
      name_prompt: newNamePrompt.trim() || undefined,
      series: newSeries.trim() || undefined,
      // 旧来互換情報は持たせない（ただし import では aliases を受け取ります）
      tags: tags.length > 0 ? tags : undefined,
    });

    // フォームをクリア
    setNewId('');
    setNewName('');
    setNewTagsRaw('');
    setNewNamePrompt('');
    setNewSeries('');
  };

  const exportJSON = () => {
    const data = JSON.stringify(value || { characters: [] }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'character-catalog.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.characters)) {
        throw new Error('不正なJSONです');
      }
      const normalized: CharacterCatalog = {
        characters: data.characters.map((c: any) => {
          const id = String(c.id || '').trim();
          const name = c.name ? String(c.name) : undefined;
          const tags = Array.isArray(c.tags) ? c.tags.map((t: any) => String(t)) : undefined;
          const series = c.series ? String(c.series) : undefined;

          // 互換性: 旧フォーマットの aliases があれば name_prompt に変換して保持する。
          // 変更: aliases が配列の場合は ', ' で連結して単一プロンプト文字列にする（要求に応じて）
          let name_prompt: string | undefined = undefined;
          if (c.name_prompt && typeof c.name_prompt === 'string') {
            name_prompt = c.name_prompt;
          } else if (Array.isArray(c.aliases) && c.aliases.length > 0) {
            name_prompt = c.aliases.map((a: any) => String(a)).join(', ');
          } else if (c.aliases && typeof c.aliases === 'string') {
            // まれに旧データでカンマ区切り文字列が入っている場合
            name_prompt = String(c.aliases);
          } else if (name) {
            // 最低限 name があればそれを流用
            name_prompt = name;
          }

          const aliases = Array.isArray(c.aliases) ? c.aliases.map((a: any) => String(a)) : undefined;

          return {
            id,
            name,
            aliases, // 互換のため残す（UIでは name_prompt を優先）
            name_prompt,
            series,
            tags,
            meta: typeof c.meta === 'object' && c.meta ? c.meta : undefined
          } as CharacterEntry;
        }).filter((c: CharacterEntry) => c.id.length > 0)
      };

      // UI 更新（呼び出し元でサーバ同期されます）
      onChange(normalized);
    } catch (e: any) {
      alert(`インポートに失敗しました: ${e.message || e}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* 検索 + 追加 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">検索</label>
          <input
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            placeholder="ID / 名前 / name_prompt / series / タグ で検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 md:flex-none md:w-[940px]">
          <div>
            <label className="block text-xs text-gray-400 mb-1">ID（必須）</label>
            <input
              className="w-full px-2 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="imas.cg.shibuya_rin"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">名前</label>
            <input
              className="w-full px-2 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="渋谷凛"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">name_prompt（テンプレ用単一文字列）</label>
            <input
              className="w-full px-2 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              value={newNamePrompt}
              onChange={(e) => setNewNamePrompt(e.target.value)}
              placeholder="例: Shibuya Rin"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">series（テンプレ用）</label>
            <input
              className="w-full px-2 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              value={newSeries}
              onChange={(e) => setNewSeries(e.target.value)}
              placeholder="例: Idolmaster"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">タグ（カンマ区切り）</label>
            <input
              className="w-full px-2 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              value={newTagsRaw}
              onChange={(e) => setNewTagsRaw(e.target.value)}
              placeholder="imas, cg, student"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAdd}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm w-full"
            >
              追加
            </button>
          </div>
        </div>

        <div className="flex items-end gap-2 md:ml-auto">
          <button
            onClick={exportJSON}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-white text-sm"
          >
            エクスポート
          </button>
          <label className="px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-white text-sm cursor-pointer">
            インポート
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importJSON(file);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {/* 一覧 */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-sm text-gray-400">一致するキャラクターが見つかりません。</div>
        )}
        {filtered.map(entry => (
          <CatalogRow key={entry.id} entry={entry} onChange={upsert} onRemove={remove} />
        ))}
      </div>
    </div>
  );
};

const CatalogRow: React.FC<{
  entry: CharacterEntry;
  onChange: (e: CharacterEntry) => void;
  onRemove: (id: string) => void;
}> = ({ entry, onChange, onRemove }) => {
  // 編集用ローカル状態（raw 文字列で扱う）
  const [editing, setEditing] = useState(false);
  const [localName, setLocalName] = useState(entry.name || '');
  const [localNamePrompt, setLocalNamePrompt] = useState(entry.name_prompt || '');
  const [localSeries, setLocalSeries] = useState(entry.series || '');
  const [localTagsRaw, setLocalTagsRaw] = useState((entry.tags || []).join(', '));
  const [localAliasesRaw, setLocalAliasesRaw] = useState((entry.aliases || []).join(', '));

  // entry が外部で変わった場合にローカルも同期
  useEffect(() => {
    setLocalName(entry.name || '');
    setLocalNamePrompt(entry.name_prompt || '');
    setLocalSeries(entry.series || '');
    setLocalTagsRaw((entry.tags || []).join(', '));
    setLocalAliasesRaw((entry.aliases || []).join(', '));
  }, [entry]);

  const commit = () => {
    const tags = localTagsRaw.split(',').map(s => s.trim()).filter(Boolean);
    const aliases = localAliasesRaw.split(',').map(s => s.trim()).filter(Boolean);

    onChange({
      id: entry.id,
      name: localName.trim() || undefined,
      // 新仕様: 単一文字列 name_prompt を保存
      name_prompt: localNamePrompt.trim() || undefined,
      series: localSeries.trim() || undefined,
      // 互換性のため aliases フィールドは残す（必要なら後でマイグレーション）
      aliases: aliases.length > 0 ? aliases : undefined,
      tags: tags.length > 0 ? tags : undefined,
      meta: entry.meta || undefined
    });
    setEditing(false);
  };

  return (
    <div className="p-3 rounded border border-gray-700 bg-gray-800/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm text-gray-200 font-mono">{entry.id}</div>
          {!editing ? (
            <div className="text-sm text-gray-300">
              <div>名前: {entry.name || '-'}</div>
              <div>name_prompt: {entry.name_prompt || '-'}</div>
              <div>series: {entry.series || '-'}</div>
              <div>タグ: {(entry.tags || []).join(', ') || '-'}</div>
              <div>別名(互換表示): {(entry.aliases || []).join(', ') || '-'}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
              <input
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="名前"
              />
              <input
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                value={localNamePrompt}
                onChange={(e) => setLocalNamePrompt(e.target.value)}
                placeholder="name_prompt（テンプレ用単一文字列）"
              />
              <input
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                value={localSeries}
                onChange={(e) => setLocalSeries(e.target.value)}
                placeholder="series（テンプレ用）"
              />
              <input
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                value={localTagsRaw}
                onChange={(e) => setLocalTagsRaw(e.target.value)}
                placeholder="タグ（カンマ区切り）"
              />
              <input
                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                value={localAliasesRaw}
                onChange={(e) => setLocalAliasesRaw(e.target.value)}
                placeholder="別名（カンマ区切り・互換用）"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-white text-sm"
            >
              編集
            </button>
          ) : (
            <button
              onClick={commit}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
            >
              保存
            </button>
          )}
          <button
            onClick={() => onRemove(entry.id)}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
};