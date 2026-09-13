// GitHub Gist をデータの実体として読み書きするための薄いAPIラッパー。
// トークン/Gist IDはこの端末のlocalStorageに保存する(サーバーを持たないため、
// クライアント側に置く以外の選択肢がない。トークンはgistスコープだけに絞ること)。
const API = "https://api.github.com";
const FILENAME = "gym-tracker-data.json";
const CONFIG_KEY = "gym-tracker:gist-config";

export function getGistConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && parsed.token && parsed.gistId ? parsed : null;
  } catch (e) {
    return null;
  }
}

export function setGistConfig(config) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (e) {}
}

export function clearGistConfig() {
  try {
    localStorage.removeItem(CONFIG_KEY);
  } catch (e) {}
}

function authHeaders(token) {
  return {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
  };
}

function gistErrorMessage(status) {
  if (status === 401) return "トークンが無効です";
  if (status === 404) return "Gistが見つかりません(IDを確認してください)";
  if (status === 403) return "APIの利用制限に達しました。しばらく待ってから試してください";
  return `Gistとの通信に失敗しました (status ${status})`;
}

export async function fetchGistData(token, gistId) {
  const res = await fetch(`${API}/gists/${gistId}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(gistErrorMessage(res.status));
  const gist = await res.json();
  const file = gist.files[FILENAME];
  if (!file) throw new Error(`Gist内に${FILENAME}が見つかりません`);
  const content = file.truncated ? await (await fetch(file.raw_url)).text() : file.content;
  return JSON.parse(content);
}

export async function createGistWithData(token, data) {
  const res = await fetch(`${API}/gists`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      description: "筋トレ帳データ",
      public: false,
      files: { [FILENAME]: { content: JSON.stringify(data, null, 2) } },
    }),
  });
  if (!res.ok) throw new Error(gistErrorMessage(res.status));
  const gist = await res.json();
  return gist.id;
}

export async function updateGistData(token, gistId, data) {
  const res = await fetch(`${API}/gists/${gistId}`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ files: { [FILENAME]: { content: JSON.stringify(data, null, 2) } } }),
  });
  if (!res.ok) throw new Error(gistErrorMessage(res.status));
}
