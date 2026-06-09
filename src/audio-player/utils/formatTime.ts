/** Format a number of seconds as `m:ss`. Returns `0:00` for invalid input. */
export function formatTime(time: number): string {
    if (!Number.isFinite(time) || time < 0) return "0:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
