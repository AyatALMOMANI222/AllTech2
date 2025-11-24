-- Fix Purchase Tax Invoice Triggers to handle multiple POs with same po_number
-- After removing UNIQUE constraint on po_number, we need to filter by order_type = 'supplier'

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_purchase_order_status_after_invoice_insert;
DROP TRIGGER IF EXISTS update_purchase_order_status_after_invoice_update;
DROP TRIGGER IF EXISTS update_purchase_order_status_after_invoice_delete;

-- Recreate trigger for AFTER INSERT
DELIMITER $$
CREATE TRIGGER update_purchase_order_status_after_invoice_insert
AFTER INSERT ON purchase_tax_invoice_items
FOR EACH ROW
BEGIN
  DECLARE po_id_var INT;
  DECLARE po_number_var VARCHAR(100);
  
  -- Get the purchase order ID - only for supplier POs
  -- Add LIMIT 1 and filter by order_type = 'supplier' to handle multiple POs with same po_number
  SELECT po.id, po.po_number INTO po_id_var, po_number_var
  FROM purchase_tax_invoices pt
  INNER JOIN purchase_orders po ON pt.po_number = po.po_number AND po.order_type = 'supplier'
  WHERE pt.id = NEW.invoice_id
  LIMIT 1;
  
  -- Only update if PO was found
  IF po_id_var IS NOT NULL THEN
    CALL update_purchase_order_status_fn(po_id_var);
  END IF;
END$$
DELIMITER ;

-- Recreate trigger for AFTER UPDATE
DELIMITER $$
CREATE TRIGGER update_purchase_order_status_after_invoice_update
AFTER UPDATE ON purchase_tax_invoice_items
FOR EACH ROW
BEGIN
  DECLARE po_id_var INT;
  DECLARE po_number_var VARCHAR(100);
  
  -- Get the purchase order ID - only for supplier POs
  -- Add LIMIT 1 and filter by order_type = 'supplier' to handle multiple POs with same po_number
  SELECT po.id, po.po_number INTO po_id_var, po_number_var
  FROM purchase_tax_invoices pt
  INNER JOIN purchase_orders po ON pt.po_number = po.po_number AND po.order_type = 'supplier'
  WHERE pt.id = NEW.invoice_id
  LIMIT 1;
  
  -- Only update if PO was found
  IF po_id_var IS NOT NULL THEN
    CALL update_purchase_order_status_fn(po_id_var);
  END IF;
END$$
DELIMITER ;

-- Recreate trigger for AFTER DELETE
DELIMITER $$
CREATE TRIGGER update_purchase_order_status_after_invoice_delete
AFTER DELETE ON purchase_tax_invoice_items
FOR EACH ROW
BEGIN
  DECLARE po_id_var INT;
  DECLARE po_number_var VARCHAR(100);
  
  -- Get the purchase order ID - only for supplier POs
  -- Add LIMIT 1 and filter by order_type = 'supplier' to handle multiple POs with same po_number
  SELECT po.id, po.po_number INTO po_id_var, po_number_var
  FROM purchase_tax_invoices pt
  INNER JOIN purchase_orders po ON pt.po_number = po.po_number AND po.order_type = 'supplier'
  WHERE pt.id = OLD.invoice_id
  LIMIT 1;
  
  -- Only update if PO was found
  IF po_id_var IS NOT NULL THEN
    CALL update_purchase_order_status_fn(po_id_var);
  END IF;
END$$
DELIMITER ;

