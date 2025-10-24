import React from 'react';
import { usePromptGeneratorState } from './PromptGeneratorTab/hooks/usePromptGeneratorState';
import { GroupsManager } from './PromptGeneratorTab/components/GroupsManager';
import { BehaviorSettings } from './PromptGeneratorTab/components/BehaviorSettings';

export const GroupSettingsTab: React.FC = () => {
  const { state, updateState, isClient } = usePromptGeneratorState();

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-gray-100">👥 グループ/振る舞い設定</h3>

      <GroupsManager
        value={(state as any).groupConfig}
        onChange={(v) => updateState({ groupConfig: v } as any)}
      />

      <BehaviorSettings
        value={(state as any).generationBehavior}
        onChange={(v) => updateState({ generationBehavior: v } as any)}
      />
    </div>
  );
};