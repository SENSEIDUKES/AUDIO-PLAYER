import { bench, describe } from "vitest";
import {
  registerVisualComponent,
  getVisualComponent,
  getVisualComponentsForSlot,
  getDefaultComponentForSlot,
  getAllVisualComponents,
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
    defaultSettings: { someSetting: true },
  };
}

// Register many components to make O(N) visible
for (let i = 0; i < COMPONENT_COUNT; i++) {
  registerVisualComponent(createDef(`comp-${i}`, "seiCanvas"));
}

// Simulated getDefaultsFor using unoptimized O(N) array search
function getDefaultsForUnoptimized(id: string) {
  for (const def of getAllVisualComponents()) {
    if (def.id === id) {
      return { ...(def.defaultSettings as Record<string, unknown>) };
    }
  }
  return undefined;
}

// Simulated getDefaultsFor using optimized O(1) Map lookup
function getDefaultsForOptimized(id: string) {
  const def = getVisualComponent(id);
  if (def) {
    return { ...(def.defaultSettings as Record<string, unknown>) };
  }
  return undefined;
}

describe("Visual Registry Performance", () => {
  // getVisualComponent uses Map.get(id), which is O(1)
  bench("getVisualComponent (O(1) Map lookup)", () => {
    getVisualComponent("comp-500");
  });

  // getVisualComponentsForSlot now uses BY_SLOT Map index (O(1))
  bench("getVisualComponentsForSlot (Optimized O(1) lookup)", () => {
    getVisualComponentsForSlot("controllerPanel");
  });

  // getDefaultComponentForSlot now uses BY_SLOT Map index (O(1))
  bench("getDefaultComponentForSlot (Optimized O(1) lookup)", () => {
    getDefaultComponentForSlot("controllerPanel");
  });

  // Compare O(N) scan in getDefaultsFor with the optimized O(1) map lookup
  bench("getDefaultsFor - Unoptimized O(N) array scan", () => {
    getDefaultsForUnoptimized("comp-999"); // Search near the end of the array to capture worst-case search time
  });

  bench("getDefaultsFor - Optimized O(1) Map lookup", () => {
    getDefaultsForOptimized("comp-999");
  });
});
