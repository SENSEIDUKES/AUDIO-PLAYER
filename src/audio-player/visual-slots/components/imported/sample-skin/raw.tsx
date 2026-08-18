/**
 * Sample visual component for testing the skin import CLI.
 * This is a minimal Sea-Workshop-Light format #2 (structured React) export.
 */
export default function SampleVisual({ primaryColor = "#7cc4ff", label = "Hello Skin" }) {
    return (
        <div className="container">
            <h2 className="title" style={{ color: primaryColor }}>
                {label}
            </h2>
            <div className="ring" />
        </div>
    )
}
