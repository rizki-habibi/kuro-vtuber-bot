const store = new Map();
const limit = 20;

export function createMemoryStore() {
  return {
    async recent(key) {
      return (store.get(key) || []).slice(-limit);
    },
    async add(key, item) {
      const current = store.get(key) || [];
      current.push({ ...item, at: new Date().toISOString() });
      store.set(key, current.slice(-limit));
    },
  };
}
