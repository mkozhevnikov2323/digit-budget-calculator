// Disposable IPC child only; never loaded by production or Vite.
if(process.env.BUDGET_BROWSER_TEST!=='1'||process.env.MONGODB_INTEGRATION_TEST!=='1'||!process.send)throw Error('Test-only C fixture');
process.env.CLASSIFICATION_C_WRITE_ENABLED=process.env.BUDGET_BROWSER_DEFAULT_OFF==='1'?'0':'1';

// Reviewed manifests are installed only when CREATING the guarded disposable
// fixture. No migration CLI, collMod, application URI or production activation.
if (process.env.BUDGET_BROWSER_GROUPS_TEST === '1') {
  process.env.CLASSIFICATION_GROUPS_ENABLED = '1';
  const path = require('node:path');
  const root = process.env.BUDGET_E2E_BACKEND;
  if (!root) throw Error('Explicit disposable backend path required');
  const helper = require(path.join(root, 'tests/helpers/mongodb-integration.cjs'));
  const createHarness = helper.createHarness;
  helper.createHarness = async function(...args) {
    const h = await createHarness(...args);
    try {
      h.assertDatabase();
      const db = h.mongoose.connection.db;
      if (!/^budget_ownership_it_[a-f0-9]{32}$/.test(db.databaseName)) throw Error('Unsafe browser database');
      const {GROUPS_MANIFEST, GROUP_RULES_MANIFEST, GROUP_DECISION_MANIFEST} = require(path.join(root, 'dist/persistence/classificationGroupsManifest'));
      for (const m of [GROUPS_MANIFEST, GROUP_RULES_MANIFEST]) {
        await db.createCollection(m.collectionName, m.options);
        for (const i of m.indexes) await db.collection(m.collectionName).createIndex(i.key, i.options);
      }
      const create = db.createCollection;
      db.createCollection = function(name, options, ...rest) {
        if (name === GROUP_DECISION_MANIFEST.collectionName) {
          db.createCollection = create;
          return create.call(this, name, GROUP_DECISION_MANIFEST.options, ...rest);
        }
        return create.call(this, name, options, ...rest);
      };
      return h;
    } catch {
      await h.close();
      throw Error('Synthetic group fixture creation failed; details suppressed');
    }
  };
}
