/** @vitest-environment jsdom */
import { render, screen, act, cleanup } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";
import React from "react";
import { VisualSlotsProvider, useVisualSlots } from "../VisualSlotsContext";
import { registerVisualComponent } from "../visualRegistry";
import type { VisualComponentDefinition } from "../types";

// Create and register a test component
const testComponentDef: VisualComponentDefinition<{
  themeColor: string;
  density: number;
}> = {
  id: "test-component-id",
  name: "Test Component",
  slot: "seiCanvas",
  Component: () => null,
  defaultSettings: { themeColor: "#ff0000", density: 4 },
};

registerVisualComponent(testComponentDef);

// Test consumer component
function TestConsumer() {
  const { getActive, setActive, getSettings, updateSettings } =
    useVisualSlots();

  return (
    <div>
      <span data-testid="active-canvas">{getActive("seiCanvas")}</span>
      <span data-testid="test-theme">
        {String(getSettings("test-component-id").themeColor)}
      </span>
      <span data-testid="test-density">
        {String(getSettings("test-component-id").density)}
      </span>
      <button
        data-testid="btn-set-active"
        onClick={() => setActive("seiCanvas", "test-component-id")}
      >
        Set Active
      </button>
      <button
        data-testid="btn-update-settings"
        onClick={() =>
          updateSettings("test-component-id", { themeColor: "#0000ff" })
        }
      >
        Update Settings
      </button>
    </div>
  );
}

describe("VisualSlotsContext and useVisualSlots", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses FALLBACK values when no provider is mounted", () => {
    render(<TestConsumer />);
    expect(screen.getByTestId("active-canvas").textContent).not.toBeNull();
    expect(screen.getByTestId("test-theme").textContent).toBe("#ff0000");
  });

  it("functions correctly with VisualSlotsProvider", () => {
    render(
      <VisualSlotsProvider>
        <TestConsumer />
      </VisualSlotsProvider>,
    );

    // Initial value
    expect(screen.getByTestId("test-theme").textContent).toBe("#ff0000");
    expect(screen.getByTestId("test-density").textContent).toBe("4");

    // Change active component
    act(() => {
      screen.getByTestId("btn-set-active").click();
    });
    expect(screen.getByTestId("active-canvas").textContent).toBe(
      "test-component-id",
    );

    // Update settings
    act(() => {
      screen.getByTestId("btn-update-settings").click();
    });
    expect(screen.getByTestId("test-theme").textContent).toBe("#0000ff");
    expect(screen.getByTestId("test-density").textContent).toBe("4"); // preserved
  });
});
