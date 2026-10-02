import { useEffect, useState, FormEvent } from "react";
import { apiGet, apiPost, apiDelete } from "../api";
import { useI18n } from "../i18n";

type Account = {
  id: number;
  phone: string;
  telegram_premium: boolean;
  status: string;
};

type Mode = "phone" | "session";

export default function Accounts() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [mode, setMode] = useState<Mode>("phone");
  const [sessionString, setSessionString] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [twoFaPassword, setTwoFaPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setAccounts(await apiGet<Account[]>("/api/accounts"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    try {
      await apiPost("/api/accounts/otp/start", { phone });
      setCodeSent(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("accounts.err.sendCode"));
    }
  }

  async function handleConfirmCode(e: FormEvent) {
    e.preventDefault();
    try {
      await apiPost("/api/accounts/otp/confirm", {
        phone,
        code,
        password: twoFaPassword || null,
      });
      setPhone("");
      setCode("");
      setTwoFaPassword("");
      setCodeSent(false);
      setError(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("accounts.err.confirm"));
    }
  }

  async function handleSessionStringSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await apiPost("/api/accounts/session-string", { session_string: sessionString });
      setSessionString("");
      setError(null);
      await refresh();
    } catch {
      setError(t("accounts.err.add"));
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/accounts/${id}`);
      setError(null);
      await refresh();
    } catch {
      setError(t("accounts.err.delete"));
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>{t("accounts.title")}</h1>
      </div>

      <div className="card">
        <div className="segmented">
          <button
            type="button"
            className={mode === "phone" ? "active" : ""}
            onClick={() => setMode("phone")}
          >
            {t("accounts.tab.phone")}
          </button>
          <button
            type="button"
            className={mode === "session" ? "active" : ""}
            onClick={() => setMode("session")}
          >
            {t("accounts.tab.session")}
          </button>
        </div>

        {error && <p role="alert">{error}</p>}

        {mode === "phone" && !codeSent && (
          <form className="form" onSubmit={handleSendCode}>
            <p className="hint">{t("accounts.phone.hint")}</p>
            <div>
              <label className="field-label" htmlFor="phone">{t("accounts.phone.label")}</label>
              <input
                id="phone"
                className="input"
                placeholder="+84901234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit">{t("accounts.phone.send")}</button>
          </form>
        )}

        {mode === "phone" && codeSent && (
          <form className="form" onSubmit={handleConfirmCode}>
            <p className="hint">{t("accounts.code.hint", { phone })}</p>
            <div>
              <label className="field-label" htmlFor="code">{t("accounts.code.label")}</label>
              <input
                id="code"
                className="input"
                placeholder="12345"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="twofa">{t("accounts.twofa.label")}</label>
              <input
                id="twofa"
                className="input"
                type="password"
                placeholder={t("accounts.twofa.optional")}
                value={twoFaPassword}
                onChange={(e) => setTwoFaPassword(e.target.value)}
              />
            </div>
            <div className="form-row">
              <button className="btn btn-primary" type="submit">{t("accounts.confirm")}</button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => {
                  setCodeSent(false);
                  setCode("");
                  setTwoFaPassword("");
                }}
              >
                {t("accounts.back")}
              </button>
            </div>
          </form>
        )}

        {mode === "session" && (
          <form className="form" onSubmit={handleSessionStringSubmit}>
            <p className="hint">{t("accounts.session.hint")}</p>
            <input
              className="input"
              placeholder={t("accounts.session.placeholder")}
              value={sessionString}
              onChange={(e) => setSessionString(e.target.value)}
            />
            <button className="btn btn-primary" type="submit">{t("accounts.session.submit")}</button>
          </form>
        )}
      </div>

      <ul className="list">
        {accounts.map((a) => {
          const isActive = a.status === "active";
          const isBanned = a.status === "banned";
          return (
            <li
              key={a.id}
              className={`card-soft${isActive ? " is-running" : ""}${isBanned ? " is-error" : ""}`}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <span className="list-row-main">
                {a.phone}{" "}
                <span className={`badge ${isBanned ? "badge-danger" : isActive ? "badge-accent" : "badge-muted"}`}>
                  {a.status}
                </span>{" "}
                {a.telegram_premium && <span className="badge badge-accent">{t("accounts.premium")}</span>}
              </span>
              <button className="btn btn-danger" onClick={() => handleDelete(a.id)}>{t("accounts.delete")}</button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
