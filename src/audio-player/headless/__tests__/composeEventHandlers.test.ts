import { describe, expect, it, vi } from "vitest";
import {
  isSAPDefaultPrevented,
  composeEventHandlers,
} from "../composeEventHandlers";

describe("isSAPDefaultPrevented", () => {
  it("returns false for non-objects (null, undefined, primitives)", () => {
    expect(isSAPDefaultPrevented(null)).toBe(false);
    expect(isSAPDefaultPrevented(undefined)).toBe(false);
    expect(isSAPDefaultPrevented(123)).toBe(false);
    expect(isSAPDefaultPrevented("string")).toBe(false);
    expect(isSAPDefaultPrevented(true)).toBe(false);
  });

  it("returns false for objects without prevention flags", () => {
    expect(isSAPDefaultPrevented({})).toBe(false);
    expect(isSAPDefaultPrevented({ someProp: true })).toBe(false);
  });

  it("returns true when defaultPrevented is true", () => {
    expect(isSAPDefaultPrevented({ defaultPrevented: true })).toBe(true);
    expect(isSAPDefaultPrevented({ defaultPrevented: false })).toBe(false);
  });

  it("returns true when sapPreventDefault is true", () => {
    expect(isSAPDefaultPrevented({ sapPreventDefault: true })).toBe(true);
    expect(isSAPDefaultPrevented({ sapPreventDefault: false })).toBe(false);
  });

  it("returns true when nativeEvent.sapPreventDefault is true", () => {
    expect(
      isSAPDefaultPrevented({ nativeEvent: { sapPreventDefault: true } }),
    ).toBe(true);
    expect(
      isSAPDefaultPrevented({ nativeEvent: { sapPreventDefault: false } }),
    ).toBe(false);
    expect(isSAPDefaultPrevented({ nativeEvent: {} })).toBe(false);
  });
});

describe("composeEventHandlers", () => {
  it("calls all provided handlers in order when no prevention flags are set", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();
    const composed = composeEventHandlers(handler1, handler2, handler3);

    const event = { type: "click" };
    composed(event);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler1).toHaveBeenCalledWith(event);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledWith(event);
    expect(handler3).toHaveBeenCalledTimes(1);
    expect(handler3).toHaveBeenCalledWith(event);

    // Verify order
    expect(handler1.mock.invocationCallOrder[0]).toBeLessThan(
      handler2.mock.invocationCallOrder[0],
    );
    expect(handler2.mock.invocationCallOrder[0]).toBeLessThan(
      handler3.mock.invocationCallOrder[0],
    );
  });

  it("skips nullish handlers without throwing errors", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const composed = composeEventHandlers(handler1, null, undefined, handler2);

    const event = { type: "click" };
    composed(event);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("stops the chain immediately if a handler sets defaultPrevented", () => {
    const handler1 = vi.fn((e: any) => {
      e.defaultPrevented = true;
    });
    const handler2 = vi.fn();
    const composed = composeEventHandlers(handler1, handler2);

    const event = { type: "click", defaultPrevented: false };
    composed(event);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).not.toHaveBeenCalled();
  });

  it("stops the chain immediately if a handler sets sapPreventDefault", () => {
    const handler1 = vi.fn((e: any) => {
      e.sapPreventDefault = true;
    });
    const handler2 = vi.fn();
    const composed = composeEventHandlers(handler1, handler2);

    const event = { type: "click", sapPreventDefault: false };
    composed(event);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).not.toHaveBeenCalled();
  });

  it("stops the chain if a handler sets nativeEvent.sapPreventDefault", () => {
    const handler1 = vi.fn((e: any) => {
      e.nativeEvent.sapPreventDefault = true;
    });
    const handler2 = vi.fn();
    const composed = composeEventHandlers(handler1, handler2);

    const event = {
      type: "click",
      nativeEvent: { sapPreventDefault: false },
    };
    composed(event);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).not.toHaveBeenCalled();
  });

  it("handles the case where prevention flag is set before any handler is called", () => {
    const handler1 = vi.fn();
    const composed = composeEventHandlers(handler1);

    const event = { type: "click", defaultPrevented: true };
    composed(event);

    expect(handler1).not.toHaveBeenCalled();
  });
});
