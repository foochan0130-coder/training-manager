import { useState } from "react";
import { setGistConfig, clearGistConfig, createGistWithData } from "../lib/gist.js";

const STATUS_TEXT = {
  synced: "✅ GitHub Gistと同期済み",
  offline: "⚠️ Gistに接続できず、この端末の保存データを表示しています",
  unconfigured: "Gist未設定 — この端末にだけ保存されています",
  error: "❌ 直近の保存がGistに反映できていません",
};

export default function SyncSettings({ status, error, configured, currentData, onConnected, onDisconnect }) {
  const [token, setToken] = useState("");
  const [gistId, setGistId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

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
        <button className="ghostBtn" style={{ width: "100%" }} onClick={disconnect}>接続を解除</button>
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
