import React from 'react';
import { usePromptGeneratorState } from './PromptGeneratorTab/hooks/usePromptGeneratorState';
import { CharacterCatalogManager } from './PromptGeneratorTab/components/CharacterCatalogManager';
import { RulesManager } from './PromptGeneratorTab/components/RulesManager';

export const RulesSettingsTab: React.FC = () => {
  const { state, updateState, isClient } = usePromptGeneratorState();

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-100">⚖️ ルール設定</h3>

      <div className="card">
        <h4 className="text-lg font-semibold mb-4">👤 キャラクターカタログ</h4>
        <CharacterCatalogManager
          value={(state as any).characterCatalog}
          onChange={(v) => updateState({ characterCatalog: v } as any)}
        />
      </div>

      <div className="card">
        <h4 className="text-lg font-semibold mb-4">🧩 ルール（雛形）</h4>
        <RulesManager
          value={(state as any).ruleConfig}
          onChange={(v) => updateState({ ruleConfig: v } as any)}
          groupConfig={(state as any).groupConfig}
          characterCatalog={(state as any).characterCatalog}
        />
      </div>
    </div>
  );
};