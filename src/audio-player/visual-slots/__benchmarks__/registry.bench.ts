import { bench, describe } from "vitest";
import {
  registerVisualComponent,
  getVisualComponentsForSlot,
  getDefaultComponentForSlot,
  getVisualComponent,
} from "../visualRegistry";
import type { VisualSlot } from "../types";

describe("Visual Registry Performance (10,000 components)", () => {
  const SLOTS: VisualSlot[] = [
    "seiCanvas",
    "scrubberCanvas",
    "controllerPanel",
  ];
  const COUNT = 10000;

  for (let i = 0; i < COUNT; i++) {
    registerVisualComponent({
      id: `comp-${i}`,
      slot: SLOTS[i % SLOTS.length],
      defaultSettings: { i },
      // @ts-ignore - minimal mock
      component: () => null,
    });
  }

  bench("getVisualComponent (O(1) Map)", () => {
    getVisualComponent(`comp-${COUNT - 1}`);
  });

  bench("getVisualComponentsForSlot (Optimized BY_SLOT)", () => {
    getVisualComponentsForSlot("controllerPanel");
  });

  bench("getDefaultComponentForSlot (Optimized BY_SLOT)", () => {
    getDefaultComponentForSlot("controllerPanel");
  });
});
