import React from 'react';
import { RulesManager } from '../../components/RuleBasedGeneratorTab/components/RulesManager';

const RuleManagePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-100">Rules 管理</h1>
      <RulesManager />
    </div>
  );
};

export default RuleManagePage;