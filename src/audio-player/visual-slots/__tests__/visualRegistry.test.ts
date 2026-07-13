import { describe, it, expect } from "vitest";
import {
  registerVisualComponent,
  getVisualComponent,
  getVisualComponentsForSlot,
  getDefaultComponentForSlot,
} from "../visualRegistry";
import type { VisualComponentDefinition, VisualSlot } from "../types";

describe("visualRegistry", () => {
  const mockComp = () => null;

  it("should register and retrieve a component", () => {
    const def: VisualComponentDefinition<any> = {
      id: "test-1",
      name: "Test 1",
      slot: "seiCanvas",
      defaultSettings: { a: 1 },
      Component: mockComp,
    };
    registerVisualComponent(def);
    expect(getVisualComponent("test-1")).toBe(def);
  });

  it("should maintain registration order in getVisualComponentsForSlot", () => {
    const slot: VisualSlot = "scrubberCanvas";
    const def1 = {
      id: "s1",
      name: "S1",
      slot,
      defaultSettings: {},
      Component: mockComp,
    };
    const def2 = {
      id: "s2",
      name: "S2",
      slot,
      defaultSettings: {},
      Component: mockComp,
    };
    const def3 = {
      id: "s3",
      name: "S3",
      slot,
      defaultSettings: {},
      Component: mockComp,
    };

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
    const slot: VisualSlot = "controllerPanel";
    const def1 = {
      id: "c1",
      name: "C1",
      slot,
      defaultSettings: { v: 1 },
      Component: mockComp,
    };
    const def2 = {
      id: "c2",
      name: "C2",
      slot,
      defaultSettings: { v: 1 },
      Component: mockComp,
    };
    const def1_alt = {
      id: "c1",
      name: "C1 alternate",
      slot,
      defaultSettings: { v: 2 },
      Component: mockComp,
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
      name: "Move Me",
      slot: "seiCanvas" as const,
      defaultSettings: {},
      Component: mockComp,
    };
    registerVisualComponent(def);
    // Might already have things in seiCanvas from other tests, so just check it's there
    expect(getVisualComponentsForSlot("seiCanvas")).toContain(def);

    const defMoved = {
      id: "move-me",
      name: "Move Me",
      slot: "scrubberCanvas" as const,
      defaultSettings: {},
      Component: mockComp,
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
      name: "First",
      slot,
      defaultSettings: {},
      Component: mockComp,
    };
    const def2 = {
      id: "second",
      name: "Second",
      slot,
      defaultSettings: {},
      Component: mockComp,
    };

    registerVisualComponent(def1);
    registerVisualComponent(def2);

    expect(getDefaultComponentForSlot(slot)).toBe(def1);
  });
});
