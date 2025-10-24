import React from 'react';
import type { RuleTrace } from '../../../utils/rulesEngine';

export const TraceViewer: React.FC<{ traces: RuleTrace[] | null }> = ({ traces }) => {
  if (!traces || traces.length === 0) {
    return (
      <div className="card">
        <h4 className="text-lg font-semibold text-gray-100 mb-2">Rule Trace</h4>
        <div className="text-xs text-gray-400">まだトレースがありません。生成を実行するとここに適用履歴が表示されます。</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h4 className="text-lg font-semibold text-gray-100 mb-2">Rule Trace</h4>
      <div className="space-y-4 max-h-[24rem] overflow-auto pr-2">
        {traces.map((t, idx) => (
          <div key={idx} className="border border-gray-700 rounded-md p-2 overflow-x-auto">
            <div className="text-sm text-gray-200 mb-1 break-words">
              メンバー: {t.memberId ?? '(未割当)'}
            </div>
            <div className="space-y-1 text-xs font-mono whitespace-pre-wrap break-words min-w-0">
              {t.steps.map((s, i) => (
                <div key={i} className="text-gray-300">
                  {renderStep(s)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function renderStep(s: RuleTrace['steps'][number]) {
  switch (s.kind) {
    case 'candidates:init':
      return `[candidates:init] slot=${s.slot} count=${s.count}`;
    case 'forbid:remove':
      return `[forbid:remove] slot=${s.slot} removed=${s.removedValues.join(',')}`;
    case 'forbid:empty':
      return `[forbid:empty] slot=${s.slot} → 候補0（空確定）`;
    case 'pick:init':
      return `[pick:init] slot=${s.slot} value=${s.value ?? '(none)'}`;
    case 'override:restrict':
      return `[override:restrict] p=${s.priority} slot=${s.slot} tagsALL=${s.keptByAllTags.join(',')} remained=${s.remained}`;
    case 'override:prefer':
      return `[override:prefer] p=${s.priority} slot=${s.slot} boost=${s.boostTags.join(',')}`;
    case 'override:set_from_tags':
      return `[override:set_from_tags] p=${s.priority} slot=${s.slot} tags=${s.tags.join(',')} value=${s.value ?? '(none)'} locked=${s.locked}`;
    case 'override:set':
      return `[override:set] p=${s.priority} slot=${s.slot} value=${s.value} locked=${s.locked}`;
    case 'scope:merged':
      return `[scope:merged] slot=${s.slot} policy=${s.policy} groupValue=${s.groupValue ?? '(none)'}`;
    case 'default:set':
      return `[default:set] slot=${s.slot} value=${s.value}`;
    default:
      return JSON.stringify(s);
  }
}