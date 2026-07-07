import { describe, expect, it } from "vitest"
import { formatTime } from "../formatTime"

describe("formatTime", () => {
    it("formats 0 seconds as 0:00", () => {
        expect(formatTime(0)).toBe("0:00")
    })

    it("formats seconds under 60 correctly", () => {
        expect(formatTime(1)).toBe("0:01")
        expect(formatTime(9)).toBe("0:09")
        expect(formatTime(59)).toBe("0:59")
    })

    it("formats exactly 60 seconds as 1:00", () => {
        expect(formatTime(60)).toBe("1:00")
    })

    it("formats minutes and seconds correctly", () => {
        expect(formatTime(61)).toBe("1:01")
        expect(formatTime(120)).toBe("2:00")
        expect(formatTime(125)).toBe("2:05")
        expect(formatTime(600)).toBe("10:00")
        expect(formatTime(3599)).toBe("59:59")
        expect(formatTime(3600)).toBe("60:00")
        expect(formatTime(3601)).toBe("60:01")
    })

    it("handles fractional seconds by flooring them", () => {
        expect(formatTime(1.5)).toBe("0:01")
        expect(formatTime(61.9)).toBe("1:01")
    })

    it("returns 0:00 for invalid or negative inputs", () => {
        expect(formatTime(-1)).toBe("0:00")
        expect(formatTime(-60)).toBe("0:00")
        expect(formatTime(Infinity)).toBe("0:00")
        expect(formatTime(-Infinity)).toBe("0:00")
        expect(formatTime(NaN)).toBe("0:00")
    })
})
