/**
 * @nexus/game-sdk - Serialization Utilities
 * Helpers for serializing complex state types
 */

/**
 * Serialization helper for states with Set/Map types
 */
export const stateSerializer = {
    /**
     * Convert Set to array for JSON serialization
     */
    serializeSet<T>(set: Set<T>): T[] {
        return Array.from(set);
    },

    /**
     * Restore Set from array
     */
    deserializeSet<T>(arr: T[]): Set<T> {
        return new Set(arr);
    },

    /**
     * Convert Map to entries array for JSON serialization
     */
    serializeMap<K, V>(map: Map<K, V>): [K, V][] {
        return Array.from(map.entries());
    },

    /**
     * Restore Map from entries array
     */
    deserializeMap<K, V>(entries: [K, V][]): Map<K, V> {
        return new Map(entries);
    },

    /**
     * Generic replacer for JSON.stringify that handles Set and Map
     */
    jsonReplacer(_key: string, value: unknown): unknown {
        if (value instanceof Set) {
            return { __type: 'Set', data: Array.from(value) };
        }
        if (value instanceof Map) {
            return { __type: 'Map', data: Array.from(value.entries()) };
        }
        return value;
    },

    /**
     * Generic reviver for JSON.parse that restores Set and Map
     */
    jsonReviver(_key: string, value: unknown): unknown {
        if (
            typeof value === 'object' &&
            value !== null &&
            '__type' in value
        ) {
            const typed = value as { __type: string; data: unknown };
            if (typed.__type === 'Set' && Array.isArray(typed.data)) {
                return new Set(typed.data);
            }
            if (typed.__type === 'Map' && Array.isArray(typed.data)) {
                return new Map(typed.data as [unknown, unknown][]);
            }
        }
        return value;
    },

    /**
     * Stringify with Set/Map support
     */
    stringify<T>(value: T): string {
        return JSON.stringify(value, this.jsonReplacer);
    },

    /**
     * Parse with Set/Map restoration
     */
    parse<T>(text: string): T {
        return JSON.parse(text, this.jsonReviver) as T;
    },
};
