import { describe, it, expect, beforeEach } from "vitest";
import {
  registerVisualComponent,
  getVisualComponent,
  getVisualComponentsForSlot,
  getDefaultComponentForSlot,
} from "../visualRegistry";
import type { VisualComponentDefinition } from "../types";

describe("visualRegistry", () => {
  const mockComp = () => null;

  it("should register and retrieve a component", () => {
    const def: VisualComponentDefinition<any> = {
      id: "test-1",
      slot: "seiCanvas",
      defaultSettings: { a: 1 },
      component: mockComp,
    };
    registerVisualComponent(def);
    expect(getVisualComponent("test-1")).toBe(def);
  });

  it("should maintain registration order in getVisualComponentsForSlot", () => {
    const slot = "scrubberCanvas";
    const def1 = { id: "s1", slot, defaultSettings: {}, component: mockComp };
    const def2 = { id: "s2", slot, defaultSettings: {}, component: mockComp };
    const def3 = { id: "s3", slot, defaultSettings: {}, component: mockComp };

    registerVisualComponent(def1);
    registerVisualComponent(def2);
    registerVisualComponent(def3);

    const components = getVisualComponentsForSlot(slot);
    // Find our specific components in the list (since REGISTRY is global)
    const filtered = components.filter((c) =>
      ["s1", "s2", "s3"].includes(c.id),
    );
    expect(filtered).toEqual([def1, def2, def3]);
  });

  it("should be idempotent and preserve order when replacing", () => {
    const slot = "controllerPanel";
    const def1 = {
      id: "c1",
      slot,
      defaultSettings: { v: 1 },
      component: mockComp,
    };
    const def2 = {
      id: "c2",
      slot,
      defaultSettings: { v: 1 },
      component: mockComp,
    };
    const def1_alt = {
      id: "c1",
      slot,
      defaultSettings: { v: 2 },
      component: mockComp,
    };

    registerVisualComponent(def1);
    registerVisualComponent(def2);
    registerVisualComponent(def1_alt);

    const components = getVisualComponentsForSlot(slot);
    const filtered = components.filter((c) => ["c1", "c2"].includes(c.id));
    expect(filtered).toEqual([def1_alt, def2]);
    expect(getVisualComponent("c1")).toBe(def1_alt);
  });

  it("should handle slot changes during re-registration", () => {
    const def = {
      id: "move-me",
      slot: "seiCanvas" as const,
      defaultSettings: {},
      component: mockComp,
    };
    registerVisualComponent(def);
    // Might already have things in seiCanvas from other tests, so just check it's there
    expect(getVisualComponentsForSlot("seiCanvas")).toContain(def);

    const defMoved = {
      id: "move-me",
      slot: "scrubberCanvas" as const,
      defaultSettings: {},
      component: mockComp,
    };
    registerVisualComponent(defMoved);

    expect(getVisualComponentsForSlot("seiCanvas")).not.toContain(defMoved);
    expect(getVisualComponentsForSlot("scrubberCanvas")).toContain(defMoved);
    expect(getVisualComponent("move-me")).toBe(defMoved);
  });

  it("should return the first registered component as default", () => {
    // Use a unique slot to avoid interference from global state
    const slot = ("unique-slot-" + Math.random()) as any;
    const def1 = {
      id: "first",
      slot,
      defaultSettings: {},
      component: mockComp,
    };
    const def2 = {
      id: "second",
      slot,
      defaultSettings: {},
      component: mockComp,
    };

    registerVisualComponent(def1);
    registerVisualComponent(def2);

    expect(getDefaultComponentForSlot(slot)).toBe(def1);
  });
});
