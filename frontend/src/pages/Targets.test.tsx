import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Targets from "./Targets";
import * as api from "../api";

describe("Targets page", () => {
  it("renders targets fetched from the API", async () => {
    vi.spyOn(api, "apiGet").mockResolvedValue([
      { id: 1, account_id: 1, telegram_chat_id: "-100", type: "channel", title: "My Channel", active: true },
    ]);
    render(<Targets />);
    await waitFor(() => {
      expect(screen.getByText(/My Channel/)).toBeInTheDocument();
    });
  });
});
