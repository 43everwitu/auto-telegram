import { useEffect, useState, FormEvent } from "react";
import { apiGet, apiPost, apiDelete } from "../api";

type Account = {
  id: number;
  phone: string;
  telegram_premium: boolean;
  status: string;
};

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sessionString, setSessionString] = useState("");

  async function refresh() {
    setAccounts(await apiGet<Account[]>("/api/accounts"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSessionStringSubmit(e: FormEvent) {
    e.preventDefault();
    await apiPost("/api/accounts/session-string", { session_string: sessionString });
    setSessionString("");
    await refresh();
  }

  async function handleDelete(id: number) {
    await apiDelete(`/api/accounts/${id}`);
    await refresh();
  }

  return (
    <div>
      <h1>Accounts</h1>
      <form onSubmit={handleSessionStringSubmit}>
        <input
          placeholder="Session string"
          value={sessionString}
          onChange={(e) => setSessionString(e.target.value)}
        />
        <button type="submit">Add via session string</button>
      </form>
      <ul>
        {accounts.map((a) => (
          <li key={a.id}>
            {a.phone} — {a.status} {a.telegram_premium ? "(Premium)" : ""}
            <button onClick={() => handleDelete(a.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
