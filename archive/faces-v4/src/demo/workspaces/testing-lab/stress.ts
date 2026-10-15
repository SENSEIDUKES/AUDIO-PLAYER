import type { SessionEngine } from "../../../audio-player"
import type { StressAction, StressResult } from "./bridge"

/* Stress routines: hammer the shared session the way an impatient thumb does,
   let it settle, then check the session still agrees with itself and with its
   <audio> element. They drive the public session API only. */

export interface StressTarget {
    /** Always returns the latest session snapshot (routines outlive renders). */
    session: () => SessionEngine
    /** Live position/duration from the session's time context. */
    time: () => { currentTime: number; duration: number }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function check(checks: string[], ok: boolean, label: string): boolean {
    checks.push(`${ok ? "✓" : "✗"} ${label}`)
    return ok
}

function elementChecks(s: SessionEngine, checks: string[]): boolean {
    const element = s.audioRef.current
    const html5 = s.getBackendInfo().active === "html5"
    if (!element || !html5) {
        checks.push("• Element check skipped (Web Audio backend or no element)")
        return true
    }
    let ok = true
    ok =
        check(
            checks,
            s.isPlaying === !element.paused,
            `Play state matches the audio element (${s.isPlaying ? "playing" : "paused"})`
        ) && ok
    ok =
        check(
            checks,
            element.muted === s.isMuted,
            `Mute matches the audio element (${s.isMuted ? "muted" : "unmuted"})`
        ) && ok
    return ok
}

async function toggleStorm(target: StressTarget, checks: string[]): Promise<boolean> {
    for (let i = 0; i < 20; i += 1) {
        target.session().toggle()
        await sleep(60)
    }
    await sleep(900)
    const s = target.session()
    let ok = check(checks, !s.hasError || s.errorMessage.length > 0, "No silent error state")
    ok = elementChecks(s, checks) && ok
    return ok
}

async function seekStorm(target: StressTarget, checks: string[]): Promise<boolean> {
    const { duration } = target.time()
    if (!(duration > 0)) {
        check(checks, false, "Track has no duration yet — press play first")
        return false
    }
    for (let i = 0; i < 30; i += 1) {
        target.session().seek(Math.random() * duration)
        await sleep(40)
    }
    const final = duration * 0.25
    target.session().seek(final)
    await sleep(700)
    const { currentTime } = target.time()
    const s = target.session()
    let ok = check(
        checks,
        Number.isFinite(currentTime),
        `Position is a number (${currentTime.toFixed(2)} s)`
    )
    ok =
        check(
            checks,
            currentTime >= 0 && currentTime <= duration + 0.5,
            "Position stays within the track"
        ) && ok
    ok =
        check(
            checks,
            Math.abs(currentTime - final) < 2.5,
            `Last seek wins (asked ${final.toFixed(1)} s)`
        ) && ok
    ok = check(checks, !s.isSeeking, "Seeking flag cleared") && ok
    ok = elementChecks(s, checks) && ok
    return ok
}

async function skipStorm(target: StressTarget, checks: string[]): Promise<boolean> {
    for (let i = 0; i < 12; i += 1) {
        const s = target.session()
        if (i % 3 === 2) s.previous()
        else s.next()
        await sleep(80)
    }
    await sleep(900)
    const s = target.session()
    let ok = check(
        checks,
        s.queue.length === 0 || (s.currentIndex >= 0 && s.currentIndex < s.queue.length),
        `Queue position is valid (${s.currentIndex + 1} of ${s.queue.length})`
    )
    ok =
        check(
            checks,
            s.queue.length === 0 || s.currentTrack !== null,
            `A current track exists (${s.currentTrack?.title ?? "none"})`
        ) && ok
    ok = elementChecks(s, checks) && ok
    return ok
}

async function volumeSweep(target: StressTarget, checks: string[]): Promise<boolean> {
    for (let v = 10; v >= 0; v -= 1) {
        target.session().setVolume(v / 10)
        await sleep(30)
    }
    target.session().toggleMute()
    await sleep(60)
    target.session().toggleMute()
    await sleep(60)
    for (let v = 0; v <= 8; v += 1) {
        target.session().setVolume(v / 10)
        await sleep(30)
    }
    await sleep(300)
    const s = target.session()
    let ok = check(
        checks,
        Math.abs(s.volume - 0.8) < 0.01,
        `Volume restored to 80% (${Math.round(s.volume * 100)}%)`
    )
    ok = check(checks, !s.isMuted, "Unmuted after mute → unmute") && ok
    const element = s.audioRef.current
    if (element && s.getBackendInfo().active === "html5") {
        if (s.volumeUnsupported) {
            checks.push("• Element volume skipped (this browser ignores programmatic volume)")
        } else {
            ok =
                check(
                    checks,
                    Math.abs(element.volume - 0.8) < 0.01,
                    "The audio element's volume matches"
                ) && ok
        }
    }
    ok = elementChecks(s, checks) && ok
    return ok
}

const ROUTINES: Record<StressAction, (target: StressTarget, checks: string[]) => Promise<boolean>> =
    {
        "toggle-storm": toggleStorm,
        "seek-storm": seekStorm,
        "skip-storm": skipStorm,
        "volume-sweep": volumeSweep,
    }

export async function runStress(action: StressAction, target: StressTarget): Promise<StressResult> {
    const started = Date.now()
    const checks: string[] = []
    let passed = false
    try {
        passed = await ROUTINES[action](target, checks)
    } catch (error) {
        checks.push(`✗ Threw: ${(error as Error).message}`)
        passed = false
    }
    return { action, passed, checks, durationMs: Date.now() - started }
}
