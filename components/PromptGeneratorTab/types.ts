// 既存: キャラクター関連
export interface CharacterEntry {
  id: string;
  name?: string;
  // 互換読み取り用（UIでは使わない）
  aliases?: string[];
  // テンプレ向け単一文字列
  name_prompt?: string;
  // シリーズ名などのテンプレ用
  series?: string;
  tags?: string[];
  meta?: any;
}

export interface CharacterCatalog {
  characters: CharacterEntry[];
}

// 更新: グループ関連
export interface Group {
  // 自動採番される安定キー（表示のみ・編集不可）
  id: string;
  // 抽選重み（任意）
  weight?: number;
  // このグループに属するメンバー（キャラクターID）
  members: string[];
  // 新規: グループのタグ（例: sisters, 2girls, idol）
  tags?: string[];

  // 旧データ互換: label は読み取りは許容、アプリ内部では一切使用しない
  // 保存時には破棄されます
  // @deprecated
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  label?: string;
}

export interface GroupConfig {
  groups: Group[];
}

// ルール設定（既存）
export interface SlotRuleActionAdd {
  action: 'add';
  slot: string;
  value: { id: string };
}
export interface SlotRuleActionForbid {
  action: 'forbid';
  slot: string;
  target: { id?: string; tag?: string; groupId?: string };
}
export interface SlotRuleActionWeight {
  action: 'weight';
  slot: string;
  value: { id: string; weight: number };
}
export interface SlotRuleActionRestrictToGroup {
  action: 'restrictToGroup';
  slot: string;
  groupId: string;
}
export type SlotRuleAction =
  | SlotRuleActionAdd
  | SlotRuleActionForbid
  | SlotRuleActionWeight
  | SlotRuleActionRestrictToGroup;

export interface SlotRule {
  when: Record<string, any> | Array<Record<string, any>>;
  then: SlotRuleAction[];
}

export interface LinkRuleTieSame {
  type: 'tie';
  tie: 'same';
  slot: string;
  who: string[]; // ["A","B",...]
}
export interface LinkRuleRestrictToValue {
  type: 'link';
  action: 'restrictToValue';
  who: string; // "A"
  slot: string;
  valueFrom: { who: string; slot: string };
}
export interface LinkRuleConditionalWeight {
  type: 'link';
  action: 'conditionalWeight';
}
export type LinkRule = LinkRuleTieSame | LinkRuleRestrictToValue | LinkRuleConditionalWeight;

export interface RuleConfig {
  slotRules: SlotRule[];
  linkRules: LinkRule[];
}

// 画面全体の状態（既存）
export interface PromptGeneratorState {
  selectedTemplate: string;
  mainPromptTemplate: string;
  characterPromptTemplate: string;
  mainNegativePromptTemplate: string;
  characterNegativePromptTemplate: string;

  groupConfig: GroupConfig;
  generationBehavior: {
    generationOrder: 'unordered' | 'sequential';
    roleAssignment: 'shuffleAll' | 'randomA_restInOrder';
    partySizeMode: 'auto' | 'fixed';
    fixedPartySize: number;
  };

  characterCatalog: CharacterCatalog;
  ruleConfig: RuleConfig;
}