## 2026-07-10 - AgentScoutWorkspace Accessibility
**Learning:** The textarea and submit button in AgentScoutWorkspace lacked accessible names, making them difficult to use for screen reader users, especially since the submit button becomes icon-only during the loading state.
**Action:** Added `aria-label` attributes to both the textarea and submit button. Dynamic `aria-label` states were used for the submit button to reflect its loading status.
## 2026-07-12 - Destructive Action Confirmation
**Learning:** Destructive actions like clearing logs or chat history lacked confirmation dialogues. This could lead to accidental data loss for users.
**Action:** Added `window.confirm` to these destructive actions to ensure users are aware of the consequence.
## 2024-05-15 - Explicit Action Labels for List Buttons
**Learning:** Row buttons in lists acting as play triggers need explicit action verbs in their ARIA labels so screen reader users know it's a playback action, not just a static list item.
**Action:** Always add action-oriented labels like "Play [Item]" to interactive list rows.
