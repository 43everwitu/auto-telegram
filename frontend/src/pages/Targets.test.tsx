import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Targets from "./Targets";
import * as api from "../api";
import { LanguageProvider } from "../i18n";

describe("Targets page", () => {
  it("renders targets fetched from the API", async () => {
    vi.spyOn(api, "apiGet").mockResolvedValue([
      { id: 1, account_id: 1, telegram_chat_id: "-100", type: "channel", title: "My Channel", active: true },
    ]);
    render(
      <MemoryRouter>
        <LanguageProvider>
          <Targets />
        </LanguageProvider>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/My Channel/)).toBeInTheDocument();
    });
  });
});
