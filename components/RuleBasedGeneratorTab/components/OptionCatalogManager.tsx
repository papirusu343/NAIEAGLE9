import React, { useEffect, useMemo, useState } from 'react';

type SlotOption = {
  value: string;
  tags?: string[];
  weight?: number;
};

type OptionCatalog = {
  version: number;
  slots: Record<string, { options: SlotOption[] }>;
};

export const OptionCatalogManager: React.FC = () => {
  const [catalog, setCatalog] = useState<OptionCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/option-catalog');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as OptionCatalog;
        if (mounted) {
          const normalized: OptionCatalog = {
            version: data.version ?? 1,
            slots: Object.fromEntries(
              Object.entries(data.slots || {}).map(([slot, def]) => [
                slot,
                {
                  options: (def?.options || []).map((o) => ({
                    value: String(o.value),
                    tags: Array.isArray(o.tags) ? o.tags.map((t) => String(t)) : [],
                    weight: typeof o.weight === 'number' ? o.weight : 1,
                  })),
                },
              ])
            ),
          };
          setCatalog(normalized);
        }
      } catch (e: any) {
        setError(`カタログ読み込みに失敗しました: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const slotNames = useMemo(() => (catalog ? Object.keys(catalog.slots || {}) : []), [catalog]);

  const addSlot = () => {
    if (!catalog) return;
    const base = 'new_slot';
    let name = base;
    let i = 1;
    while (catalog.slots[name]) {
      name = `${base}_${i++}`;
    }
    setCatalog({
      ...catalog,
      slots: {
        ...catalog.slots,
        [name]: { options: [] },
      },
    });
  };

  const removeSlot = (slot: string) => {
    if (!catalog) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [slot]: _, ...rest } = catalog.slots;
    setCatalog({ ...catalog, slots: rest });
  };

  const addOption = (slot: string) => {
    if (!catalog) return;
    const def = catalog.slots[slot];
    if (!def) return;
    const base = 'new_value';
    let value = base;
    const values = new Set(def.options.map((o) => o.value));
    let i = 1;
    while (values.has(value)) {
      value = `${base}_${i++}`;
    }
    const next = {
      ...catalog,
      slots: {
        ...catalog.slots,
        [slot]: {
          options: [...def.options, { value, tags: [], weight: 1 }],
        },
      },
    };
    setCatalog(next);
  };

  const updateOption = (slot: string, idx: number, patch: Partial<SlotOption>) => {
    if (!catalog) return;
    const def = catalog.slots[slot];
    if (!def) return;
    const nextOptions = def.options.map((o, i) =>
      i === idx ? { ...o, ...patch } : o
    );
    setCatalog({
      ...catalog,
      slots: { ...catalog.slots, [slot]: { options: nextOptions } },
    });
  };

  const removeOption = (slot: string, idx: number) => {
    if (!catalog) return;
    const def = catalog.slots[slot];
    if (!def) return;
    const nextOptions = def.options.filter((_, i) => i !== idx);
    setCatalog({
      ...catalog,
      slots: { ...catalog.slots, [slot]: { options: nextOptions } },
    });
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json || typeof json !== 'object' || !json.slots) {
        throw new Error('不正なフォーマットです（slots が見つかりません）');
      }
      setCatalog({
        version: json.version ?? 1,
        slots: Object.fromEntries(
          Object.entries(json.slots).map(([slot, def]: any) => [
            slot,
            {
              options: (def?.options || []).map((o: any) => ({
                value: String(o.value),
                tags: Array.isArray(o.tags) ? o.tags.map((t) => String(t)) : [],
                weight: typeof o.weight === 'number' ? o.weight : 1,
              })),
            },
          ])
        ),
      });
      setError(null);
    } catch (e: any) {
      setError(`インポートに失敗しました: ${e.message}`);
    }
  };

  const handleExport = () => {
    if (!catalog) return;
    const blob = new Blob([JSON.stringify(catalog, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = 'optionCatalog.json';
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveCatalog = async () => {
    if (!catalog) return;
    try {
      setSaving(true);
      const normalized: OptionCatalog = {
        version: catalog.version ?? 1,
        slots: Object.fromEntries(
          Object.entries(catalog.slots).map(([slot, def]) => [
            slot,
            {
              options: (def?.options || []).map((o) => ({
                value: String(o.value),
                tags: (o.tags || []).map((t) => t.toLocaleLowerCase()),
                weight: typeof o.weight === 'number' ? o.weight : 1,
              })),
            },
          ])
        ),
      };
      const res = await fetch('/api/option-catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setError(null);
    } catch (e: any) {
      setError(`保存に失敗しました: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const visibleSlots = slotNames.filter((s) =>
    filterText.trim() ? s.toLowerCase().includes(filterText.trim().toLowerCase()) : true
  );

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
        <h4 className="text-lg font-semibold text-gray-100">Option Catalog 管理</h4>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept="application/json"
            onChange={(e) => e.target.files && e.target.files[0] && handleImport(e.target.files[0])}
            className="text-sm text-gray-300"
          />
          <button className="btn" onClick={handleExport}>エクスポート</button>
          <button className="btn" onClick={addSlot}>スロット追加</button>
          <button className="btn-primary" onClick={saveCatalog} disabled={saving || !catalog}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {error && <div className="text-red-400 text-sm mb-2">{error}</div>}
      {loading && <div className="text-gray-400 text-sm">読み込み中...</div>}
      {!loading && catalog && (
        <>
          <div className="mb-3">
            <input
              type="text"
              placeholder="スロット検索..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
            />
          </div>
          <div className="space-y-6 max-h-[60vh] md:max-h-[28rem] overflow-auto pr-2">
            {visibleSlots.map((slot) => {
              const def = catalog.slots[slot];
              return (
                <div key={slot} className="border border-gray-700 rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-gray-200 break-words">{slot}</div>
                    <div className="flex items-center gap-2">
                      <button className="btn" onClick={() => addOption(slot)}>候補追加</button>
                      <button className="btn-danger" onClick={() => removeSlot(slot)}>スロット削除</button>
                    </div>
                  </div>
                  <div className="space-y-2 overflow-x-auto">
                    {def.options.map((opt, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start min-w-[620px] sm:min-w-0">
                        <div className="sm:col-span-4">
                          <label className="block text-xs text-gray-400 mb-1">value</label>
                          <input
                            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                            value={opt.value}
                            onChange={(e) => updateOption(slot, idx, { value: e.target.value })}
                          />
                        </div>
                        <div className="sm:col-span-6">
                          <label className="block text-xs text-gray-400 mb-1">tags（カンマ区切り・大小無視）</label>
                          <input
                            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                            value={(opt.tags || []).join(', ')}
                            onChange={(e) =>
                              updateOption(slot, idx, {
                                tags: e.target.value
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </div>
                        <div className="flex sm:block items-end gap-2 sm:col-span-1">
                          <div className="w-full">
                            <label className="block text-xs text-gray-400 mb-1">weight</label>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white"
                              value={typeof opt.weight === 'number' ? opt.weight : 1}
                              onChange={(e) =>
                                updateOption(slot, idx, { weight: parseFloat(e.target.value) || 0 })
                              }
                            />
                          </div>
                          <button className="btn-danger sm:w-full" onClick={() => removeOption(slot, idx)}>
                            削除
                          </button>
                        </div>
                      </div>
                    ))}
                    {def.options.length === 0 && (
                      <div className="text-xs text-gray-400">候補がありません。「候補追加」で追加してください。</div>
                    )}
                  </div>
                </div>
              );
            })}
            {visibleSlots.length === 0 && <div className="text-xs text-gray-400">該当スロットがありません。</div>}
          </div>
        </>
      )}
    </div>
  );
};