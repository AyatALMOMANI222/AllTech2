const express = require('express');
const router = express.Router();

// Temporary endpoint to fix status ENUM - REMOVE AFTER USE
router.post('/fix-status-enum', async (req, res) => {
  try {
    const db = req.db;
    
    console.log('Starting status ENUM fix...');
    
    // Step 1: Update existing 'delivered' status to 'delivered_completed'
    const [updateResult] = await db.execute(
      `UPDATE purchase_orders SET status = 'delivered_completed' WHERE status = 'delivered'`
    );
    console.log(`✓ Updated ${updateResult.affectedRows} rows from 'delivered' to 'delivered_completed'`);
    
    // Step 2: Modify the ENUM to include new values
    await db.execute(`
      ALTER TABLE purchase_orders 
      MODIFY COLUMN status ENUM('approved', 'partially_delivered', 'delivered_completed') 
      DEFAULT 'approved'
    `);
    
    console.log('✓ Successfully updated purchase_orders status ENUM');
    
    res.json({
      success: true,
      message: 'Status ENUM updated successfully!',
      updatedRows: updateResult.affectedRows,
      newValues: ['approved', 'partially_delivered', 'delivered_completed']
    });
    
  } catch (error) {
    console.error('Error updating ENUM:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating ENUM',
      error: error.message
    });
  }
});

module.exports = router;

