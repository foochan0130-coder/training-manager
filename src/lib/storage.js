// 永続化層: データの実体はGitHub Gist。localStorageはオフライン時の
// フォールバック用キャッシュにすぎない(Gistに接続できないときだけ使う)。
import { buildQueue } from "./schedule.js";
import { todayK } from "./date.js";
import { getGistConfig, fetchGistData, updateGistData } from "./gist.js";

const CACHE_KEY = "gym-tracker:cache-v1";
const LAST_SYNCED_KEY = "gym-tracker:last-synced";
const EMPTY_DATA = { days: {}, equipment: [], interval: 1, weights: [] };

function markSynced() {
  try {
    localStorage.setItem(LAST_SYNCED_KEY, new Date().toISOString());
  } catch (e) {}
}

export function getLastSyncedAt() {
  try {
    return localStorage.getItem(LAST_SYNCED_KEY);
  } catch (e) {
    return null;
  }
}

function isValidData(d) {
  return d && typeof d === "object" && d.days && d.equipment && d.weights;
}

// queueは保存対象に含めない。常にdaysと今日の日付から再生成する。
function withFreshQueue(data) {
  return { ...data, queue: buildQueue(data.days, data.interval, todayK()) };
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidData(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

function writeCache(data) {
  try {
    const { queue, ...rest } = data;
    localStorage.setItem(CACHE_KEY, JSON.stringify(rest));
  } catch (e) {
    // 書き込めなくても画面上の操作は継続させる
  }
}

// 戻り値の status:
//   "synced"       Gistから正常に読み込めた
//   "offline"      Gist設定はあるが読み込みに失敗し、この端末のキャッシュを使った
//   "unconfigured" まだGistが設定されていない(この端末のキャッシュ、なければ空データ)
export async function loadData() {
  const config = getGistConfig();

  if (!config) {
    const cached = readCache();
    return { status: "unconfigured", data: withFreshQueue(cached || EMPTY_DATA) };
  }

  try {
    const remote = await fetchGistData(config.token, config.gistId);
    if (!isValidData(remote)) throw new Error("Gistのデータ形式が不正です");
    writeCache(remote);
    markSynced();
    return { status: "synced", data: withFreshQueue(remote) };
  } catch (e) {
    const cached = readCache();
    return { status: "offline", data: withFreshQueue(cached || EMPTY_DATA), error: e.message };
  }
}

// 戻り値の status: "synced" | "unconfigured" | "error"
export async function saveData(data) {
  writeCache(data);
  const config = getGistConfig();
  if (!config) return { status: "unconfigured" };
  try {
    const { queue, ...rest } = data;
    await updateGistData(config.token, config.gistId, rest);
    markSynced();
    return { status: "synced" };
  } catch (e) {
    return { status: "error", error: e.message };
  }
}

export function importData(rawText) {
  const parsed = JSON.parse(rawText.trim());
  if (!isValidData(parsed)) throw new Error("invalid backup format");
  return withFreshQueue(parsed);
}

export function exportData(data) {
  const { queue, ...rest } = data;
  return JSON.stringify(rest, null, 2);
}
