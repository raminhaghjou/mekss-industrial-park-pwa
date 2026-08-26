module.exports = async function assertSafeTestDatabase() {
  const ownedSchema = process.env.MEKSS_OWNED_TEST_SCHEMA;
  const databaseUrl = process.env.DATABASE_URL;
  if (process.env.NODE_ENV !== 'test' || process.env.MEKSS_TEST_DATABASE !== '1') {
    throw new Error('Integration tests require NODE_ENV=test and MEKSS_TEST_DATABASE=1.');
  }
  if (!ownedSchema || !ownedSchema.startsWith('mekss_test_')) {
    throw new Error('Integration tests require a runner-owned mekss_test_* schema.');
  }
  if (!databaseUrl) throw new Error('Integration tests require DATABASE_URL.');
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, '')).toLowerCase();
  if (!/(^|[_-])(test|ci)([_-]|$)/.test(databaseName) || url.searchParams.get('schema') !== ownedSchema) {
    throw new Error('Refusing integration tests outside the dedicated test database and owned schema.');
  }
};
