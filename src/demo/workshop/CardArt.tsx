import {
    Activity,
    AudioLines,
    BookOpenText,
    Bot,
    Clapperboard,
    Cpu,
    GitBranch,
    ListOrdered,
    Radio,
    ScrollText,
    Shuffle,
    SlidersVertical,
    SquarePlus,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { WorkshopCategoryId } from "./catalog"

/* Card art: one glyph per piece on a category-tinted field. Decorative only —
   every card carries its real name and summary as text. */

const ICONS: Record<string, LucideIcon> = {
    "new-player": SquarePlus,
    "narrative-face": BookOpenText,
    "reader-mixer": SlidersVertical,
    "narrative-engines": AudioLines,
    cues: Clapperboard,
    "playback-session": Radio,
    "audio-engine": Cpu,
    "sources-recovery": GitBranch,
    queue: ListOrdered,
    automix: Shuffle,
    "agent-scout": Bot,
    "activity-log": ScrollText,
}

export function CardArt({ id, category }: { id: string; category: WorkshopCategoryId }) {
    const Icon = ICONS[id] ?? Activity
    return (
        <div className={`wk-card-art wk-card-art--${category}`} aria-hidden="true">
            <span className="wk-card-art__ring" />
            <Icon className="wk-card-art__icon" size={34} strokeWidth={1.5} />
        </div>
    )
}
