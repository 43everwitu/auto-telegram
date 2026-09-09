import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Templates from "./Templates";
import * as api from "../api";

describe("Templates page", () => {
  it("renders templates fetched from the API", async () => {
    vi.spyOn(api, "apiGet").mockResolvedValue([
      { id: 1, body: "Hello world", is_override: false, target_id: null },
    ]);
    render(<Templates />);
    await waitFor(() => {
      expect(screen.getByText(/Hello world/)).toBeInTheDocument();
    });
  });
});
