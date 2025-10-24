import React from 'react';
import { PromptGeneratorState, TemplateData } from '../types';
import { promptGenerator } from '../../../utils/promptGenerator';

interface PromptTemplateSettingsProps {
  state: PromptGeneratorState;
  onStateChange: (newState: Partial<PromptGeneratorState>) => void;
  templates: TemplateData[];
}

export const PromptTemplateSettings: React.FC<PromptTemplateSettingsProps> = ({
  state,
  onStateChange,
  templates
}) => {
  // 🔥 新機能：テンプレート解析とキー検証
  const analyzeTemplate = (template: string, templateName: string) => {
    const usedKeys = promptGenerator.extractUsedKeys(template);
    
    if (!templateName) {
      return { usedKeys, missingKeys: null, availableKeys: null };
    }

    const templateData = templates.find(t => t.name === templateName);
    if (!templateData) {
      return { usedKeys, missingKeys: null, availableKeys: null };
    }

    const { missingKeys, availableKeys } = promptGenerator.checkTemplateKeys(template, templateData.data);
    return { usedKeys, missingKeys, availableKeys };
  };

  const mainTemplateAnalysis = analyzeTemplate((state as any).mainPromptTemplate, (state as any).selectedTemplate);
  const characterTemplateAnalysis = analyzeTemplate((state as any).characterPromptTemplate, (state as any).selectedTemplate);
  const mainNegativeAnalysis = analyzeTemplate((state as any).mainNegativePromptTemplate, (state as any).selectedTemplate);
  const characterNegativeAnalysis = analyzeTemplate((state as any).characterNegativePromptTemplate, (state as any).selectedTemplate);

  const renderKeyAnalysis = (analysis: any, title: string) => {
    const { usedKeys, missingKeys, availableKeys } = analysis;
    
    if (!usedKeys.commonKeys.length && !usedKeys.memberCommonKeys.length && !usedKeys.groupUniqueKeys.length) {
      return null;
    }

    return (
      <div className="mt-2 p-2 bg-gray-800 rounded text-xs">
        <div className="text-blue-400 font-medium mb-1">{title}:</div>
        
        {/* 使用中のキー */}
        {usedKeys.commonKeys.length > 0 && (
          <div className="mb-1">
            <span className="text-green-400">common:</span> {usedKeys.commonKeys.map((key: string) => {
              const isMissing = missingKeys?.commonKeys.includes(key);
              return (
                <span key={key} className={isMissing ? 'text-red-400 line-through' : 'text-white'}>
                  {key}
                </span>
              );
            }).reduce((prev: any, curr: any, index: number) => [prev, index > 0 ? ', ' : '', curr])}
          </div>
        )}
        
        {usedKeys.memberCommonKeys.length > 0 && (
          <div className="mb-1">
            <span className="text-yellow-400">member_common:</span> {usedKeys.memberCommonKeys.map((key: string) => {
              const isMissing = missingKeys?.memberCommonKeys.includes(key);
              return (
                <span key={key} className={isMissing ? 'text-red-400 line-through' : 'text-white'}>
                  {key}
                </span>
              );
            }).reduce((prev: any, curr: any, index: number) => [prev, index > 0 ? ', ' : '', curr])}
          </div>
        )}
        
        {usedKeys.groupUniqueKeys.length > 0 && (
          <div className="mb-1">
            <span className="text-purple-400">group_unique:</span> {usedKeys.groupUniqueKeys.map((key: string) => {
              const isMissing = missingKeys?.groupUniqueKeys.includes(key);
              return (
                <span key={key} className={isMissing ? 'text-red-400 line-through' : 'text-white'}>
                  {key}
                </span>
              );
            }).reduce((prev: any, curr: any, index: number) => [prev, index > 0 ? ', ' : '', curr])}
          </div>
        )}

        {/* 不足しているキーの警告 */}
        {missingKeys && (missingKeys.commonKeys.length > 0 || missingKeys.memberCommonKeys.length > 0 || missingKeys.groupUniqueKeys.length > 0) && (
          <div className="mt-2 p-1 bg-red-900 rounded text-red-300">
            <div className="font-bold text-xs">⚠️ 不足しているキー:</div>
            {missingKeys.commonKeys.length > 0 && (
              <div>common: {missingKeys.commonKeys.join(', ')}</div>
            )}
            {missingKeys.memberCommonKeys.length > 0 && (
              <div>member_common: {missingKeys.memberCommonKeys.join(', ')}</div>
            )}
            {missingKeys.groupUniqueKeys.length > 0 && (
              <div>group_unique: {missingKeys.groupUniqueKeys.join(', ')}</div>
            )}
          </div>
        )}

        {/* 利用可能なキーの表示 */}
        {availableKeys && (state as any).selectedTemplate && (
          <div className="mt-2 text-xs text-gray-500">
            <details>
              <summary className="cursor-pointer text-gray-400 hover:text-gray-300">利用可能なキー一覧</summary>
              <div className="mt-1 pl-2">
                {availableKeys.commonKeys.length > 0 && (
                  <div><span className="text-green-400">common:</span> {availableKeys.commonKeys.join(', ')}</div>
                )}
                {availableKeys.memberCommonKeys.length > 0 && (
                  <div><span className="text-yellow-400">member_common:</span> {availableKeys.memberCommonKeys.join(', ')}</div>
                )}
                {availableKeys.groupUniqueKeys.length > 0 && (
                  <div><span className="text-purple-400">group_unique:</span> {availableKeys.groupUniqueKeys.join(', ')}</div>
                )}
              </div>
            </details>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          メインプロンプトテンプレート
        </label>
        <textarea
          value={(state as any).mainPromptTemplate}
          onChange={(e) => onStateChange({ mainPromptTemplate: e.target.value } as any)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="例: 2girls, masterpiece, [common:location]"
        />
        <p className="text-xs text-gray-400 mt-1">
          [common:キー]、[member_common:キー] が使用できます。参照先がない場合はプロンプトから除外されます。
        </p>
        {renderKeyAnalysis(mainTemplateAnalysis, '使用中のキー')}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          メインプロンプトテンプレート（ネガティブ）
        </label>
        <textarea
          value={(state as any).mainNegativePromptTemplate}
          onChange={(e) => onStateChange({ mainNegativePromptTemplate: e.target.value } as any)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="例: [common:negative_keywords]"
        />
        <p className="text-xs text-gray-400 mt-1">
          [common:キー]、[member_common:キー] が使用できます（オプション）。参照先がない場合はプロンプトから除外されます。
        </p>
        {renderKeyAnalysis(mainNegativeAnalysis, '使用中のキー（ネガティブ）')}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          キャラクタープロンプトテンプレート
        </label>
        <textarea
          value={(state as any).characterPromptTemplate}
          onChange={(e) => onStateChange({ characterPromptTemplate: e.target.value } as any)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="例: 1girl, [group_unique:name]"
        />
        <p className="text-xs text-gray-400 mt-1">
          [group_unique:キー]、[member_common:キー] が使用できます。参照先がない場合はプロンプトから除外されます。
        </p>
        {renderKeyAnalysis(characterTemplateAnalysis, 'キャラクター使用中のキー')}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          キャラクタープロンプトテンプレート（ネガティブ）
        </label>
        <textarea
          value={(state as any).characterNegativePromptTemplate}
          onChange={(e) => onStateChange({ characterNegativePromptTemplate: e.target.value } as any)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="例: [group_unique:bad_traits]"
        />
        <p className="text-xs text-gray-400 mt-1">
          [group_unique:キー]、[member_common:キー] が使用できます（オプション）。参照先がない場合はプロンプトから除外されます。
        </p>
        {renderKeyAnalysis(characterNegativeAnalysis, 'キャラクターネガティブ使用中のキー')}
      </div>
    </>
  );
};