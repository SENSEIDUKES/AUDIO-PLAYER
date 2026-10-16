import { Showcase } from "../../fixtures/showcase"
import { SurfacesDemo } from "../../fixtures/surfaces"
import { useWorkspaceParam } from "../../workshop/routing"
import { Note, Segmented } from "../../workshop/ui"

/* The pre-Workshop showcase material, kept byte-for-byte as a fixture so the
   release presentation and the render-zones demo can still be checked for
   regressions. Only one page renders at a time (switching unmounts the other,
   and with it its audio). */

type FixturePage = "showcase" | "surfaces"

export function ShowcaseFixtureWorkspace() {
    const [pageParam, setPage] = useWorkspaceParam("page", "showcase")
    const page: FixturePage = pageParam === "surfaces" ? "surfaces" : "showcase"
    return (
        <div className="wk-fixture">
            <div className="wk-fixture__bar">
                <Segmented
                    label="Fixture page"
                    value={page}
                    options={[
                        { value: "showcase", label: "No Luck showcase" },
                        { value: "surfaces", label: "Render-zones demo" },
                    ]}
                    onChange={setPage}
                />
                <Note>
                    Kept exactly as it was before the Workshop, for regression checks. New work
                    belongs in the category workspaces.
                </Note>
            </div>
            <div className="wk-fixture__page">
                {page === "showcase" ? <Showcase /> : <SurfacesDemo />}
            </div>
        </div>
    )
}
