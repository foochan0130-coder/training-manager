import { useState, useEffect, useRef } from "react";
import { pad, keyOf, WEEKDAYS, addDaysKey, todayK } from "./lib/date.js";
import { ORDER, topUp, respace, PLAN, STRETCH, DIET_TIPS } from "./lib/schedule.js";
import { weightForItem, addEquipmentItem, changeEquipmentWeight, removeEquipmentItem } from "./lib/equipment.js";
import { addBodyWeightEntry, removeBodyWeightEntry, calcPaceMessage } from "./lib/bodyWeight.js";
import { loadData, saveData, importData, exportData } from "./lib/storage.js";
import { getGistConfig } from "./lib/gist.js";
import { beep } from "./lib/sound.js";
import WeightChart from "./components/WeightChart.jsx";
import SyncSettings from "./components/SyncSettings.jsx";

export default function GymTracker() {
  const now = new Date();
  const todayKey = todayK();
  const [tab, setTab] = useState("days");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [newName, setNewName] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [newBodyW, setNewBodyW] = useState("");
  const [backupText, setBackupText] = useState("");
  const [backupMsg, setBackupMsg] = useState("");
  const backupRef = useRef(null);
  const [restEnd, setRestEnd] = useState(null);
  const [restLeft, setRestLeft] = useState(0);
  const [syncStatus, setSyncStatus] = useState("unconfigured");
  const [syncError, setSyncError] = useState(null);
  const [gistConnected, setGistConnected] = useState(false);
  // 読み込み直後の1回分の保存をスキップするためのフラグ(読んだものをそのまま書き戻さないため)
  const skipSaveRef = useRef(true);

  const refreshFromStore = () => {
    skipSaveRef.current = true;
    return loadData().then((r) => {
      setData(r.data);
      setSyncStatus(r.status);
      setSyncError(r.error || null);
      setGistConnected(!!getGistConfig());
    });
  };

  // 初回だけ読み込む(Gist設定があればGistから、なければこの端末のキャッシュ/初期seedから)
  useEffect(() => {
    refreshFromStore();
  }, []);

  // dataが変わるたびに保存する(読み込み直後の1回は除く)
  useEffect(() => {
    if (!data) return;
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    saveData(data).then((r) => {
      setSyncStatus(r.status);
      setSyncError(r.error || null);
    });
  }, [data]);

  // タイマー
  useEffect(() => {
    if (!restEnd) return;
    const id = window.setInterval(() => {
      const l = Math.ceil((restEnd - Date.now()) / 1000);
      if (l <= 0) { beep(); setRestEnd(null); setRestLeft(0); }
      else setRestLeft(l);
    }, 250);
    return () => window.clearInterval(id);
  }, [restEnd]);

  const startRest = (sec) => { setRestLeft(sec); setRestEnd(Date.now() + sec * 1000); };
  const stopRest = () => { setRestEnd(null); setRestLeft(0); };

  const update = (next) => setData(next);

  if (!data) {
    return (
      <div style={S.app}><style>{CSS}</style>
        <div style={{ color: "#8C929A", padding: 40, textAlign: "center" }}>読み込み中…</div>
      </div>
    );
  }

  const gap = data.interval + 1;

  const queueMap = {};
  data.queue.forEach((q, i) => { if (!queueMap[q.date]) queueMap[q.date] = { ...q, idx: i }; });

  // ---- cycle ops ----
  const completePlanned = (k) => {
    const it = queueMap[k];
    const days = { ...data.days, [k]: { type: it.type, status: "done" } };
    let q = data.queue.filter((_, i) => i !== it.idx);
    q = respace(q, it.idx, k, gap);
    update({ ...data, days, queue: topUp(q, gap) });
  };

  const skipPlanned = (k) => {
    const it = queueMap[k];
    const q = data.queue.filter((_, i) => i !== it.idx);
    update({ ...data, queue: topUp(q, gap) });
  };

  const shiftPlanned = (k, delta) => {
    const it = queueMap[k];
    const newDate = addDaysKey(k, delta);
    if (newDate < todayKey) return;
    let q = [...data.queue];
    q[it.idx] = { ...q[it.idx], date: newDate };
    q = respace(q, it.idx + 1, newDate, gap);
    update({ ...data, queue: q });
    setSelected(newDate);
  };

  const moveNextHere = (k) => {
    let q = [...data.queue];
    q[0] = { ...q[0], date: k };
    q = respace(q, 1, k, gap);
    update({ ...data, queue: q });
  };

  const logDone = (k, type) => {
    const days = { ...data.days, [k]: { type, status: "done" } };
    let queue = data.queue;
    const idx = queue.slice(0, 4).findIndex((q) => q.type === type);
    if (idx >= 0) {
      let q = queue.filter((_, i) => i !== idx);
      q = respace(q, idx, k, gap);
      queue = topUp(q, gap);
    }
    update({ ...data, days, queue });
  };

  const clearDone = (k) => {
    const days = { ...data.days };
    delete days[k];
    update({ ...data, days });
  };

  const setInterval_ = (v) => {
    const iv = Math.min(3, Math.max(1, v));
    const g = iv + 1;
    const first = data.queue[0].date;
    const queue = data.queue.map((it, i) => ({ ...it, date: addDaysKey(first, g * i) }));
    update({ ...data, interval: iv, queue });
  };

  // ---- calendar ----
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad = first.getDay();
  const monthPrefix = `${year}-${pad(month + 1)}`;
  const monthGym = Object.entries(data.days).filter(
    ([k, v]) => k.startsWith(monthPrefix) && v.status === "done" && (v.type === "A" || v.type === "B")
  ).length;

  const moveMonth = (delta) => {
    const dt = new Date(year, month + delta, 1);
    setYear(dt.getFullYear()); setMonth(dt.getMonth());
  };

  // ---- equipment ----
  const addEquipment = () => {
    const name = newName.trim();
    const w = parseFloat(newWeight);
    if (!name || isNaN(w)) return;
    update({ ...data, equipment: addEquipmentItem(data.equipment, name, w, todayKey) });
    setNewName(""); setNewWeight("");
  };

  const changeWeight = (id, delta) =>
    update({ ...data, equipment: changeEquipmentWeight(data.equipment, id, delta, todayKey) });

  const removeEquipment = (id) =>
    update({ ...data, equipment: removeEquipmentItem(data.equipment, id) });

  // ---- body weight ----
  const addBodyWeight = () => {
    const w = parseFloat(newBodyW);
    if (isNaN(w) || w <= 0) return;
    update({ ...data, weights: addBodyWeightEntry(data.weights, w, todayKey) });
    setNewBodyW("");
  };

  const removeBodyWeight = (date) =>
    update({ ...data, weights: removeBodyWeightEntry(data.weights, date) });

  // ---- backup (手動での書き出し/復元。自動保存の補助) ----
  const exportBackup = () => {
    setBackupText(exportData(data));
    setBackupMsg("↓ テキストをタップして全選択 → コピーしてメモアプリに保存してください");
    setTimeout(() => {
      if (backupRef.current) {
        backupRef.current.focus();
        backupRef.current.select();
      }
    }, 50);
  };

  const importBackup = () => {
    try {
      const restored = importData(backupText);
      update(restored);
      setBackupText("");
      setBackupMsg("✅ 復元しました。予定を最新の実施記録から再生成しました");
    } catch (e) {
      setBackupMsg("❌ 形式が正しくありません。書き出したテキストをそのまま貼り付けてください");
    }
  };

  const paceMsg = calcPaceMessage(data.weights);

  const selDone = selected ? data.days[selected] : null;
  const selPlanned = selected && !selDone ? queueMap[selected] : null;
  const next = data.queue[0];

  return (
    <div style={S.app}>
      <style>{CSS}</style>

      <header style={S.header}>
        <div>
          <div style={S.eyebrow}>GOAL: SIX-PACK</div>
          <h1 style={S.title}>筋トレ帳</h1>
        </div>
        <div style={S.statBox}>
          <div style={S.statNum}>{monthGym}<span style={S.statUnit}>/8</span></div>
          <div style={S.statLabel}>今月のジム(週2目標)</div>
        </div>
      </header>

      <nav style={S.tabs}>
        {[["days","記録"],["plan","プラン"],["weights","マシン"],["body","体重"],["timer","タイマー"]].map(([id,label]) => (
          <button key={id} className={"tab"+(tab===id?" active":"")} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {/* ===================== 記録 ===================== */}
      {tab === "days" && (
        <section>
          <div style={S.nextBanner}>
            次は <b style={{ color: PLAN[next.type].color }}>
              {next.type === "A" || next.type === "B" ? `ジム${next.type}` : PLAN[next.type].label}
            </b>({next.date === todayKey ? "今日" : next.date.slice(5).replace("-", "/")})。
            予定は完了・移動に合わせて自動でずれます
          </div>

          <div style={S.intervalRow}>
            <span style={{ fontSize: 12, color: "#8C929A" }}>トレの間の休み</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="step" onClick={() => setInterval_(data.interval - 1)}>−</button>
              <span style={S.intervalNum}>{data.interval}日</span>
              <button className="step" onClick={() => setInterval_(data.interval + 1)}>＋</button>
            </div>
          </div>

          <div style={S.monthNav}>
            <button className="navBtn" onClick={() => moveMonth(-1)}>‹</button>
            <div style={S.monthLabel}>{year}年 {month + 1}月</div>
            <button className="navBtn" onClick={() => moveMonth(1)}>›</button>
          </div>

          <div style={S.grid}>
            {WEEKDAYS.map((w, i) => (
              <div key={w} style={{ ...S.weekday, color: i===0?"#D97878":i===6?"#7CA3DE":"#8C929A" }}>{w}</div>
            ))}
            {Array.from({ length: startPad }).map((_, i) => <div key={"p"+i} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const k = keyOf(year, month, d);
              const done = data.days[k];
              const planned = queueMap[k];
              const entry = done || planned;
              const isToday = k === todayKey;
              return (
                <button key={k} className={"day"+(isToday?" today":"")} onClick={() => setSelected(k)}>
                  {entry ? (
                    <span className={"plate"+(done?"":" planned")} style={{ "--c": PLAN[entry.type].color }}>
                      {PLAN[entry.type].label}
                    </span>
                  ) : (
                    <span className="dayNum">{d}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={S.legend}>
            <span><i className="dot" style={{ background: PLAN.A.color }} /> A日</span>
            <span><i className="dot" style={{ background: PLAN.B.color }} /> B日</span>
            <span><i className="dot" style={{ background: PLAN.home1.color }} /> 家1(腹)</span>
            <span><i className="dot" style={{ background: PLAN.home2.color }} /> 家2(全身)</span>
            <span><i className="dot ring" /> 予定</span>
          </div>

          <SyncSettings
            status={syncStatus}
            error={syncError}
            configured={gistConnected}
            currentData={data}
            onConnected={refreshFromStore}
            onDisconnect={refreshFromStore}
          />

          <div className="menuCard" style={{ marginTop: 12 }}>
            <div style={{ ...S.menuTitle, borderLeft: "3px solid #8C929A" }}>手動バックアップ</div>
            <div style={{ fontSize: 12, color: "#8C929A", lineHeight: 1.7, marginBottom: 10 }}>
              Gistに繋いでいない間の避難用、または他の形式へ移すときに使ってください。
              「書き出す」でテキスト化してメモアプリなどに保存し、「復元する」に貼り付けて戻せます。
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button className="ghostBtn" style={{ flex: 1 }} onClick={exportBackup}>書き出す</button>
              <button className="ghostBtn" style={{ flex: 1 }} onClick={importBackup}>復元する</button>
            </div>
            <textarea
              ref={backupRef}
              className="backupArea"
              placeholder="書き出したテキストがここに出ます / 復元するときはここに貼り付け"
              value={backupText}
              onChange={(e) => { setBackupText(e.target.value); setBackupMsg(""); }}
              onFocus={(e) => { if (backupText) e.target.select(); }}
            />
            {backupMsg && <div style={{ fontSize: 12, color: "#E8B416", marginTop: 6, lineHeight: 1.6 }}>{backupMsg}</div>}
          </div>
        </section>
      )}

      {/* ===================== プラン ===================== */}
      {tab === "plan" && (
        <section>
          <div style={S.planIntro}>
            サイクル: <b>ジムA → 休 → 家1 → 休 → ジムB → 休 → 家2 → 休</b> の8日周期。
            腹は毎回入り、ハードな日は連続しない。3セットとも上限回数できたら次回 <b>+2.5kg</b>。休憩60〜90秒。
          </div>

          {ORDER.map((key) => {
            const p = PLAN[key];
            return (
              <div key={key} className="menuCard">
                <div style={{ ...S.menuTitle, borderLeft: `3px solid ${p.color}` }}>{p.title}</div>
                {p.items.map((it) => (
                  <div key={it.name} style={S.menuRow}>
                    <div style={{ flex: 1 }}>
                      <div style={S.menuName}>{it.name}</div>
                      <div style={S.menuSets}>{it.sets}</div>
                    </div>
                    <div style={S.menuWeight}>{weightForItem(it, data.equipment)}</div>
                  </div>
                ))}
              </div>
            );
          })}

          <div className="menuCard">
            <div style={{ ...S.menuTitle, borderLeft: "3px solid #B08BD9" }}>腰痛対策ストレッチ(予定外・3〜5分)</div>
            <div style={{ fontSize: 12, color: "#8C929A", lineHeight: 1.6, marginBottom: 8 }}>
              ヨガマットでトレ後か寝る前に。アブローラー・RDLをやった日は特に推奨
            </div>
            {STRETCH.map((it) => (
              <div key={it.name} style={S.menuRow}>
                <div style={{ flex: 1 }}>
                  <div style={S.menuName}>{it.name}</div>
                  <div style={S.menuSets}>{it.sets}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="menuCard">
            <div style={{ ...S.menuTitle, borderLeft: "3px solid #E8B416" }}>食事メモ</div>
            {DIET_TIPS.map((t, i) => (
              <div key={i} style={S.tipRow}>{t}</div>
            ))}
          </div>
        </section>
      )}

      {/* ===================== マシン ===================== */}
      {tab === "weights" && (
        <section>
          <div style={S.addRow}>
            <input style={{ ...S.input, flex: 2 }} placeholder="器具名(例: レッグプレス)" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input style={{ ...S.input, flex: 1, minWidth: 70 }} placeholder="kg" inputMode="decimal" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
            <button className="addBtn" onClick={addEquipment}>追加</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.equipment.map((e) => (
              <div key={e.id} className="card">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.eqName}>{e.name}</div>
                  <div style={S.eqMeta}>更新: {e.updated}</div>
                </div>
                <div style={S.weightCtrl}>
                  <button className="step" onClick={() => changeWeight(e.id, -2.5)}>−</button>
                  <div style={S.weightNum}>{e.weight}<span style={S.kg}>kg</span></div>
                  <button className="step" onClick={() => changeWeight(e.id, +2.5)}>＋</button>
                </div>
                <button className="del" onClick={() => removeEquipment(e.id)} aria-label="削除">✕</button>
              </div>
            ))}
          </div>
          <div style={S.hint}>+/−ボタンで重量を変えると、その場でこのブラウザに保存されます</div>
        </section>
      )}

      {/* ===================== 体重 ===================== */}
      {tab === "body" && (
        <section>
          <div style={S.addRow}>
            <input style={{ ...S.input, flex: 1 }} placeholder="今日の体重 (kg)" inputMode="decimal" value={newBodyW} onChange={(e) => setNewBodyW(e.target.value)} />
            <button className="addBtn" onClick={addBodyWeight}>記録</button>
          </div>

          <WeightChart pts={data.weights.slice(-12)} />
          <div style={S.paceBanner}>{paceMsg}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {[...data.weights].reverse().slice(0, 8).map((w) => (
              <div key={w.date} className="card" style={{ padding: "10px 14px" }}>
                <div style={{ flex: 1, fontSize: 13, color: "#C9CDD2" }}>{w.date.replace(/-/g, "/")}</div>
                <div style={{ ...S.weightNum, fontSize: 22 }}>{w.kg}<span style={S.kg}>kg</span></div>
                <button className="del" onClick={() => removeBodyWeight(w.date)} aria-label="削除">✕</button>
              </div>
            ))}
          </div>
          <div style={S.hint}>週1回・朝イチ・同じ条件で計測。記録するとその場でこのブラウザに保存されます</div>
        </section>
      )}

      {/* ===================== タイマー ===================== */}
      {tab === "timer" && (
        <section style={{ textAlign: "center", paddingTop: 28 }}>
          <div style={S.timerBig}>{restEnd ? restLeft : "—"}</div>
          <div style={{ fontSize: 12, color: "#8C929A", margin: "6px 0 28px" }}>
            {restEnd ? "秒 — 終わったら音とバイブでお知らせ" : "セット間の休憩タイマー"}
          </div>
          <div style={S.rowBtns}>
            <button className="ghostBtn" style={{ flex: 1, padding: "18px 0", fontSize: 16 }} onClick={() => startRest(60)}>60秒</button>
            <button className="ghostBtn" style={{ flex: 1, padding: "18px 0", fontSize: 16 }} onClick={() => startRest(90)}>90秒</button>
            <button className="ghostBtn" style={{ flex: 1, padding: "18px 0", fontSize: 16 }} onClick={() => startRest(120)}>2分</button>
          </div>
          {restEnd && (
            <button className="addBtn" style={{ width: "100%", marginTop: 14, padding: "12px 0" }} onClick={stopRest}>停止</button>
          )}
          <div style={S.hint}>目安: 通常60〜90秒、レッグプレスなど高重量は2分</div>
        </section>
      )}

      {/* ===================== 日付モーダル ===================== */}
      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div style={S.sheetTitle}>{selected.replace(/-/g, "/")}</div>

            {selPlanned && (
              <>
                <div style={S.sheetLabel}>{PLAN[selPlanned.type].title}(予定)</div>
                <div style={{ marginBottom: 12 }}>
                  {PLAN[selPlanned.type].items.map((it) => (
                    <div key={it.name} style={S.menuRow}>
                      <div style={{ flex: 1 }}>
                        <div style={S.menuName}>{it.name}</div>
                        <div style={S.menuSets}>{it.sets}</div>
                      </div>
                      <div style={S.menuWeight}>{weightForItem(it, data.equipment)}</div>
                    </div>
                  ))}
                </div>
                <button className="addBtn" style={{ width: "100%", padding: "12px 0", fontSize: 15 }}
                  onClick={() => { completePlanned(selected); setSelected(null); }}>
                  完了にする 💪
                </button>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="ghostBtn" style={{ flex: 1 }} onClick={() => shiftPlanned(selected, -1)}>← 1日早く</button>
                  <button className="ghostBtn" style={{ flex: 1 }} onClick={() => shiftPlanned(selected, 1)}>1日遅く →</button>
                  <button className="ghostBtn" onClick={() => { skipPlanned(selected); setSelected(null); }}>スキップ</button>
                </div>
                <div style={S.sheetNote}>完了・移動すると、それ以降の予定も間隔を保ったまま自動でずれます</div>
              </>
            )}

            {selDone && (
              <>
                <div style={S.sheetLabel}>完了: {PLAN[selDone.type].title}</div>
                <div style={{ marginBottom: 8 }}>
                  {PLAN[selDone.type].items.map((it) => (
                    <div key={it.name} style={S.menuRow}>
                      <div style={{ flex: 1 }}>
                        <div style={S.menuName}>{it.name}</div>
                        <div style={S.menuSets}>{it.sets}</div>
                      </div>
                      <div style={S.menuWeight}>{weightForItem(it, data.equipment)}</div>
                    </div>
                  ))}
                </div>
                <button className="ghostBtn" style={{ width: "100%" }}
                  onClick={() => { clearDone(selected); setSelected(null); }}>
                  記録を取り消す
                </button>
              </>
            )}

            {!selPlanned && !selDone && (
              <>
                <div style={S.sheetLabel}>この日にやった記録を付ける</div>
                <div style={S.rowBtns}>
                  {ORDER.map((t) => (
                    <button key={t} className="pick" style={{ "--c": PLAN[t].color }}
                      onClick={() => { logDone(selected, t); setSelected(null); }}>
                      {t === "A" || t === "B" ? `ジム${t}` : PLAN[t].label}
                    </button>
                  ))}
                </div>
                {selected >= todayKey && (
                  <button className="ghostBtn" style={{ width: "100%", marginTop: 12 }}
                    onClick={() => { moveNextHere(selected); setSelected(null); }}>
                    次の予定({PLAN[next.type].label})をこの日に移動
                  </button>
                )}
              </>
            )}

            <button className="ghostBtn" style={{ width: "100%", marginTop: 12 }} onClick={() => setSelected(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {restEnd && tab !== "timer" && (
        <button className="restPill" onClick={() => setTab("timer")}>⏱ {restLeft}秒</button>
      )}
    </div>
  );
}

// ---- styles --------------------------------------------------------------
const S = {
  app: { maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#101216", color: "#EDEEF0", padding: "20px 16px 48px", fontFamily: "'Inter','Hiragino Sans','Noto Sans JP',sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 },
  eyebrow: { fontSize: 10, letterSpacing: "0.25em", color: "#E8B416", marginBottom: 2 },
  title: { fontFamily: "'Bebas Neue','Inter',sans-serif", fontSize: 40, lineHeight: 1, margin: 0, letterSpacing: "0.04em" },
  statBox: { textAlign: "right" },
  statNum: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 34, lineHeight: 1, color: "#E8B416" },
  statUnit: { fontSize: 18, color: "#8C929A" },
  statLabel: { fontSize: 11, color: "#8C929A" },
  tabs: { display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid #262A31" },
  nextBanner: { background: "#1A1D22", border: "1px solid #262A31", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#C9CDD2", marginBottom: 10, lineHeight: 1.6 },
  intervalRow: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1A1D22", border: "1px solid #262A31", borderRadius: 10, padding: "8px 12px", marginBottom: 14 },
  intervalNum: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: "#E8B416", minWidth: 34, textAlign: "center" },
  monthNav: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  monthLabel: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: "0.06em" },
  grid: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 },
  weekday: { textAlign: "center", fontSize: 11, paddingBottom: 4 },
  legend: { display: "flex", gap: 12, justifyContent: "center", marginTop: 14, fontSize: 11, color: "#8C929A", flexWrap: "wrap" },
  planIntro: { fontSize: 13, color: "#C9CDD2", lineHeight: 1.7, marginBottom: 14 },
  menuTitle: { fontSize: 14, fontWeight: 700, padding: "2px 0 2px 10px", marginBottom: 8 },
  menuRow: { display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid #22262C" },
  menuName: { fontSize: 14, fontWeight: 600 },
  menuSets: { fontSize: 11.5, color: "#8C929A", marginTop: 1 },
  menuWeight: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 19, color: "#E8B416", whiteSpace: "nowrap" },
  tipRow: { fontSize: 13, color: "#C9CDD2", lineHeight: 1.6, padding: "6px 0", borderBottom: "1px solid #22262C" },
  addRow: { display: "flex", gap: 8, marginBottom: 16 },
  input: { background: "#1A1D22", border: "1px solid #2A2E35", borderRadius: 8, color: "#EDEEF0", padding: "10px 12px", fontSize: 14, width: 0 },
  eqName: { fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  eqMeta: { fontSize: 11, color: "#8C929A", marginTop: 2 },
  weightCtrl: { display: "flex", alignItems: "center", gap: 8 },
  weightNum: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, minWidth: 58, textAlign: "center", color: "#E8B416" },
  kg: { fontSize: 13, color: "#8C929A", marginLeft: 2 },
  hint: { marginTop: 16, fontSize: 12, color: "#8C929A", textAlign: "center" },
  paceBanner: { background: "#1A1D22", border: "1px solid #262A31", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#C9CDD2", marginTop: 10, lineHeight: 1.6 },
  timerBig: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 104, lineHeight: 1, color: "#E8B416" },
  sheetTitle: { fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, letterSpacing: "0.05em", marginBottom: 10 },
  sheetLabel: { fontSize: 11, letterSpacing: "0.15em", color: "#8C929A", margin: "12px 0 6px" },
  sheetNote: { fontSize: 11, color: "#8C929A", marginTop: 8, textAlign: "center" },
  rowBtns: { display: "flex", gap: 8 },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap');

.tab { background:none; border:none; color:#8C929A; font-size:14px; font-weight:600; padding:10px 4px; cursor:pointer; border-bottom:2px solid transparent; font-family:inherit; }
.tab.active { color:#EDEEF0; border-bottom-color:#E8B416; }
.tab:focus-visible, .day:focus-visible, .step:focus-visible, .addBtn:focus-visible,
.navBtn:focus-visible, .del:focus-visible, .pick:focus-visible, .ghostBtn:focus-visible { outline:2px solid #E8B416; outline-offset:2px; }

.navBtn { background:#1A1D22; border:1px solid #2A2E35; color:#EDEEF0; width:34px; height:34px; border-radius:8px; font-size:18px; cursor:pointer; }

.day { aspect-ratio:1; background:#1A1D22; border:1px solid #22262C; border-radius:10px; color:#C9CDD2; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; font-family:inherit; transition:transform .08s ease; }
.day:active { transform:scale(.92); }
.day.today { border-color:#E8B416; }
.dayNum { font-size:13px; }

.plate { width:78%; height:78%; border-radius:50%; display:flex; align-items:center; justify-content:center; background:var(--c); color:#fff; font-weight:700; font-size:12px; box-shadow:inset 0 0 0 3px rgba(255,255,255,.18),0 2px 6px rgba(0,0,0,.45); }
.plate.planned { background:transparent; color:var(--c); box-shadow:none; border:2px dashed var(--c); }

.dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:4px; }
.dot.ring { background:transparent; border:1.5px dashed #8C929A; }

.addBtn { background:#E8B416; color:#14161A; border:none; border-radius:8px; font-weight:700; font-size:14px; padding:0 16px; cursor:pointer; font-family:inherit; }
.ghostBtn { background:none; border:1px solid #2E333A; color:#C9CDD2; border-radius:8px; font-size:13px; padding:10px 12px; cursor:pointer; font-family:inherit; }

.card { display:flex; align-items:center; gap:12px; background:#1A1D22; border:1px solid #262A31; border-radius:12px; padding:12px 14px; }
.menuCard { background:#1A1D22; border:1px solid #262A31; border-radius:12px; padding:14px; margin-bottom:12px; }
.menuCard > div:last-child { border-bottom:none; }

.step { background:#22262C; border:1px solid #2E333A; color:#EDEEF0; width:34px; height:34px; border-radius:8px; font-size:18px; cursor:pointer; }
.del { background:none; border:none; color:#5C626A; font-size:14px; cursor:pointer; padding:6px; }
.del:hover { color:#D97878; }

.overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:flex-end; justify-content:center; z-index:50; }
.sheet { background:#16181D; border:1px solid #2A2E35; border-radius:16px 16px 0 0; width:100%; max-width:480px; padding:18px 16px 24px; max-height:80vh; overflow-y:auto; }

.pick { flex:1; background:#1A1D22; border:1px solid #2E333A; color:#C9CDD2; border-radius:8px; padding:10px 0; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; }
.pick:active { border-color:var(--c); }

.restPill { position:fixed; bottom:18px; left:50%; transform:translateX(-50%); background:#E8B416; color:#14161A; border:none; border-radius:999px; font-family:'Bebas Neue','Inter',sans-serif; font-size:24px; letter-spacing:.04em; padding:10px 24px; cursor:pointer; z-index:60; box-shadow:0 4px 16px rgba(0,0,0,.5); }

.backupArea { width:100%; min-height:80px; box-sizing:border-box; background:#101216; border:1px solid #2A2E35; border-radius:8px; color:#C9CDD2; font-size:11px; padding:8px; font-family:monospace; resize:vertical; }

.gistInput { width:100%; box-sizing:border-box; background:#101216; border:1px solid #2A2E35; border-radius:8px; color:#EDEEF0; font-size:13px; padding:10px 12px; font-family:inherit; margin-bottom:8px; }

@media (prefers-reduced-motion: reduce) { .day { transition:none; } }
`;
