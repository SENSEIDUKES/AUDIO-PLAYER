import { useEffect, useState } from "react"

/**
 * Extracts the average RGB color from an image URL using a hidden canvas.
 * Falls back to null if the image fails to load or CORS prevents extraction.
 */
export function useArtworkColor(src: string | undefined): string | null {
    const [color, setColor] = useState<string | null>(null)

    useEffect(() => {
        if (!src) {
            setColor(null)
            return
        }

        let isMounted = true

        const img = new Image()
        // Important for extracting cross-origin image data without tainting the canvas
        img.crossOrigin = "Anonymous"

        img.onload = () => {
            if (!isMounted) return

            try {
                const canvas = document.createElement("canvas")
                const ctx = canvas.getContext("2d")
                if (!ctx) return

                // Downscale for performance
                canvas.width = 64
                canvas.height = 64

                ctx.drawImage(img, 0, 0, 64, 64)
                const imageData = ctx.getImageData(0, 0, 64, 64).data

                let r = 0,
                    g = 0,
                    b = 0,
                    totalAlpha = 0

                for (let i = 0; i < imageData.length; i += 4) {
                    const a = imageData[i + 3]
                    r += imageData[i] * a
                    g += imageData[i + 1] * a
                    b += imageData[i + 2] * a
                    totalAlpha += a
                }

                if (totalAlpha === 0) {
                    setColor(null)
                } else {
                    setColor(
                        `rgb(${Math.round(r / totalAlpha)}, ${Math.round(g / totalAlpha)}, ${Math.round(b / totalAlpha)})`
                    )
                }
            } catch (err) {
                // Ignore CORS errors (canvas tainted)
                if (isMounted) setColor(null)
            }
        }

        img.onerror = () => {
            if (isMounted) setColor(null)
        }

        img.src = src

        return () => {
            isMounted = false
            img.onload = null
            img.onerror = null
        }
    }, [src])

    return color
}
