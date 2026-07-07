/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { registerVisualComponent } from '../visualRegistry';
import { VisualSlotsProvider, useVisualSlots } from '../VisualSlotsContext';
import React from 'react';
import { renderHook, act } from '@testing-library/react';

describe('VisualSlots Performance Benchmark', () => {
    it('measures getSettings performance with many components registered AFTER mount', () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            React.createElement(VisualSlotsProvider, null, children)
        );

        const { result } = renderHook(() => useVisualSlots(), { wrapper });

        // Register a large number of components AFTER mount so they are not in settingsById
        const componentCount = 5000;
        for (let i = 0; i < componentCount; i++) {
            registerVisualComponent({
                id: `late-comp-${i}`,
                slot: 'seiCanvas',
                defaultSettings: { i },
                component: () => null,
            } as any);
        }

        // Measure O(1) lookup
        const iterations = 5000;
        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            result.current.getSettings(`late-comp-${i}`);
        }
        const end = performance.now();
        console.log(`Optimized: Time for ${iterations} getSettings calls (UNCached) with ${componentCount} late components: ${end - start}ms`);

        // Now they are cached, so it should be even faster.
        const startCached = performance.now();
        for (let i = 0; i < iterations; i++) {
            result.current.getSettings(`late-comp-${i}`);
        }
        const endCached = performance.now();
        console.log(`Optimized: Time for ${iterations} getSettings calls (Cached): ${endCached - startCached}ms`);
    });
});
