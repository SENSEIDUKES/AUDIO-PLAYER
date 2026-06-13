# Legacy AutoMix Compatibility

The old advanced AutoMix helper is now a deprecated compatibility wrapper.
Smart automatic behavior is the default:

```tsx
createAutomixPlugin()
```

Existing `createAutomixProPlugin()` and old mode/pro configs continue to work
silently for older integrations, but new code should use the single automatic
plugin. See [`automix.md`](./automix.md).
