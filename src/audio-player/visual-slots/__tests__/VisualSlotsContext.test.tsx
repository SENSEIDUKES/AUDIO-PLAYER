/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { registerVisualComponent } from '../visualRegistry';
import { VisualSlotsProvider, useVisualSlots } from '../VisualSlotsContext';
import React from 'react';
import { renderHook, act } from '@testing-library/react';

describe('VisualSlotsContext Functional Tests', () => {
    it('provides default settings for late-registered components', () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <VisualSlotsProvider>{children}</VisualSlotsProvider>
        );

        const { result } = renderHook(() => useVisualSlots(), { wrapper });

        const componentId = 'late-functional-comp';
        const defaultSettings = { theme: 'dark', volume: 0.8 };

        registerVisualComponent({
            id: componentId,
            name: 'Late Functional Component',
            slot: 'seiCanvas',
            defaultSettings,
            Component: () => null,
        });

        const settings = result.current.getSettings(componentId);
        expect(settings).toEqual(defaultSettings);
        // It should be a copy, not the same reference
        expect(settings).not.toBe(defaultSettings);
    });

    it('updates settings correctly', () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <VisualSlotsProvider>{children}</VisualSlotsProvider>
        );

        const { result } = renderHook(() => useVisualSlots(), { wrapper });

        const componentId = 'update-test-comp';
        const defaultSettings = { theme: 'light', volume: 0.5 };

        registerVisualComponent({
            id: componentId,
            name: 'Update Test Component',
            slot: 'seiCanvas',
            defaultSettings,
            Component: () => null,
        });

        act(() => {
            result.current.updateSettings(componentId, { volume: 0.9 });
        });

        const settings = result.current.getSettings(componentId);
        expect(settings).toEqual({ theme: 'light', volume: 0.9 });
    });

    it('returns EMPTY_OBJECT for unknown components', () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <VisualSlotsProvider>{children}</VisualSlotsProvider>
        );

        const { result } = renderHook(() => useVisualSlots(), { wrapper });

        const settings = result.current.getSettings('non-existent');
        expect(settings).toEqual({});
    });
});
