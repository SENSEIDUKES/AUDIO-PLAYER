/** @vitest-environment jsdom */
import { describe, expect, it, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { registerVisualComponent } from "../visualRegistry";
import { VisualSlotsProvider, useVisualSlots } from "../VisualSlotsContext";
import type { VisualComponentDefinition } from "../types";

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Register a test component with default settings
const testComponentDef: VisualComponentDefinition = {
  id: "test-component",
  name: "Test Component",
  slot: "seiCanvas",
  Component: () => null,
  defaultSettings: { mode: "active", speed: 5 },
};

registerVisualComponent(testComponentDef);

function TestConsumer() {
  const slots = useVisualSlots();
  return (
    <div>
      <div data-testid="active">{slots.getActive("seiCanvas")}</div>
      <div data-testid="settings">
        {JSON.stringify(slots.getSettings("test-component"))}
      </div>
      <button
        data-testid="update-btn"
        onClick={() => slots.updateSettings("test-component", { speed: 10 })}
      >
        Update Settings
      </button>
      <button
        data-testid="set-active-btn"
        onClick={() => slots.setActive("seiCanvas", "test-component")}
      >
        Set Active
      </button>
    </div>
  );
}

describe("VisualSlotsContext", () => {
  it("provides active slots and default/updated settings", () => {
    const { getByTestId } = render(
      <VisualSlotsProvider>
        <TestConsumer />
      </VisualSlotsProvider>,
    );

    // Verify initial settings are the registered defaults (retrieved via getDefaultsFor)
    const settingsDiv = getByTestId("settings");
    expect(settingsDiv.textContent).toContain('"mode":"active"');
    expect(settingsDiv.textContent).toContain('"speed":5');

    // Update settings and verify
    const updateBtn = getByTestId("update-btn");
    act(() => {
      updateBtn.click();
    });
    expect(settingsDiv.textContent).toContain('"speed":10');

    // Verify initial active slot and change active slot
    const activeDiv = getByTestId("active");
    // Initially null or whatever the default is for the slot
    const setActiveBtn = getByTestId("set-active-btn");
    act(() => {
      setActiveBtn.click();
    });
    expect(activeDiv.textContent).toBe("test-component");
  });

  it("handles fallback gracefully when no provider is mounted", () => {
    const { getByTestId } = render(<TestConsumer />);
    // Fallback should still retrieve default settings via getDefaultsFor
    const settingsDiv = getByTestId("settings");
    expect(settingsDiv.textContent).toContain('"mode":"active"');
    expect(settingsDiv.textContent).toContain('"speed":5');
  });
});
