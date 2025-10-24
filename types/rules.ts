// ルールと評価用の型定義（最小構成）

export type Primitive = string | number | boolean;

export type Context = Record<string, Primitive | undefined>;

export type ConditionOp = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'nin';

// 単一条件（最小構成）
export interface Condition {
  key: string;          // 例: "bodyType", "situation", "templateName"
  op: ConditionOp;      // 例: "eq"
  value: Primitive | Primitive[]; // in/nin の場合は配列
}

// 効果（最小: add / deny / adjust）
export type Effect =
  | {
      type: 'add';
      targetKey: string;          // ワイルドカード名（例: "outfit", "pose"） 先頭/末尾の __ は不要
      items: string[];            // 追加する候補（文字列単位）
    }
  | {
      type: 'deny';
      targetKey: string;
      ids: string[];              // 除外候補（文字列一致）
    }
  | {
      type: 'adjust';
      targetKey: string;
      items: string[];            // 調整対象候補（文字列一致）
      mult: number;               // 重み倍率（例: 0.5, 1.6）
    };

export interface Rule {
  id: string;                     // UUID等
  name: string;                   // 表示名
  description?: string;
  enabled: boolean;
  priority: number;               // 小さいほど先に適用
  condition?: Condition;          // 未指定なら常時適用
  effects: Effect[];
  createdAt: string;
  updatedAt: string;
  version: number;                // 将来マイグレーション用
}