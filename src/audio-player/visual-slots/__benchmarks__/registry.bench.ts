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
    defaultSettings: {},
  };
}

// Register many components to make O(N) visible
// We don't register anything in the last few slots to force O(N) traversal in the baseline
for (let i = 0; i < COMPONENT_COUNT; i++) {
  registerVisualComponent(createDef(`comp-${i}`, "seiCanvas"));
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

  // Benchmark the O(N) linear search (reconstructed from the original getDefaultsFor implementation)
  bench("getDefaultsFor (O(N) registry scan baseline)", () => {
    const id = "comp-500";
    for (const def of getAllVisualComponents()) {
      if (def.id === id) {
        const defaults = {
          ...(def.defaultSettings as Record<string, unknown>),
        };
        return defaults;
      }
    }
    return undefined;
  });

  // Benchmark the O(1) Map lookup (current optimized getDefaultsFor implementation)
  bench("getDefaultsFor (O(1) Map lookup optimized)", () => {
    const id = "comp-500";
    const def = getVisualComponent(id);
    if (def) {
      const defaults = { ...(def.defaultSettings as Record<string, unknown>) };
      return defaults;
    }
    return undefined;
  });
});
