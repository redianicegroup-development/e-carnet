// Faux IndexedDB minimal (open, object stores, get/put/delete, curseur, transactions qui se valident) pour tester le vrai code
// de src/lib/*.ts sans navigateur. Les valeurs sont copiées (structured clone) comme dans un vrai navigateur.
// Copie structurée : comme JSON (les propriétés `undefined` disparaissent) mais en laissant passer les CryptoKey, que JSON détruirait.
function cloneDeep(value) {
  if (value === null || typeof value !== "object") return value;
  if (typeof CryptoKey !== "undefined" && value instanceof CryptoKey) return value;
  if (Array.isArray(value)) return value.map((item) => (item === undefined ? null : cloneDeep(item)));
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, cloneDeep(item)]));
}
const clone = (value) => (value === undefined ? undefined : cloneDeep(value));
const tick = (fn) => setTimeout(fn, 0);

export function createFakeIndexedDB() {
  const databases = new Map();

  function makeDb(data) {
    return {
      objectStoreNames: { contains: (name) => data.stores.has(name) },
      createObjectStore(name, { keyPath }) { data.stores.set(name, { keyPath, rows: new Map() }); },
      close() {},
      transaction(storeNames) {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        for (const name of names) if (!data.stores.get(name)) throw new Error(`NotFoundError: ${name}`);
        const tx = { oncomplete: null, onerror: null, onabort: null };
        let pending = 0;
        let finished = false;
        const settle = () => tick(() => { if (!finished && pending === 0) { finished = true; tx.oncomplete?.(); } });
        const run = (request, operation) => {
          pending += 1;
          tick(() => {
            request.result = operation();
            request.onsuccess?.();
            pending -= 1;
            if (pending === 0) settle();
          });
          return request;
        };
        tx.objectStore = (requested) => { const store = data.stores.get(requested ?? names[0]); return ({
          get: (key) => run({}, () => clone(store.rows.get(key))),
          put: (value) => run({}, () => { store.rows.set(value[store.keyPath], clone(value)); return value[store.keyPath]; }),
          delete: (key) => run({}, () => { store.rows.delete(key); }),
          openCursor: () => {
            const keys = [...store.rows.keys()];
            let index = 0;
            const request = {};
            const step = () => {
              pending += 1;
              tick(() => {
                if (index >= keys.length) request.result = null;
                else {
                  const key = keys[index];
                  request.result = {
                    value: clone(store.rows.get(key)),
                    delete: () => { store.rows.delete(key); },
                    continue: () => { index += 1; step(); },
                  };
                }
                request.onsuccess?.();
                pending -= 1;
                if (pending === 0) settle();
              });
            };
            step();
            return request;
          },
        }); };
        settle(); // une transaction sans requête se valide aussi
        return tx;
      },
    };
  }

  return {
    databases,
    open(name) {
      const request = {};
      tick(() => {
        let data = databases.get(name);
        const fresh = !data;
        if (fresh) { data = { stores: new Map() }; databases.set(name, data); }
        request.result = makeDb(data);
        if (fresh) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
    /** Lecture directe pour les assertions. */
    rows(dbName, storeName) { return [...(databases.get(dbName)?.stores.get(storeName)?.rows.values() ?? [])]; },
    seed(dbName, storeName, keyPath, values) {
      const data = databases.get(dbName) ?? { stores: new Map() };
      databases.set(dbName, data);
      const store = data.stores.get(storeName) ?? { keyPath, rows: new Map() };
      data.stores.set(storeName, store);
      values.forEach((value) => store.rows.set(value[keyPath], clone(value)));
    },
  };
}
