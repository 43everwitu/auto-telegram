import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Login from "./Login";
import * as api from "../api";
import { LanguageProvider } from "../i18n";

describe("Login page", () => {
  it("shows an error message on failed login", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new Error("bad creds"));
    render(
      <MemoryRouter>
        <LanguageProvider>
          <Login />
        </LanguageProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("Tên đăng nhập"), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText("Mật khẩu"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByText("Đăng nhập"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
