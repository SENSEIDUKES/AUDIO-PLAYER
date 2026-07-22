import { bench, describe } from "vitest";
import {
  registerVisualComponent,
  getAllVisualComponents,
  getVisualComponent,
} from "../visualRegistry";
import type { VisualComponentDefinition } from "../types";

const COMPONENT_COUNT = 1000;

// Create dummy component definitions
function createDef(id: string): VisualComponentDefinition {
  return {
    id,
    name: `Component ${id}`,
    slot: "seiCanvas",
    Component: () => null,
    defaultSettings: { theme: "dark", volume: 0.8 },
  };
}

// Register components
for (let i = 0; i < COMPONENT_COUNT; i++) {
  registerVisualComponent(createDef(`comp-${i}`));
}

// Baseline lookup using getAllVisualComponents() loop
function getDefaultsForBaseline(
  id: string,
): Record<string, unknown> | undefined {
  for (const def of getAllVisualComponents()) {
    if (def.id === id) {
      return { ...(def.defaultSettings as Record<string, unknown>) };
    }
  }
  return undefined;
}

// Optimized lookup using getVisualComponent(id)
function getDefaultsForOptimized(
  id: string,
): Record<string, unknown> | undefined {
  const def = getVisualComponent(id);
  if (def) {
    return { ...(def.defaultSettings as Record<string, unknown>) };
  }
  return undefined;
}

describe("getDefaultsFor Lookup Performance", () => {
  const targetId = `comp-${COMPONENT_COUNT - 1}`; // Search for the last element to hit worst-case O(N)

  bench("Baseline getDefaultsFor (O(N) sequential iteration)", () => {
    getDefaultsForBaseline(targetId);
  });

  bench("Optimized getDefaultsFor (O(1) Map lookup)", () => {
    getDefaultsForOptimized(targetId);
  });
});
