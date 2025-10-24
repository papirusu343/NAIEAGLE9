// ルール適用エンジン（wildcardFiles をフィルタ/加重し、配列で返す）
// 最小構成: add / deny / adjust（重み調整は配列複製で近似）

import { Condition, Context, Effect, Rule } from '../../types/rules';

// 条件評価（最小実装）
function matchCondition(cond: Condition | undefined, ctx: Context): boolean {
  if (!cond) return true; // 条件なし=常時適用
  const left = ctx[cond.key];
  const op = cond.op;
  const right = cond.value;

  switch (op) {
    case 'eq':  return left === right;
    case 'neq': return left !== right;
    case 'lt':  return typeof left === 'number' && typeof right === 'number' && left < right;
    case 'lte': return typeof left === 'number' && typeof right === 'number' && left <= right;
    case 'gt':  return typeof left === 'number' && typeof right === 'number' && left > right;
    case 'gte': return typeof left === 'number' && typeof right === 'number' && left >= right;
    case 'in':  return Array.isArray(right) && right.includes(left as any);
    case 'nin': return Array.isArray(right) && !right.includes(left as any);
    default:    return false;
  }
}

// 近似重み → 配列複製用の係数
const WEIGHT_SCALE = 10;

// 配列をユニーク化（順序維持）
function uniq(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function applyEffectsToList(initial: string[], effects: Effect[]): string[] {
  let list = [...initial];

  // 1) add
  for (const eff of effects) {
    if (eff.type === 'add') {
      list = uniq([...list, ...eff.items]);
    }
  }

  // 2) deny
  const denied = new Set<string>();
  for (const eff of effects) {
    if (eff.type === 'deny') {
      eff.ids.forEach((id) => denied.add(id));
    }
  }
  if (denied.size > 0) {
    list = list.filter((s) => !denied.has(s));
  }

  // 3) adjust（重みを倍率で調整→配列複製で近似）
  //    初期重みは 1 として、mult を掛ける。結果 weight * WEIGHT_SCALE を丸める。
  //    0 未満は除外。0 超かつ < 1*scale でも最低1にするかは運用次第だが、ここでは丸め（0なら除外）。
  const multMap = new Map<string, number>();
  for (const eff of effects) {
    if (eff.type === 'adjust') {
      const m = eff.mult;
      for (const id of eff.items) {
        multMap.set(id, (multMap.get(id) ?? 1) * m);
      }
    }
  }

  if (multMap.size > 0) {
    const out: string[] = [];
    for (const s of list) {
      const mult = multMap.get(s) ?? 1;
      const copies = Math.round(mult * WEIGHT_SCALE);
      if (copies > 0) {
        for (let i = 0; i < copies; i++) out.push(s);
      }
      // copies === 0 の場合は除外
    }
    list = out.length > 0 ? out : []; // 空なら空のまま（後段で警告扱いする実装余地）
  }

  return list;
}

// メイン: wildcardFiles にルールを適用
export function applyRulesToWildcards(
  wildcardFiles: Record<string, string[]>,
  rules: Rule[],
  context: Context
): Record<string, string[]> {
  // 有効なルールを優先度順に
  const active = rules
    .filter((r) => r.enabled && matchCondition(r.condition, context))
    .sort((a, b) => a.priority - b.priority);

  // targetKey ごとに効果をまとめる
  const bucket = new Map<string, Effect[]>();
  for (const r of active) {
    for (const eff of r.effects) {
      const key = eff.targetKey;
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key)!.push(eff);
    }
  }

  // 出力マップを構築
  const out: Record<string, string[]> = {};
  const keyList = Object.keys(wildcardFiles);

  for (const key of keyList) {
    const raw = wildcardFiles[key] || [];
    const simpleKey = key.replace(/^_+|_+$/g, ''); // "__outfit__" → "outfit" などの揺れ吸収
    const effects = (bucket.get(key) || []).concat(bucket.get(simpleKey) || []);
    if (effects.length === 0) {
      out[key] = raw.slice();
    } else {
      out[key] = applyEffectsToList(raw, effects);
    }
  }

  // ルールで新規キーを追加（元に存在しない targetKey に add した場合）
  for (const [key, effects] of bucket.entries()) {
    if (out[key]) continue;
    // apply して追加（deny/adjust のみだと空になる可能性あり）
    const added = applyEffectsToList([], effects);
    if (added.length > 0) {
      out[key] = added;
    }
  }

  return out;
}