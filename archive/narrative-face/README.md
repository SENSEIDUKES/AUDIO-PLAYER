# Archived: the NarrativeFace Workshop page

The Workshop's "Narrator face" page used to show `NarrativeFace`, the inline
Rain / Voice / Ambience bar. No SEIHouse reader uses that face. SEN's reader
ships a different one: the floating music note (tap mutes, hold opens a quick
master volume) and the Reader Settings › Audio menu. Those now live in the
package as `ReaderNoteFace` (main entry) and `ReaderSettingsAudio` (reader-ui
entry), and the "Narrator face" page shows them.

`NarrativeFace` itself is still exported (marked deprecated) so hosts that
import it keep building. Only its Workshop page moved here. Nothing in this
folder is built, linted, type-checked, tested or published.

The file sits at the path it had under the repository root, so restoring it is
a move back plus its registry line in `src/demo/workshop/registry.ts`:

```bash
git mv archive/narrative-face/src/demo/workspaces/players/NarrativeFaceWorkspace.tsx src/demo/workspaces/players/NarrativeFaceWorkspace.tsx
```
