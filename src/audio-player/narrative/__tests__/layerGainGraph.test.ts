// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { applyAudioSessionType } from "../layerGainGraph"

const navigatorSession = navigator as Navigator & { audioSession?: { type: string } }

afterEach(() => {
    delete navigatorSession.audioSession
})

describe("shared audio session type", () => {
    it("retains playback until both mixer and voice release, in either order", () => {
        for (const reverse of [false, true]) {
            const session = { type: "ambient" }
            navigatorSession.audioSession = session
            const owners = [applyAudioSessionType("playback"), applyAudioSessionType("playback")]
            if (reverse) owners.reverse()
            expect(session.type).toBe("playback")
            owners[0]()
            expect(session.type).toBe("playback")
            owners[1]()
            expect(session.type).toBe("ambient")
            owners[0]()
            expect(session.type).toBe("ambient")
        }
    })

    it("restores the surviving owner's type and preserves external changes", () => {
        const session = { type: "auto" }
        navigatorSession.audioSession = session
        const releaseMusic = applyAudioSessionType("playback")
        const releaseVoice = applyAudioSessionType("play-and-record")
        expect(session.type).toBe("play-and-record")
        releaseVoice()
        expect(session.type).toBe("playback")
        session.type = "ambient"
        releaseMusic()
        expect(session.type).toBe("ambient")
    })
})
