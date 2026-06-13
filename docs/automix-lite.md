# Legacy AutoMix Compatibility

The old basic crossfade path is now treated as a compatibility bridge and
fallback layer, not a separate user-facing AutoMix product.

Use the current AutoMix plugin for new code:

```tsx
createAutomixPlugin()
```

Existing mode-based configs continue to work silently for older integrations,
but new docs and demos use the single automatic plugin. See
[`automix.md`](./automix.md).
