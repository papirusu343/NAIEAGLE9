import React from 'react';
import { Context } from '../../../types/rules';

interface Props {
  context: Context;
  onChange: (patch: Partial<Context>) => void;
  className?: string;
}

/**
 * 生成前にルール評価へ渡す“文脈”を簡易入力するUI
 * - 最小構成として文字入力中心（将来、選択肢化可）
 */
export const ContextControls: React.FC<Props> = ({ context, onChange, className }) => {
  return (
    <div className={className}>
      <div className="rounded border border-gray-700 p-3 bg-gray-800/40">
        <h4 className="text-sm font-medium text-gray-200 mb-2">🧩 コンテキスト（ルール適用に使用）</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="templateName" value={String(context.templateName ?? '')} onChange={(v) => onChange({ templateName: v || undefined })} placeholder="例: my-template" />
          <Field label="characterRole" value={String(context.characterRole ?? '')} onChange={(v) => onChange({ characterRole: v || undefined })} placeholder="例: student" />
          <Field label="bodyType" value={String(context.bodyType ?? '')} onChange={(v) => onChange({ bodyType: v || undefined })} placeholder="例: legs_emphasis" />
          <Field label="pose" value={String(context.pose ?? '')} onChange={(v) => onChange({ pose: v || undefined })} placeholder="例: sleep" />
          <Field label="situation" value={String(context.situation ?? '')} onChange={(v) => onChange({ situation: v || undefined })} placeholder="例: room" />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          ここで設定した値に基づいて「ワイルドカード候補」にルールを適用します（候補の追加・除外・重み調整）。
        </p>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="block text-xs text-gray-300 mb-1">{label}</label>
    <input
      className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);