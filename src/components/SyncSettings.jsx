import { useState } from "react";
import { setGistConfig, clearGistConfig, createGistWithData, getGistConfig } from "../lib/gist.js";
import { getLastSyncedAt } from "../lib/storage.js";

const STATUS_TEXT = {
  synced: "✅ GitHub Gistと同期済み",
  offline: "⚠️ Gistに接続できず、この端末の保存データを表示しています",
  unconfigured: "Gist未設定 — この端末にだけ保存されています",
  error: "❌ 直近の保存がGistに反映できていません",
};

function formatSyncedAt(iso) {
  if (!iso) return "まだ同期していません";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SyncSettings({ status, error, configured, currentData, onConnected, onDisconnect }) {
  const [token, setToken] = useState("");
  const [gistId, setGistId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const connectExisting = async () => {
    if (!token.trim() || !gistId.trim()) { setMsg("トークンとGist IDの両方を入力してください"); return; }
    setBusy(true); setMsg("");
    setGistConfig({ token: token.trim(), gistId: gistId.trim() });
    await onConnected();
    setBusy(false);
  };

  const createNew = async () => {
    if (!token.trim()) { setMsg("先にトークンを入力してください"); return; }
    setBusy(true); setMsg("");
    try {
      const { queue, ...rest } = currentData;
      const id = await createGistWithData(token.trim(), rest);
      setGistConfig({ token: token.trim(), gistId: id });
      setMsg(`✅ Gistを作成しました(ID: ${id})`);
      await onConnected();
    } catch (e) {
      setMsg(`❌ 作成に失敗しました: ${e.message}`);
    }
    setBusy(false);
  };

  const disconnect = () => {
    clearGistConfig();
    setToken(""); setGistId(""); setMsg("");
    onDisconnect();
  };

  const retry = async () => {
    setBusy(true);
    await onConnected();
    setBusy(false);
  };

  const copyGistId = async (id) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      setMsg("コピーできませんでした。長押しで手動でコピーしてください");
    }
  };

  const currentGistId = configured ? getGistConfig()?.gistId : null;

  return (
    <div className="menuCard">
      <div style={{ fontSize: 14, fontWeight: 700, padding: "2px 0 2px 10px", marginBottom: 8, borderLeft: "3px solid #8C929A" }}>
        データの同期(GitHub Gist)
      </div>
      <div style={{ fontSize: 12, color: "#8C929A", lineHeight: 1.6, marginBottom: 6 }}>
        {STATUS_TEXT[status] || STATUS_TEXT.unconfigured}
      </div>
      {error && <div style={{ fontSize: 11, color: "#D97878", marginBottom: 8 }}>{error}</div>}

      {configured ? (
        <>
          <div style={{ fontSize: 11, color: "#8C929A", marginBottom: 4 }}>最終同期: {formatSyncedAt(getLastSyncedAt())}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "#8C929A" }}>Gist ID:</div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: "#C9CDD2", wordBreak: "break-all", flex: 1 }}>{currentGistId}</div>
            <button className="step" style={{ width: "auto", padding: "0 10px", fontSize: 11 }} onClick={() => copyGistId(currentGistId)}>
              {copied ? "✓" : "コピー"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(status === "offline" || status === "error") && (
              <button className="ghostBtn" style={{ flex: 1 }} disabled={busy} onClick={retry}>もう一度試す</button>
            )}
            <button className="ghostBtn" style={{ flex: 1 }} onClick={disconnect}>接続を解除</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "#8C929A", lineHeight: 1.7, marginBottom: 10 }}>
            <a href="https://github.com/settings/tokens/new?scopes=gist&description=gym-tracker" target="_blank" rel="noreferrer" style={{ color: "#E8B416" }}>
              GitHubでgistスコープのみのトークンを発行
            </a>
            し、下に貼り付けてください。既存のGist IDがあればそれも入力、なければ「新しく作る」で今のデータから作成します。
          </div>
          <input
            className="gistInput"
            type="password"
            placeholder="Personal Access Token (gist scope)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <input
            className="gistInput"
            placeholder="既存のGist ID(なければ空欄でOK)"
            value={gistId}
            onChange={(e) => setGistId(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="ghostBtn" style={{ flex: 1 }} disabled={busy} onClick={connectExisting}>既存のGistに接続</button>
            <button className="addBtn" style={{ flex: 1 }} disabled={busy} onClick={createNew}>新しく作る</button>
          </div>
          {msg && <div style={{ fontSize: 12, color: "#E8B416", marginTop: 8, lineHeight: 1.6 }}>{msg}</div>}
        </>
      )}
    </div>
  );
}
