import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api";
import { useI18n } from "../i18n";
import Logo from "../Logo";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(username, password);
      navigate("/accounts");
    } catch {
      setError(t("login.error"));
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="page-header">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
            <Logo size={32} />
            <h1>{t("nav.brand")}</h1>
          </div>
          <div className="segmented" aria-label="Language">
            <button type="button" className={lang === "vi" ? "active" : ""} onClick={() => setLang("vi")}>
              🇻🇳 VI
            </button>
            <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
              🇬🇧 EN
            </button>
          </div>
        </div>
        <div className="form">
          <input
            className="input"
            placeholder={t("login.username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder={t("login.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button className="btn btn-primary" type="submit">
          {t("login.submit")}
        </button>
      </form>
    </div>
  );
}
