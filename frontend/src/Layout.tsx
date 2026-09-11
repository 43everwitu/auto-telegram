import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useI18n, TKey } from "./i18n";
import Logo from "./Logo";

const links: { to: string; key: TKey }[] = [
  { to: "/accounts", key: "nav.accounts" },
  { to: "/targets", key: "nav.targets" },
  { to: "/templates", key: "nav.templates" },
  { to: "/schedules", key: "nav.schedules" },
  { to: "/logs", key: "nav.logs" },
];

export default function Layout() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();

  function handleLogout() {
    localStorage.removeItem("access_token");
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <nav className="nav-pill">
        <span className="brand">
          <Logo size={24} />
          {t("nav.brand")}
        </span>
        <div className="nav-links">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              {t(link.key)}
            </NavLink>
          ))}
        </div>
        <div className="segmented" aria-label="Language">
          <button
            type="button"
            className={lang === "vi" ? "active" : ""}
            onClick={() => setLang("vi")}
            title="Tiếng Việt"
          >
            🇻🇳 VI
          </button>
          <button
            type="button"
            className={lang === "en" ? "active" : ""}
            onClick={() => setLang("en")}
            title="English"
          >
            🇬🇧 EN
          </button>
        </div>
        <button className="btn btn-primary" onClick={handleLogout}>
          {t("nav.logout")}
        </button>
      </nav>
      <div className="page">
        <Outlet />
      </div>
    </div>
  );
}
