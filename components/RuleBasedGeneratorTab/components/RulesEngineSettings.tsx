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

const LS_KEYS = {
  PREFER_BOOST: 'rb-engine-preferBoost',
  DEFAULTS_TARGETS: 'rb-engine-defaultsTargets',
};

export const RulesEngineSettings: React.FC = () => {
  const [optionCatalog, setOptionCatalog] = useState<OptionCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [preferBoost, setPreferBoost] = useState<number>(2.0);
  const [defaultTargets, setDefaultTargets] = useState<string[]>([]);

  // load option catalog (for listing slots)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/option-catalog');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as OptionCatalog;
        if (mounted) setOptionCatalog(data);
      } catch (e) {
        console.error('Failed to load option catalog:', e);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // load from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pb = window.localStorage.getItem(LS_KEYS.PREFER_BOOST);
    const dt = window.localStorage.getItem(LS_KEYS.DEFAULTS_TARGETS);
    if (pb) {
      const num = parseFloat(pb);
      if (!Number.isNaN(num) && num >= 1) setPreferBoost(num);
    }
    if (dt) {
      try {
        const arr = JSON.parse(dt);
        if (Array.isArray(arr)) setDefaultTargets(arr.filter((s) => typeof s === 'string'));
      } catch {}
    }
  }, []);

  // save to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LS_KEYS.PREFER_BOOST, String(preferBoost));
  }, [preferBoost]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LS_KEYS.DEFAULTS_TARGETS, JSON.stringify(defaultTargets));
  }, [defaultTargets]);

  const allSlots = useMemo<string[]>(() => {
    if (!optionCatalog) return [];
    return Object.keys(optionCatalog.slots || {});
  }, [optionCatalog]);

  const toggleTarget = (slot: string) => {
    setDefaultTargets((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-lg font-semibold text-gray-100">ルールエンジン設定</h4>
      </div>

      {/* Prefer boost */}
      <div className="mb-4">
        <label className="block text-sm text-gray-300 mb-1">
          prefer のブースト倍率（>= 1.0）
        </label>
        <input
          type="number"
          step="0.1"
          min={1}
          value={preferBoost}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v) && v >= 1) setPreferBoost(v);
          }}
          className="w-full sm:w-32 px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          prefer_option_tags でタグ一致した候補の重み係数です。例: 2.0 なら2倍で選ばれやすくなります。
          値はブラウザに保存され、ルール適用時に自動反映されます。
        </p>
      </div>

      {/* Defaults targets */}
      <div>
        <label className="block text-sm text-gray-300 mb-2">
          defaults の対象スロット（全候補からランダム補完）
        </label>
        {loading && <div className="text-xs text-gray-400 mb-2">候補を読み込み中...</div>}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {allSlots.map((slot) => (
              <label key={slot} className="inline-flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={defaultTargets.includes(slot)}
                  onChange={() => toggleTarget(slot)}
                />
                <span className="text-sm text-gray-200">{slot}</span>
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">
          forbids で候補0件になった場合は補完しません。ここで選択したスロットのみ、無定義時に全候補からランダム補完します。
        </p>
      </div>
    </div>
  );
};