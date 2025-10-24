import React, { useEffect, useState } from 'react';
import { RuleBasedGeneratorTab } from './RuleBasedGeneratorTab';
import { OptionCatalogManager } from './RuleBasedGeneratorTab/components/OptionCatalogManager';
import { RulesManager } from './RuleBasedGeneratorTab/components/RulesManager';

type TabKey = 'generate' | 'catalog' | 'rules';

const LS_ACTIVE = 'rule-suite-active';

export const RuleSuiteTabs: React.FC = () => {
  const [active, setActive] = useState<TabKey>('generate');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(LS_ACTIVE) as TabKey | null;
    if (saved === 'generate' || saved === 'catalog' || saved === 'rules') {
      setActive(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LS_ACTIVE, active);
  }, [active]);

  return (
    <div className="space-y-4">
      {/* タブ見出し（モバイルは横スクロール可） */}
      <div className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur border-b border-gray-800">
        <div className="flex overflow-x-auto no-scrollbar">
          <TabButton
            label="生成"
            active={active === 'generate'}
            onClick={() => setActive('generate')}
          />
          <TabButton
            label="Option Catalog"
            active={active === 'catalog'}
            onClick={() => setActive('catalog')}
          />
          <TabButton
            label="Rules"
            active={active === 'rules'}
            onClick={() => setActive('rules')}
          />
        </div>
      </div>

      {/* コンテンツ */}
      <div>
        {active === 'generate' && <RuleBasedGeneratorTab />}
        {active === 'catalog' && (
          <div className="max-w-screen-xl mx-auto">
            <OptionCatalogManager />
          </div>
        )}
        {active === 'rules' && (
          <div className="max-w-screen-xl mx-auto">
            <RulesManager />
          </div>
        )}
      </div>
    </div>
  );
};

const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({
  label,
  active,
  onClick
}) => {
  return (
    <button
      className={[
        'px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors',
        active
          ? 'text-white border-blue-500'
          : 'text-gray-300 border-transparent hover:text-white hover:border-gray-600'
      ].join(' ')}
      onClick={onClick}
    >
      {label}
    </button>
  );
};