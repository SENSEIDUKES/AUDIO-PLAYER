/** @vitest-environment jsdom */
import { fireEvent, render } from "@testing-library/react"
import type { ComponentType, CSSProperties } from "react"
import { describe, expect, it, vi } from "vitest"
import type { Track } from "../../types"
import { QueueDrawer } from "../QueueDrawer"

interface ListCall {
    itemCount: number
    itemData: {
        onPlayTrack: (index: number) => void
        onRemove: (index: number) => void
    }
    itemKey: (index: number, data: unknown) => string
    rowRenderer: ComponentType<{
        index: number
        style: CSSProperties
        data: unknown
    }> & { $$typeof?: symbol }
}

const { listCalls, rowStyles } = vi.hoisted(() => ({
    listCalls: [] as ListCall[],
    rowStyles: Array.from({ length: 4 }, (_, index) => ({
        position: "absolute" as const,
        top: index * 56,
        height: 56,
        width: "100%",
    })),
}))

vi.mock("react-window", async () => {
    const React = await import("react")

    return {
        FixedSizeList: ({
            children: RowRenderer,
            itemCount,
            itemData,
            itemKey,
        }: {
            children: ListCall["rowRenderer"]
            itemCount: number
            itemData: ListCall["itemData"]
            itemKey: ListCall["itemKey"]
        }) => {
            listCalls.push({
                itemCount,
                itemData,
                itemKey,
                rowRenderer: RowRenderer,
            })

            return React.createElement(
                "div",
                null,
                Array.from({ length: Math.min(itemCount, rowStyles.length) }, (_, index) =>
                    React.createElement(RowRenderer, {
                        key: index,
                        index,
                        style: rowStyles[index],
                        data: itemData,
                    })
                )
            )
        },
    }
})

vi.mock("react-virtualized-auto-sizer", () => ({
    AutoSizer: ({
        renderProp,
    }: {
        renderProp: (size: { height: number; width: number }) => React.ReactNode
    }) => renderProp({ height: 400, width: 320 }),
}))

const QUEUE: Track[] = Array.from({ length: 120 }, (_, index) => ({
    title: `Track ${index + 1}`,
    artist: "SEIHouse",
    audioFile: `track-${index + 1}.mp3`,
}))

describe("QueueDrawer virtualization memoization", () => {
    it("keeps row data stable across unrelated drawer renders", () => {
        listCalls.length = 0
        const onPlayTrack = vi.fn()
        const onRemove = vi.fn()
        const onReorder = vi.fn()
        const firstOnClose = vi.fn()

        const view = render(
            <QueueDrawer
                queue={QUEUE}
                currentIndex={0}
                open
                onClose={firstOnClose}
                onPlayTrack={onPlayTrack}
                onReorder={onReorder}
                onRemove={onRemove}
            />
        )

        const firstCall = listCalls[listCalls.length - 1]!
        expect(firstCall.itemCount).toBe(120)
        expect(firstCall.rowRenderer.$$typeof).toBe(Symbol.for("react.memo"))

        view.rerender(
            <QueueDrawer
                queue={QUEUE}
                currentIndex={0}
                open
                onClose={vi.fn()}
                onPlayTrack={onPlayTrack}
                onReorder={onReorder}
                onRemove={onRemove}
            />
        )

        const secondCall = listCalls[listCalls.length - 1]!
        expect(secondCall.itemData).toBe(firstCall.itemData)
        expect(secondCall.itemKey).toBe(firstCall.itemKey)
        expect(secondCall.itemData.onPlayTrack).toBe(firstCall.itemData.onPlayTrack)
        expect(secondCall.itemData.onRemove).toBe(firstCall.itemData.onRemove)

        fireEvent.click(view.getByRole("button", { name: "Play Track 2" }))
        fireEvent.click(view.getByRole("button", { name: "Remove Track 2 from queue" }))

        expect(onPlayTrack).toHaveBeenCalledWith(1)
        expect(onRemove).toHaveBeenCalledWith(1)
    })
})
