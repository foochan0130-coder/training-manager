// 体重ログの追加・削除と、増減ペースの判定ロジック。
import { diffDays } from "./date.js";

export function addBodyWeightEntry(weights, kg, todayKey) {
  const next = weights.filter((x) => x.date !== todayKey);
  next.push({ date: todayKey, kg });
  next.sort((a, b) => (a.date < b.date ? -1 : 1));
  return next;
}

export function removeBodyWeightEntry(weights, date) {
  return weights.filter((x) => x.date !== date);
}

export function calcPaceMessage(weights) {
  if (weights.length < 2) return "週1回、朝イチ同条件で記録するとペースが出ます";

  const lastW = weights[weights.length - 1];
  const base = [...weights].reverse().find((x) => diffDays(x.date, lastW.date) >= 21) || weights[0];
  const d = diffDays(base.date, lastW.date);
  if (d < 7) return "週1回、朝イチ同条件で記録するとペースが出ます";

  const pace = ((lastW.kg - base.kg) / d) * 30;
  if (pace <= -2.2) return `⚠️ 月${Math.abs(pace).toFixed(1)}kgペースで減少 — 速すぎ。ご飯を少し足そう`;
  if (pace < -0.3) return `✅ 月${Math.abs(pace).toFixed(1)}kgペースで順調に減少中`;
  if (pace > 0.3) return `月${pace.toFixed(1)}kgペースで増加 — 食事を見直そう`;
  return "ほぼ横ばい。1ヶ月続くなら間食のバーを削る";
}
