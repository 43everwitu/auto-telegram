import { useEffect, useState, FormEvent } from "react";
import { apiGet, apiPut, apiPost, apiPatch, apiDelete } from "../api";
import { useI18n, TKey } from "../i18n";

type ScheduleConfig = {
  id: number;
  target_id: number;
  messages_per_day: number;
  window_start: string;
  window_end: string;
  min_gap_minutes: number;
  next_send_at: string | null;
};

type Target = {
  id: number;
  title: string;
  type: string;
  active: boolean;
};

type TestResult = {
  status: string;
  error_message: string | null;
};

function formatRelative(iso: string | null, t: (key: TKey, vars?: Record<string, string | number>) => string): string | null {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return t("time.now");
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return t("time.now");
  if (minutes < 60) return t("time.minutes", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hours", { n: hours, m: minutes % 60 });
  const days = Math.floor(hours / 24);
  return t("time.days", { n: days });
}

export default function Schedules() {
  const { t } = useI18n();
  const [schedules, setSchedules] = useState<ScheduleConfig[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState("");
  const [messagesPerDay, setMessagesPerDay] = useState("3");
  const [windowStart, setWindowStart] = useState("08:00");
  const [windowEnd, setWindowEnd] = useState("22:00");
  const [minGap, setMinGap] = useState("30");
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, TestResult>>({});
  const [editingTargetId, setEditingTargetId] = useState<number | null>(null);

  async function refresh() {
    setSchedules(await apiGet<ScheduleConfig[]>("/api/schedules"));
  }

  useEffect(() => {
    refresh();
    apiGet<Target[]>("/api/targets").then(setTargets);
  }, []);

  function targetLabel(id: number): string {
    const target = targets.find((x) => x.id === id && x.title);
    return target ? `${target.title} (${target.type})` : `#${id}`;
  }

  function isTargetActive(id: number): boolean {
    const target = targets.find((x) => x.id === id);
    return target ? target.active : true;
  }

  async function handleToggleActive(target_id: number, nextActive: boolean) {
    try {
      await apiPatch(`/api/targets/${target_id}/active?active=${nextActive}`);
      setError(null);
      apiGet<Target[]>("/api/targets").then(setTargets);
      await refresh();
    } catch {
      setError(t("schedules.err.toggle"));
    }
  }

  function resetForm() {
    setEditingTargetId(null);
    setTargetId("");
    setMessagesPerDay("3");
    setWindowStart("08:00");
    setWindowEnd("22:00");
    setMinGap("30");
  }

  function startEdit(s: ScheduleConfig) {
    setEditingTargetId(s.target_id);
    setTargetId(String(s.target_id));
    setMessagesPerDay(String(s.messages_per_day));
    setWindowStart(s.window_start);
    setWindowEnd(s.window_end);
    setMinGap(String(s.min_gap_minutes));
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const id = Number(targetId);
    try {
      await apiPut(`/api/schedules/${id}`, {
        target_id: id,
        messages_per_day: Number(messagesPerDay),
        window_start: windowStart,
        window_end: windowEnd,
        min_gap_minutes: Number(minGap),
      });
      resetForm();
      setError(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("schedules.err.save"));
    }
  }

  async function handleDelete(target_id: number) {
    try {
      await apiDelete(`/api/schedules/${target_id}`);
      if (editingTargetId === target_id) resetForm();
      setError(null);
      await refresh();
    } catch {
      setError(t("schedules.err.delete"));
    }
  }

  async function handleTestSend(target_id: number) {
    setTestingId(target_id);
    try {
      const res = await apiPost<TestResult & { sent_at: string }>(
        `/api/targets/${target_id}/test-send`,
        {}
      );
      setTestResults((prev) => ({ ...prev, [target_id]: res }));
    } catch (e) {
      setTestResults((prev) => ({
        ...prev,
        [target_id]: { status: "failed", error_message: e instanceof Error ? e.message : null },
      }));
    } finally {
      setTestingId(null);
    }
  }

  function renderTestResult(target_id: number) {
    const result = testResults[target_id];
    if (!result) return null;
    const ok = result.status === "success";
    return (
      <p role={ok ? undefined : "alert"} className={ok ? "hint" : ""}>
        {ok
          ? t("schedules.testOk")
          : t("schedules.testFail", { error: result.error_message ?? t("schedules.unknownError") })}
      </p>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>{t("schedules.title")}</h1>
      </div>

      <div className="card">
        {error && <p role="alert">{error}</p>}
        {editingTargetId !== null && (
          <p className="hint">
            {t("schedules.editing", { id: editingTargetId })}{" "}
            <button className="btn btn-outline" type="button" onClick={resetForm}>{t("schedules.cancelEdit")}</button>
          </p>
        )}
        <form className="form" onSubmit={handleSubmit}>
          <div>
            <label className="field-label" htmlFor="schedule-target">{t("schedules.target")}</label>
            <select
              id="schedule-target"
              className="input"
              value={targetId}
              disabled={editingTargetId !== null}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">{t("schedules.targetPlaceholder")}</option>
              {targets.map((tg) => (
                <option key={tg.id} value={tg.id}>
                  #{tg.id} {tg.title} ({tg.type}){!tg.active ? ` — ${t("targets.inactive")}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div>
              <label className="field-label" htmlFor="schedule-count">{t("schedules.perDay")}</label>
              <input
                id="schedule-count"
                className="input"
                type="number"
                min={1}
                value={messagesPerDay}
                onChange={(e) => setMessagesPerDay(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="schedule-start">{t("schedules.windowStart")}</label>
              <input
                id="schedule-start"
                className="input"
                type="time"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="schedule-end">{t("schedules.windowEnd")}</label>
              <input
                id="schedule-end"
                className="input"
                type="time"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="schedule-gap">{t("schedules.minGap")}</label>
              <input
                id="schedule-gap"
                className="input"
                type="number"
                min={0}
                value={minGap}
                onChange={(e) => setMinGap(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <button className="btn btn-primary" type="submit">{t("schedules.save")}</button>
            <button
              className="btn btn-outline"
              type="button"
              disabled={!targetId || testingId !== null}
              onClick={() => handleTestSend(Number(targetId))}
            >
              {testingId === Number(targetId) ? t("schedules.sending") : t("schedules.sendTest")}
            </button>
          </div>
          {targetId && renderTestResult(Number(targetId))}
        </form>
      </div>

      <ul className="list">
        {schedules.map((s) => {
          const relative = formatRelative(s.next_send_at, t);
          const active = isTargetActive(s.target_id);
          return (
            <li key={s.id} className={`card-soft${active ? " is-running" : ""}`}>
              <div className="page-header">
                <span className="list-row-main">
                  <strong>{targetLabel(s.target_id)}</strong>{" "}
                  <span className="badge badge-muted">#{s.target_id}</span>
                </span>
                <div className="form-row" style={{ flex: "0 0 auto", alignItems: "center" }}>
                  <div className="toggle-row">
                    <span className={`toggle-label ${active ? "is-on" : "is-off"}`}>
                      {active ? t("schedules.running") : t("schedules.paused")}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={active}
                      className="toggle"
                      onClick={() => handleToggleActive(s.target_id, !active)}
                      title={active ? t("schedules.pause") : t("schedules.resume")}
                    >
                      <span className="toggle-knob" />
                    </button>
                  </div>
                  <button
                    className="btn btn-outline"
                    disabled={testingId !== null}
                    onClick={() => handleTestSend(s.target_id)}
                  >
                    {testingId === s.target_id ? t("schedules.sending") : t("schedules.sendTest")}
                  </button>
                  <button className="btn btn-outline" onClick={() => startEdit(s)}>{t("schedules.edit")}</button>
                  <button className="btn btn-danger" onClick={() => handleDelete(s.target_id)}>{t("schedules.delete")}</button>
                </div>
              </div>
              <div className="form-row">
                <span className="badge badge-accent">{t("schedules.msgsPerDay", { count: s.messages_per_day })}</span>
                <span className="badge badge-muted">{s.window_start}–{s.window_end}</span>
                <span className="badge badge-muted">{t("schedules.gap", { minutes: s.min_gap_minutes })}</span>
                <span className="badge badge-accent">
                  {active && relative ? t("schedules.nextSend", { time: relative }) : t("schedules.nextSendNone")}
                </span>
              </div>
              {renderTestResult(s.target_id)}
            </li>
          );
        })}
      </ul>
    </>
  );
}
