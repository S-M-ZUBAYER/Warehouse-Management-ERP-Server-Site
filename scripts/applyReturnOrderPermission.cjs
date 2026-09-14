'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const backendRoot = path.resolve(process.env.ROLE_FIX_DEPENDENCY_ROOT || path.join(__dirname, '..'));
const backendRequire = createRequire(path.join(backendRoot, 'package.json'));
backendRequire('dotenv').config({ path: path.join(backendRoot, '.env'), quiet: true });
const mysql = backendRequire('mysql2/promise');

async function main() {
  const mode = process.argv[2] || '--check';
  assert.ok(['--check', '--apply'].includes(mode), 'Use --check or --apply');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectTimeout: 10000,
    multipleStatements: true,
  });
  let transactionOpen = false;
  try {
    const [engines] = await connection.execute(
      'SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?)',
      ['pages', 'roles'],
    );
    assert.equal(engines.length, 2, 'The pages and roles tables must exist');
    assert.ok(engines.every((table) => table.engine === 'InnoDB'), 'Transactional tables are required');
    await connection.beginTransaction();
    transactionOpen = true;
    const [parents] = await connection.execute('SELECT id FROM pages WHERE `key` = ? FOR UPDATE', ['order_processing']);
    assert.equal(parents.length, 1, 'Order Processing page must exist');
    const roleQuery = 'SELECT id, SHA2(CAST(permissions AS CHAR), 256) AS permission_hash FROM roles ORDER BY id';
    const pageQuery = 'SELECT id, `key`, parent_id, `level`, has_sub, `order`, is_active FROM pages WHERE `key` IN (\'return_order\', \'canceled_order\') ORDER BY id';
    const [rolesBefore] = await connection.query(roleQuery);
    const [pagesBefore] = await connection.query(pageQuery);
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/053_add_return_order_page_permission.sql'), 'utf8');
    await connection.query(sql);
    const [pagesAfter] = await connection.query(pageQuery);
    const returned = pagesAfter.filter((page) => page.key === 'return_order');
    assert.equal(returned.length, 1, 'Exactly one Return Order page must exist');
    assert.equal(returned[0].parent_id, parents[0].id, 'Return Order must be under Order Processing');
    assert.equal(returned[0].is_active, 1);
    await connection.query(sql);
    const [pagesRepeated] = await connection.query(pageQuery);
    assert.deepEqual(pagesRepeated, pagesAfter, 'Running the migration twice must have no additional effect');
    const [rolesAfter] = await connection.query(roleQuery);
    assert.deepEqual(rolesAfter, rolesBefore, 'Saved role permissions must remain unchanged');
    if (mode === '--apply') await connection.commit();
    else await connection.rollback();
    transactionOpen = false;
    console.log(JSON.stringify({
      mode,
      result: mode === '--apply' ? 'committed' : 'verified and rolled back',
      returnOrderPreviouslyPresent: pagesBefore.some((page) => page.key === 'return_order'),
      rolePermissionsPreserved: rolesBefore.length,
      repeatRunVerified: true,
    }, null, 2));
  } finally {
    if (transactionOpen) await connection.rollback();
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Return Order migration failed:', error.message);
  process.exitCode = 1;
});
