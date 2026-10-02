import { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "../api";
import TelegramPreview from "../TelegramPreview";
import { useI18n } from "../i18n";

type Target = {
  id: number;
  account_id: number;
  telegram_chat_id: string;
  type: string;
  title: string;
  active: boolean;
  topic_id: number | null;
};

type Account = {
  id: number;
  phone: string;
};

type Template = {
  id: number;
  body: string;
};

export default function Targets() {
  const { t } = useI18n();
  const [targets, setTargets] = useState<Target[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allTemplates, setAllTemplates] = useState<Template[]>([]);
  const [assigned, setAssigned] = useState<Record<number, Template[]>>({});
  const [accountId, setAccountId] = useState("");
  const [link, setLink] = useState("");
  const [chatId, setChatId] = useState("");
  const [type, setType] = useState("channel");
  const [title, setTitle] = useState("");
  const [topicId, setTopicId] = useState("");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTargetId, setEditingTargetId] = useState<number | null>(null);
  const [expandedTarget, setExpandedTarget] = useState<number | null>(null);
  const [newTemplateBody, setNewTemplateBody] = useState("");
  const [attachSelection, setAttachSelection] = useState("");

  async function refresh() {
    const list = await apiGet<Target[]>("/api/targets");
    setTargets(list);
    await Promise.all(list.map((t) => loadAssigned(t.id)));
  }

  async function refreshAllTemplates() {
    setAllTemplates(await apiGet<Template[]>("/api/templates"));
  }

  async function loadAssigned(targetId: number) {
    const list = await apiGet<Template[]>(`/api/targets/${targetId}/templates`);
    setAssigned((prev) => ({ ...prev, [targetId]: list }));
  }

  useEffect(() => {
    refresh();
    apiGet<Account[]>("/api/accounts").then(setAccounts);
    refreshAllTemplates();
  }, []);

  async function handleLookup() {
    if (!accountId || !link) {
      setError(t("targets.err.lookupMissing"));
      return;
    }
    setResolving(true);
    try {
      const res = await apiPost<{ telegram_chat_id: string; type: string; title: string; topic_id: number | null }>(
        "/api/targets/resolve",
        { account_id: Number(accountId), link }
      );
      setChatId(res.telegram_chat_id);
      setType(res.type);
      setTitle(res.title);
      setTopicId(res.topic_id !== null ? String(res.topic_id) : "");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("targets.err.lookup"));
    } finally {
      setResolving(false);
    }
  }

  function startEditTarget(t: Target) {
    setEditingTargetId(t.id);
    setAccountId(String(t.account_id));
    setChatId(t.telegram_chat_id);
    setType(t.type);
    setTitle(t.title);
    setTopicId(t.topic_id !== null ? String(t.topic_id) : "");
    setLink("");
    setError(null);
  }

  function cancelEditTarget() {
    setEditingTargetId(null);
    setAccountId("");
    setChatId("");
    setType("channel");
    setTitle("");
    setTopicId("");
    setLink("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        account_id: Number(accountId), telegram_chat_id: chatId, type, title,
        topic_id: topicId ? Number(topicId) : null,
      };
      if (editingTargetId) {
        await apiPut(`/api/targets/${editingTargetId}`, payload);
      } else {
        await apiPost("/api/targets", payload);
      }
      cancelEditTarget();
      setError(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("targets.err.save"));
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/targets/${id}`);
      if (editingTargetId === id) cancelEditTarget();
      setError(null);
      await refresh();
    } catch {
      setError(t("targets.err.delete"));
    }
  }

  async function handleToggleActive(id: number, nextActive: boolean) {
    try {
      await apiPatch(`/api/targets/${id}/active?active=${nextActive}`);
      setError(null);
      await refresh();
    } catch {
      setError(t("schedules.err.toggle"));
    }
  }

  function toggleExpanded(targetId: number) {
    if (expandedTarget === targetId) {
      setExpandedTarget(null);
      return;
    }
    setExpandedTarget(targetId);
    setNewTemplateBody("");
    setAttachSelection("");
    loadAssigned(targetId);
  }

  async function handleCreateAndAssign(targetId: number, e: FormEvent) {
    e.preventDefault();
    if (!newTemplateBody.trim()) return;
    try {
      const created = await apiPost<Template>("/api/templates", { body: newTemplateBody });
      await apiPost(`/api/targets/${targetId}/templates`, { template_id: created.id });
      setNewTemplateBody("");
      setError(null);
      await refreshAllTemplates();
      await loadAssigned(targetId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("targets.err.createTemplate"));
    }
  }

  async function handleUnassign(targetId: number, templateId: number) {
    try {
      await apiDelete(`/api/targets/${targetId}/templates/${templateId}`);
      setError(null);
      await loadAssigned(targetId);
    } catch {
      setError(t("targets.err.unassign"));
    }
  }

  async function handleAttachTemplate(targetId: number) {
    if (!attachSelection) return;
    try {
      await apiPost(`/api/targets/${targetId}/templates`, { template_id: Number(attachSelection) });
      setAttachSelection("");
      setError(null);
      await loadAssigned(targetId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("targets.err.attach"));
    }
  }

  function accountLabel(accountId: number): string {
    const a = accounts.find((x) => x.id === accountId);
    return a ? a.phone : `#${accountId}`;
  }

  return (
    <>
      <div className="page-header">
        <h1>{t("targets.title")}</h1>
      </div>

      <div className="card">
        {error && <p role="alert">{error}</p>}
        {editingTargetId && (
          <p className="hint">{t("targets.editing", { id: editingTargetId })}{" "}
            <button className="btn btn-outline" type="button" onClick={cancelEditTarget}>{t("targets.cancelEdit")}</button>
          </p>
        )}
        <form className="form" onSubmit={handleSubmit}>
          <div>
            <label className="field-label" htmlFor="target-account">{t("targets.form.account")}</label>
            <select
              id="target-account"
              className="input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">{t("targets.form.accountPlaceholder")}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.phone} (id {a.id})</option>
              ))}
            </select>
          </div>

          <p className="hint">{t("targets.lookup.hint")}</p>
          <div className="form-row">
            <input
              className="input"
              placeholder={t("targets.lookup.placeholder")}
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            <button className="btn btn-outline" type="button" onClick={handleLookup} disabled={resolving}>
              {resolving ? t("targets.lookup.loading") : t("targets.lookup.button")}
            </button>
          </div>

          <div className="form-row">
            <input
              className="input"
              placeholder={t("targets.form.chatId")}
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
            />
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="channel">{t("targets.form.type.channel")}</option>
              <option value="group">{t("targets.form.type.group")}</option>
            </select>
            <input
              className="input"
              placeholder={t("targets.form.title")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="target-topic">{t("targets.form.topicId")}</label>
            <input
              id="target-topic"
              className="input"
              type="number"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
            />
            <p className="hint">{t("targets.form.topicHint")}</p>
          </div>
          <div className="form-row">
            <button className="btn btn-primary" type="submit">
              {editingTargetId ? t("targets.form.save") : t("targets.form.add")}
            </button>
          </div>
        </form>
      </div>

      <p className="hint">
        {t("targets.hint.mainBefore")} <Link className="nav-link" to="/templates">{t("nav.templates")}</Link>
        {t("targets.hint.mainAfter")}
      </p>

      <ul className="list">
        {targets.map((t2) => {
          const ownTemplates = assigned[t2.id] ?? [];
          const attachable = allTemplates.filter((tpl) => !ownTemplates.some((o) => o.id === tpl.id));
          const expanded = expandedTarget === t2.id;
          return (
            <li key={t2.id} className={`card-soft${t2.active ? " is-running" : ""}`}>
              <div className="page-header">
                <div>
                  <div className="list-row-main">
                    <strong>#{t2.id} {t2.title}</strong>{" "}
                    <span className="badge badge-muted">
                      {t2.type === "channel" ? t("targets.form.type.channel") : t("targets.form.type.group")}
                    </span>{" "}
                    {t2.topic_id !== null && (
                      <span className="badge badge-muted">{t("targets.topic", { id: t2.topic_id })}</span>
                    )}
                  </div>
                  <div className="toggle-row" style={{ marginTop: "var(--space-xxs)" }}>
                    <span className={`toggle-label ${t2.active ? "is-on" : "is-off"}`}>
                      {t2.active ? t("schedules.running") : t("schedules.paused")}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={t2.active}
                      className="toggle"
                      onClick={() => handleToggleActive(t2.id, !t2.active)}
                      title={t2.active ? t("schedules.pause") : t("schedules.resume")}
                    >
                      <span className="toggle-knob" />
                    </button>
                  </div>
                  <p className="hint" style={{ margin: 0 }}>
                    {t("targets.account")} <strong>{accountLabel(t2.account_id)}</strong> · chat_id{" "}
                    {t2.telegram_chat_id} ·{" "}
                    <span className={`badge ${ownTemplates.length > 0 ? "badge-accent" : "badge-muted"}`}>
                      {t(ownTemplates.length === 1 ? "targets.templateCountOne" : "targets.templateCountOther", {
                        count: ownTemplates.length,
                      })}
                    </span>
                  </p>
                </div>
                <div className="form-row" style={{ flex: "0 0 auto" }}>
                  <button className="btn btn-outline" onClick={() => toggleExpanded(t2.id)}>
                    {expanded ? t("targets.hide") : t("targets.manage")} {expanded ? "▲" : "▼"}
                  </button>
                  <button className="btn btn-outline" onClick={() => startEditTarget(t2)}>{t("targets.edit")}</button>
                  <button className="btn btn-danger" onClick={() => handleDelete(t2.id)}>{t("targets.delete")}</button>
                </div>
              </div>

              {expanded && (
                <div className="form">
                  {ownTemplates.length === 0 && (
                    <p className="hint">{t("targets.noTemplate")}</p>
                  )}
                  {ownTemplates.length > 0 && (
                    <div className="form">
                      {ownTemplates.map((tpl) => (
                        <div key={tpl.id} className="card">
                          <span className="hint">#{tpl.id}</span>
                          <TelegramPreview body={tpl.body} />
                          <div className="form-row" style={{ flex: "0 0 auto" }}>
                            <button className="btn btn-outline" onClick={() => handleUnassign(t2.id, tpl.id)}>
                              {t("targets.removeFromTarget")}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {attachable.length > 0 && (
                    <div className="form-row">
                      <select
                        className="input"
                        value={attachSelection}
                        onChange={(e) => setAttachSelection(e.target.value)}
                      >
                        <option value="">{t("targets.attachPlaceholder")}</option>
                        {attachable.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            #{tpl.id} {tpl.body.slice(0, 60)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-outline"
                        type="button"
                        disabled={!attachSelection}
                        onClick={() => handleAttachTemplate(t2.id)}
                      >
                        {t("targets.attach")}
                      </button>
                    </div>
                  )}

                  <form className="form-row" onSubmit={(e) => handleCreateAndAssign(t2.id, e)}>
                    <textarea
                      className="input"
                      placeholder={t("targets.createPlaceholder")}
                      value={newTemplateBody}
                      onChange={(e) => setNewTemplateBody(e.target.value)}
                    />
                    <button className="btn btn-primary" type="submit">{t("targets.createAndAttach")}</button>
                  </form>
                  <p className="hint">
                    {t("targets.removeHintBefore")}{" "}
                    <Link className="nav-link" to="/templates">{t("nav.templates")}</Link>
                    {t("targets.removeHintAfter")}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
