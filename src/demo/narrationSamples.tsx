import { useState } from "react"
import type { ReaderVoiceSlot, ReaderVoiceTier } from "../reader-ui"

/* Workshop stand-ins for what SEN supplies to Settings › Narration: its
   tiers (with SEN's Fate Pressure flames, which belong to SEN), the voices
   each tier offers, and the chapter's speakers. Every name here is a sample.
   Mortal stands for voices that cost almost nothing (the device's own
   speech); Immortal for generated voices from providers such as ElevenLabs
   and Fish Audio; Heaven for the most expensive, such as voices designed for
   one story. */

/** One, two or three flames: a simple stand-in for SEN's tier marks. */
function Flames({ count, color }: { count: number; color: string }) {
    const flame =
        "M4 1C4 3 1.5 4 1.5 7a2.5 2.5 0 0 0 5 0C6.5 5 5 4.5 5 3c-.6.6-1 1.1-1 2C3 4 4 2.5 4 1z"
    return (
        <svg width={6 + count * 5} height="12" viewBox={`0 0 ${6 + count * 5} 12`} fill={color}>
            {Array.from({ length: count }, (_, index) => (
                <path key={index} d={flame} transform={`translate(${index * 5} 2)`} />
            ))}
        </svg>
    )
}

export const SAMPLE_VOICE_TIERS: readonly ReaderVoiceTier[] = [
    { id: "mortal", label: "Mortal", icon: <Flames count={1} color="#cbd5e1" /> },
    { id: "immortal", label: "Immortal", icon: <Flames count={2} color="#c4b5fd" /> },
    { id: "heaven", label: "Heaven", icon: <Flames count={3} color="#fcd34d" /> },
]

const SAMPLE_VOICES: Record<string, { id: string; label: string; group: string }[]> = {
    mortal: [
        { id: "device-daniel", label: "Daniel (en-GB)", group: "On this device" },
        { id: "device-samantha", label: "Samantha (en-US)", group: "On this device" },
        { id: "device-rishi", label: "Rishi (en-IN)", group: "On this device" },
        { id: "device-karen", label: "Karen (en-AU)", group: "On this device" },
        { id: "device-moira", label: "Moira (en-IE)", group: "On this device" },
    ],
    immortal: [
        { id: "eleven-brian", label: "Brian", group: "ElevenLabs" },
        { id: "eleven-charlotte", label: "Charlotte", group: "ElevenLabs" },
        { id: "eleven-george", label: "George", group: "ElevenLabs" },
        { id: "fish-elder", label: "Elder sage", group: "Fish Audio" },
        { id: "fish-swordsman", label: "Young swordsman", group: "Fish Audio" },
        { id: "fish-court-lady", label: "Court lady", group: "Fish Audio" },
    ],
    heaven: [
        { id: "designed-narrator", label: "Narrator, designed", group: "Designed for this story" },
        { id: "designed-yan-wu", label: "Yan Wu, designed", group: "Designed for this story" },
        {
            id: "designed-physician",
            label: "Physician, designed",
            group: "Designed for this story",
        },
    ],
}

/** The chapter's speakers: the narrator, the main character, then named codex characters. */
const SAMPLE_CAST = [
    { id: "narrator", name: "Narrator" },
    { id: "yan-wu", name: "Yan Wu" },
    { id: "physician", name: "The physician" },
    { id: "lady-mei", name: "Lady Mei" },
    { id: "old-servant", name: "Old servant" },
]

const FIRST_ASSIGNMENTS: Record<string, Record<string, string>> = {
    mortal: { narrator: "device-daniel", "yan-wu": "device-rishi", physician: "device-samantha" },
    immortal: { narrator: "eleven-george", "yan-wu": "fish-swordsman" },
    heaven: {},
}

/** Sample Narration props with their own state: a tier, and each tier's assignments. */
export function useNarrationSamples(onEvent?: (text: string) => void) {
    const [tier, setTier] = useState("mortal")
    const [assigned, setAssigned] = useState(FIRST_ASSIGNMENTS)
    const voices = SAMPLE_VOICES[tier] ?? []
    const slots: ReaderVoiceSlot[] = SAMPLE_CAST.map((speaker) => ({
        ...speaker,
        voiceId: assigned[tier]?.[speaker.id] ?? null,
    }))
    return {
        tiers: SAMPLE_VOICE_TIERS,
        tier,
        onTierChange: (id: string) => {
            setTier(id)
            onEvent?.(`tier → ${id}`)
        },
        voices,
        slots,
        onAssign: (slotId: string, voiceId: string) => {
            setAssigned((all) => ({ ...all, [tier]: { ...all[tier], [slotId]: voiceId } }))
            const name = SAMPLE_CAST.find((speaker) => speaker.id === slotId)?.name ?? slotId
            const voice = voices.find((entry) => entry.id === voiceId)?.label ?? voiceId
            onEvent?.(`${name} → ${voice}`)
        },
    }
}
