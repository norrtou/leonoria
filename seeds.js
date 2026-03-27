// ─── Saved Seeds ──────────────────────────────────────────────────────────────
// Persists named seeds to localStorage.
// Key: 'leonoria_saved_seeds'
// Schema: Array<{ name: string, seed: number, savedAt: string (ISO 8601) }>

const SavedSeeds = (() => {
    const KEY = 'leonoria_saved_seeds';

    function load() {
        try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
        catch { return []; }
    }

    function save(entries) {
        localStorage.setItem(KEY, JSON.stringify(entries));
    }

    function add(name, seed) {
        const entries = load();
        entries.unshift({ name, seed, savedAt: new Date().toISOString() });
        save(entries);
    }

    function remove(index) {
        const entries = load();
        entries.splice(index, 1);
        save(entries);
    }

    function formatDate(iso) {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString(undefined, {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    }

    return { load, add, remove, formatDate };
})();
