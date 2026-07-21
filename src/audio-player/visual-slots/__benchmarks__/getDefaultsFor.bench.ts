import { bench, describe } from "vitest";
import {
  registerVisualComponent,
  getAllVisualComponents,
  getVisualComponent,
} from "../visualRegistry";
import type { VisualComponentDefinition } from "../types";

const COMPONENT_COUNT = 1000;
const SLOTS = ["seiCanvas", "scrubberCanvas", "controllerPanel"] as const;

// Helper to create a dummy component definition
function createDef(
  id: string,
  slot: (typeof SLOTS)[number],
): VisualComponentDefinition {
  return {
    id,
    name: `Component ${id}`,
    slot,
    Component: () => null,
    defaultSettings: { someKey: `value-${id}` },
  };
}

// Register many components to make O(N) visible
for (let i = 0; i < COMPONENT_COUNT; i++) {
  registerVisualComponent(createDef(`comp-${i}`, "seiCanvas"));
}

const targetId = `comp-${COMPONENT_COUNT - 1}`; // Last component to maximize O(N) scan time

// Simulate the baseline (O(N) getAllVisualComponents loop)
function baselineGetDefaultsFor(
  id: string,
): Record<string, unknown> | undefined {
  for (const def of getAllVisualComponents()) {
    if (def.id === id) {
      return { ...(def.defaultSettings as Record<string, unknown>) };
    }
  }
  return undefined;
}

// Simulate the optimized (O(1) getVisualComponent Map lookup)
function optimizedGetDefaultsFor(
  id: string,
): Record<string, unknown> | undefined {
  const def = getVisualComponent(id);
  if (def) {
    return { ...(def.defaultSettings as Record<string, unknown>) };
  }
  return undefined;
}

describe("getDefaultsFor Performance comparison", () => {
  bench("Baseline: O(N) search using getAllVisualComponents()", () => {
    baselineGetDefaultsFor(targetId);
  });

  bench("Optimized: O(1) search using getVisualComponent()", () => {
    optimizedGetDefaultsFor(targetId);
  });
});
