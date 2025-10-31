const express = require('express');
const router = express.Router();

// GET /api/inventory-reports - Get inventory report up to a specific date
router.get('/', async (req, res) => {
  try {
    const { as_of_date, search, sortBy = 'serial_no', sortOrder = 'ASC' } = req.query;
    
    // If no date is provided, use current date
    const reportDate = as_of_date || new Date().toISOString().split('T')[0];
    
    let query = `
      SELECT 
        i.id,
        i.serial_no,
        i.project_no,
        i.date_po,
        i.part_no,
        i.material_no,
        i.description,
        i.uom,
        i.quantity,
        i.supplier_unit_price,
        i.total_price,
        i.sold_quantity,
        i.balance,
        i.balance_amount,
        i.created_at,
        i.updated_at
      FROM inventory i
      WHERE DATE(i.created_at) <= ?
    `;
    
    let params = [reportDate];
    
    // Add search filter
    if (search) {
      query += ` AND (
        i.serial_no LIKE ? OR 
        i.project_no LIKE ? OR 
        i.part_no LIKE ? OR 
        i.material_no LIKE ? OR 
        i.description LIKE ?
      )`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }
    
    // Add sorting
    query += ` ORDER BY ${sortBy} ${sortOrder}`;
    
    const [items] = await req.db.execute(query, params);
    
    // Calculate summary statistics
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
    const totalValue = items.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);
    const totalBalance = items.reduce((sum, item) => sum + parseFloat(item.balance || 0), 0);
    const totalBalanceAmount = items.reduce((sum, item) => sum + parseFloat(item.balance_amount || 0), 0);
    const totalSoldQuantity = items.reduce((sum, item) => sum + parseFloat(item.sold_quantity || 0), 0);
    
    res.json({
      report_date: reportDate,
      items,
      summary: {
        total_items: totalItems,
        total_quantity: totalQuantity,
        total_value: totalValue,
        total_sold_quantity: totalSoldQuantity,
        total_balance: totalBalance,
        total_balance_amount: totalBalanceAmount
      }
    });
  } catch (error) {
    console.error('Error generating inventory report:', error);
    res.status(500).json({ message: 'Error generating inventory report' });
  }
});

// GET /api/inventory-reports/export - Export inventory report to CSV
router.get('/export', async (req, res) => {
  try {
    const { as_of_date, format = 'csv' } = req.query;
    
    // If no date is provided, use current date
    const reportDate = as_of_date || new Date().toISOString().split('T')[0];
    
    const query = `
      SELECT 
        i.serial_no,
        i.project_no,
        DATE_FORMAT(i.date_po, '%Y-%m-%d') as date_po,
        i.part_no,
        i.material_no,
        i.description,
        i.uom,
        i.quantity,
        i.supplier_unit_price,
        i.total_price,
        i.sold_quantity,
        i.balance,
        i.balance_amount
      FROM inventory i
      WHERE DATE(i.created_at) <= ?
      ORDER BY i.serial_no ASC
    `;
    
    const [items] = await req.db.execute(query, [reportDate]);
    
    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Serial No',
        'Project No',
        'Date PO',
        'Part No',
        'Material No',
        'Description',
        'UOM',
        'Quantity',
        'Supplier Unit Price',
        'Total Price',
        'Sold Quantity',
        'Balance',
        'Balance Amount'
      ];
      
      let csv = headers.join(',') + '\n';
      
      items.forEach(item => {
        const row = [
          item.serial_no || '',
          item.project_no || '',
          item.date_po || '',
          item.part_no || '',
          item.material_no || '',
          `"${(item.description || '').replace(/"/g, '""')}"`, // Escape quotes in description
          item.uom || '',
          item.quantity || 0,
          item.supplier_unit_price || 0,
          item.total_price || 0,
          item.sold_quantity || 0,
          item.balance || 0,
          item.balance_amount || 0
        ];
        csv += row.join(',') + '\n';
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=inventory_report_${reportDate}.csv`);
      res.send(csv);
    } else {
      res.status(400).json({ message: 'Unsupported export format' });
    }
  } catch (error) {
    console.error('Error exporting inventory report:', error);
    res.status(500).json({ message: 'Error exporting inventory report' });
  }
});

module.exports = router;




