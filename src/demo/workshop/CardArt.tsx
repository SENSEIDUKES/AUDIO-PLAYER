import {
    Activity,
    AudioLines,
    AudioWaveform,
    BookOpenText,
    Bot,
    Braces,
    CircleDot,
    CirclePlay,
    Clapperboard,
    Cpu,
    Disc3,
    FlaskConical,
    GalleryHorizontal,
    GitBranch,
    Image,
    LayoutPanelTop,
    ListMusic,
    ListOrdered,
    Maximize,
    MoveHorizontal,
    PanelBottom,
    PanelLeft,
    Palette,
    Puzzle,
    Radio,
    Rows3,
    ScrollText,
    Shuffle,
    SlidersHorizontal,
    Smartphone,
    Sparkles,
    SquarePlus,
    Star,
    TriangleAlert,
    Type,
    Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { WorkshopCategoryId } from "./catalog"

/* Card art: one glyph per piece on a category-tinted field. Decorative only —
   every card carries its real name and summary as text. */

const ICONS: Record<string, LucideIcon> = {
    "new-face": SquarePlus,
    "portable-player": Disc3,
    "full-card": LayoutPanelTop,
    "sea-card": GalleryHorizontal,
    "sticky-bottom": PanelBottom,
    "mini-sidebar": PanelLeft,
    "vault-row": Rows3,
    "narrative-face": BookOpenText,
    "queue-row": ListMusic,
    "canvas-mode": Maximize,
    "playback-session": Radio,
    "audio-engine": Cpu,
    "sources-recovery": GitBranch,
    "menus-controller": CircleDot,
    queue: ListOrdered,
    automix: Shuffle,
    cues: Clapperboard,
    "narrative-engines": AudioLines,
    "agent-scout": Bot,
    "activity-log": ScrollText,
    headless: Braces,
    plugins: Puzzle,
    themes: Palette,
    "face-presets": SlidersHorizontal,
    scrubbers: MoveHorizontal,
    waveforms: AudioWaveform,
    visuals: Sparkles,
    "artwork-media": Image,
    "typography-metadata": Type,
    "testing-lab": FlaskConical,
    "lab-mobile": Smartphone,
    "lab-errors": TriangleAlert,
    "lab-stress": Zap,
    "lab-playback": CirclePlay,
    "showcase-fixture": Star,
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
