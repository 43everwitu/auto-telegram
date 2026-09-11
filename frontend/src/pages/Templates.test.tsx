import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Templates from "./Templates";
import * as api from "../api";
import { LanguageProvider } from "../i18n";

describe("Templates page", () => {
  it("renders templates fetched from the API", async () => {
    vi.spyOn(api, "apiGet").mockResolvedValue([
      { id: 1, body: "Hello world", is_override: false, target_id: null },
    ]);
    render(
      <MemoryRouter>
        <LanguageProvider>
          <Templates />
        </LanguageProvider>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/Hello world/)).toBeInTheDocument();
    });
  });
});
