import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthGuard from "./AuthGuard";
import Layout from "./Layout";
import Login from "./pages/Login";
import Accounts from "./pages/Accounts";
import Targets from "./pages/Targets";
import Templates from "./pages/Templates";
import Schedules from "./pages/Schedules";
import Logs from "./pages/Logs";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AuthGuard />}>
          <Route element={<Layout />}>
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/targets" element={<Targets />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/logs" element={<Logs />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/accounts" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
