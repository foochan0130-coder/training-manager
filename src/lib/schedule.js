// トレーニング周期(A → 家1 → B → 家2)と、日々の予定キューの計算ロジック。
import { addDaysKey } from "./date.js";

export const ORDER = ["A", "home1", "B", "home2"];
export const HORIZON = 16;

export const nextType = (t) => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length];

// キューが常にHORIZON件先まで埋まるよう、末尾に次の周期を足していく
export function topUp(queue, gap) {
  const q = [...queue];
  while (q.length < HORIZON) {
    const last = q[q.length - 1];
    q.push({ date: addDaysKey(last.date, gap), type: nextType(last.type) });
  }
  return q;
}

// 直近の完了記録から次にやるべき種目を決め、今日を起点に予定キューを再構築する
export function buildQueue(days, interval, today) {
  const gap = interval + 1;
  const doneDays = Object.entries(days)
    .filter(([, v]) => v && v.status === "done" && ORDER.includes(v.type))
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)); // 降順(最新が先頭)
  const startType = doneDays.length > 0 ? nextType(doneDays[0][1].type) : "A";
  return topUp([{ date: today, type: startType }], gap);
}

// fromIdx以降の予定を、anchorKeyを起点に間隔(gap)を保ったまま並べ直す
export function respace(queue, fromIdx, anchorKey, gap) {
  return queue.map((it, i) =>
    i < fromIdx ? it : { ...it, date: addDaysKey(anchorKey, gap * (i - fromIdx + 1)) }
  );
}

export const PLAN = {
  A: {
    label: "A", title: "ジム A日 — 押す系+腹", color: "#D93A3A",
    items: [
      { name: "チェストプレス",    sets: "3セット × 8–10回" },
      { name: "ショルダープレス",  sets: "3セット × 8–10回" },
      { name: "レッグプレス",      sets: "3セット × 10回" },
      { name: "アブドミナル",      sets: "3セット × 12–15回" },
      { name: "トーソローテーション", sets: "左右各 2セット × 12–15回" },
    ],
  },
  B: {
    label: "B", title: "ジム B日 — 引く系+腕+腹", color: "#2E63C9",
    items: [
      { name: "プルダウン",        sets: "3セット × 8–10回" },
      { name: "シーテッドロー",    sets: "3セット × 8–10回" },
      { name: "バイセップスカール",sets: "3セット × 8–10回" },
      { name: "レッグプレス",      sets: "3セット × 10回" },
      { name: "アブドミナル",      sets: "3セット × 12–15回" },
    ],
  },
  home1: {
    label: "家1", title: "家トレ1 — 腹中心(約10分)", color: "#2F9D5C",
    items: [
      { name: "アブローラー(膝つき)", sets: "3セット × 8–12回",         fixed: "自重" },
      { name: "レッグレイズ",         sets: "3セット × 10–15回",         fixed: "自重" },
      { name: "ロシアンツイスト",     sets: "左右各10回 × 3セット",      fixed: "ダンベル5kg" },
      { name: "サイドプランク",       sets: "左右各 30–45秒 × 2",        fixed: "自重" },
    ],
  },
  home2: {
    label: "家2", title: "家トレ2 — 全身(約15分)", color: "#2AA198",
    items: [
      { name: "ゴブレットスクワット",        sets: "3セット × 10–12回", fixed: "ダンベル10–15kg" },
      { name: "ダンベルRDL(もも裏・尻)",    sets: "3セット × 10回",    fixed: "ダンベル10–15kg" },
      { name: "プッシュアップバー腕立て",    sets: "3セット × 10–15回", fixed: "自重" },
      { name: "アブローラー(膝つき)",        sets: "2セット × 8–10回",  fixed: "自重" },
    ],
  },
};

export const STRETCH = [
  { name: "キャット&カウ",       sets: "四つ這いで背中を丸める⇄反らすを、ゆっくり10回" },
  { name: "チャイルドポーズ",     sets: "正座から両手を前に伸ばして脱力 30秒" },
  { name: "膝抱え",               sets: "仰向けで両膝を胸に引き寄せて 30秒" },
  { name: "仰向けツイスト",       sets: "仰向けで両膝をそろえて左右に倒す 各30秒" },
  { name: "もも裏ストレッチ",     sets: "仰向けで片脚を上げ、タオルをかけて引く 左右各30秒" },
];

export const DIET_TIPS = [
  "現在の食事: 約1,700kcal / タンパク質125〜130g — 175cm・70kgの減量としてほぼ理想形",
  "タンパク質の目標は112〜140g/日(体重×1.6〜2g)。むねから4個+夜プロテインで達成",
  "体重は週1回、朝イチ同条件で計測。月2kgより速く減る or 重量が落ちたら、ご飯を少し足す",
  "1ヶ月でほぼ動かないなら、間食のバーを削る",
  "減量中もマシンの重量は維持を狙う。落ち始めたら削りすぎのサイン",
];
