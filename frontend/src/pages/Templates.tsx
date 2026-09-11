import { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost, apiPut, apiDelete } from "../api";
import TelegramPreview from "../TelegramPreview";
import { useI18n } from "../i18n";

type Template = {
  id: number;
  body: string;
};

type Account = {
  id: number;
  phone: string;
};

export default function Templates() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importAccountId, setImportAccountId] = useState("");
  const [importLink, setImportLink] = useState("");
  const [importing, setImporting] = useState(false);

  async function refresh() {
    setTemplates(await apiGet<Template[]>("/api/templates"));
  }

  useEffect(() => {
    refresh();
    apiGet<Account[]>("/api/accounts").then(setAccounts);
  }, []);

  function startEdit(tpl: Template) {
    setEditingId(tpl.id);
    setBody(tpl.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setBody("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      if (editingId) {
        await apiPut(`/api/templates/${editingId}`, { body });
      } else {
        await apiPost("/api/templates", { body });
      }
      cancelEdit();
      setError(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("templates.err.save"));
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/templates/${id}`);
      if (editingId === id) cancelEdit();
      setError(null);
      await refresh();
    } catch {
      setError(t("templates.err.delete"));
    }
  }

  async function handleImport() {
    if (!importAccountId || !importLink) {
      setError(t("templates.err.importMissing"));
      return;
    }
    setImporting(true);
    try {
      const res = await apiPost<{ body: string }>("/api/templates/import-from-message", {
        account_id: Number(importAccountId),
        message_link: importLink,
      });
      setBody(res.body);
      setEditingId(null);
      setImportLink("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("templates.err.import"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>{t("templates.title")}</h1>
      </div>

      <div className="card">
        {error && <p role="alert">{error}</p>}
        <p className="hint">
          {t("templates.hintBefore")} <Link className="nav-link" to="/targets">{t("nav.targets")}</Link>{" "}
          {t("templates.hintAfter")}
        </p>

        <h3>{t("templates.importTitle")}</h3>
        <p className="hint">{t("templates.importHint")}</p>
        <div className="form">
          <div>
            <label className="field-label" htmlFor="import-account">{t("templates.importAccount")}</label>
            <select
              id="import-account"
              className="input"
              value={importAccountId}
              onChange={(e) => setImportAccountId(e.target.value)}
            >
              <option value="">{t("targets.form.accountPlaceholder")}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.phone} (id {a.id})</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <input
              className="input"
              placeholder={t("templates.importLink")}
              value={importLink}
              onChange={(e) => setImportLink(e.target.value)}
            />
            <button className="btn btn-outline" type="button" onClick={handleImport} disabled={importing}>
              {importing ? t("templates.importing") : t("templates.importButton")}
            </button>
          </div>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <textarea
            className="input"
            placeholder={t("templates.placeholder")}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {body.trim() && (
            <div>
              <label className="field-label">{t("templates.preview")}</label>
              <TelegramPreview body={body} />
            </div>
          )}
          <div className="form-row">
            <button className="btn btn-primary" type="submit">
              {editingId ? t("templates.save") : t("templates.add")}
            </button>
            {editingId && (
              <button className="btn btn-outline" type="button" onClick={cancelEdit}>{t("templates.cancel")}</button>
            )}
          </div>
        </form>
      </div>

      <div className="form">
        {templates.map((tpl) => (
          <div key={tpl.id} className="card">
            <span className="hint">#{tpl.id}</span>
            <TelegramPreview body={tpl.body} />
            <div className="form-row" style={{ flex: "0 0 auto" }}>
              <button className="btn btn-outline" onClick={() => startEdit(tpl)}>{t("templates.edit")}</button>
              <button className="btn btn-danger" onClick={() => handleDelete(tpl.id)}>{t("templates.delete")}</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
