const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function migratePOStatus() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '1335293',
      database: process.env.DB_NAME || 'management'
    });

    console.log('Connected to database');
    console.log('Starting purchase_orders status migration...\n');

    await connection.beginTransaction();

    // Check current status distribution
    const [statusCounts] = await connection.execute(`
      SELECT status, COUNT(*) as count 
      FROM purchase_orders 
      GROUP BY status
    `);

    console.log('Current status distribution:');
    statusCounts.forEach(row => {
      console.log(`  ${row.status}: ${row.count} records`);
    });
    console.log('');

    // Map old statuses to new ones
    console.log('Migrating statuses...');
    
    // draft, pending, rejected → approved
    const [result1] = await connection.execute(`
      UPDATE purchase_orders 
      SET status = 'approved' 
      WHERE status IN ('draft', 'pending', 'rejected')
    `);
    console.log(`✓ Updated ${result1.affectedRows} records from draft/pending/rejected to approved`);

    // completed → delivered
    const [result2] = await connection.execute(`
      UPDATE purchase_orders 
      SET status = 'delivered' 
      WHERE status = 'completed'
    `);
    console.log(`✓ Updated ${result2.affectedRows} records from completed to delivered`);

    // Check if there are any other statuses
    const [remainingStatuses] = await connection.execute(`
      SELECT DISTINCT status FROM purchase_orders 
      WHERE status NOT IN ('approved', 'delivered')
    `);

    if (remainingStatuses.length > 0) {
      console.warn('\n⚠ Warning: Found unexpected status values:');
      remainingStatuses.forEach(row => {
        console.warn(`  - ${row.status}`);
      });
      console.warn('  These will be converted to "approved"');
      
      await connection.execute(`
        UPDATE purchase_orders 
        SET status = 'approved' 
        WHERE status NOT IN ('approved', 'delivered')
      `);
    }

    // Now alter the table to use new ENUM
    console.log('\nUpdating table schema...');
    await connection.execute(`
      ALTER TABLE purchase_orders 
      MODIFY COLUMN status ENUM('approved', 'delivered') DEFAULT 'approved'
    `);
    console.log('✓ Table schema updated successfully');

    // Verify final distribution
    const [finalCounts] = await connection.execute(`
      SELECT status, COUNT(*) as count 
      FROM purchase_orders 
      GROUP BY status
    `);

    console.log('\nFinal status distribution:');
    finalCounts.forEach(row => {
      console.log(`  ${row.status}: ${row.count} records`);
    });

    await connection.commit();
    console.log('\n✅ Migration completed successfully!');
    console.log('\nStatus values are now:');
    console.log('  - approved (default)');
    console.log('  - delivered');

    await connection.end();
  } catch (error) {
    console.error('\n❌ Error during migration:', error);
    console.error('\nPlease check your database connection and try again.');
    process.exit(1);
  }
}

// Run migration
console.log('='.repeat(60));
console.log('  Purchase Orders Status Migration');
console.log('='.repeat(60));
console.log('');
migratePOStatus();

