import { useState } from "react"
import { SEIHeavenIcon, SEIImmortalIcon, SEIMortalIcon } from "../audio-player"
import type { ReaderVoiceChoice, ReaderVoiceSlot, ReaderVoiceTier } from "../reader-ui"

/* Workshop stand-ins for what SEN supplies to Settings › Narration: its
   tiers (with SEIHouse's official Fate Pressure flames), every voice on
   offer with its tier and source, and the chapter's speakers. Every name here is a sample.
   Mortal stands for voices that cost almost nothing (the device's own
   speech); Immortal for generated voices from providers such as ElevenLabs
   and Fish Audio; Heaven for the most expensive, such as voices designed for
   one story. */

export const SAMPLE_VOICE_TIERS: readonly ReaderVoiceTier[] = [
    { id: "mortal", label: "Mortal", icon: <SEIMortalIcon size="1em" /> },
    { id: "immortal", label: "Immortal", icon: <SEIImmortalIcon size="1em" /> },
    { id: "heaven", label: "Heaven", icon: <SEIHeavenIcon size="1em" /> },
]

/** Every voice on offer, each with its tier and source: every slot lists them all. */
const SAMPLE_VOICES: readonly ReaderVoiceChoice[] = [
    { id: "device-daniel", label: "Daniel (en-GB)", tier: "mortal", group: "On this device" },
    { id: "device-samantha", label: "Samantha (en-US)", tier: "mortal", group: "On this device" },
    { id: "device-rishi", label: "Rishi (en-IN)", tier: "mortal", group: "On this device" },
    { id: "device-karen", label: "Karen (en-AU)", tier: "mortal", group: "On this device" },
    { id: "device-moira", label: "Moira (en-IE)", tier: "mortal", group: "On this device" },
    { id: "eleven-brian", label: "Brian", tier: "immortal", group: "ElevenLabs" },
    { id: "eleven-charlotte", label: "Charlotte", tier: "immortal", group: "ElevenLabs" },
    { id: "eleven-george", label: "George", tier: "immortal", group: "ElevenLabs" },
    { id: "fish-elder", label: "Elder sage", tier: "immortal", group: "Fish Audio" },
    { id: "fish-swordsman", label: "Young swordsman", tier: "immortal", group: "Fish Audio" },
    { id: "fish-court-lady", label: "Court lady", tier: "immortal", group: "Fish Audio" },
    { id: "designed-narrator", label: "Narrator, designed", tier: "heaven", group: "Designed" },
    { id: "designed-yan-wu", label: "Yan Wu, designed", tier: "heaven", group: "Designed" },
    { id: "designed-physician", label: "Physician, designed", tier: "heaven", group: "Designed" },
]

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
    const voices = SAMPLE_VOICES
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
