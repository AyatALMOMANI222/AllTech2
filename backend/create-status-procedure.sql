-- Create stored procedure to update purchase order status
-- This procedure calculates delivered quantities and updates PO status accordingly

DROP PROCEDURE IF EXISTS update_purchase_order_status_fn;

DELIMITER $$

CREATE PROCEDURE update_purchase_order_status_fn(IN po_id_param INT)
BEGIN
  DECLARE total_ordered DECIMAL(10,2) DEFAULT 0;
  DECLARE total_delivered DECIMAL(10,2) DEFAULT 0;
  DECLARE new_status VARCHAR(50);
  
  -- Calculate total ordered quantity
  SELECT COALESCE(SUM(quantity), 0) INTO total_ordered
  FROM purchase_order_items
  WHERE po_id = po_id_param;
  
  -- Calculate total delivered quantity
  SELECT COALESCE(SUM(delivered_quantity), 0) INTO total_delivered
  FROM purchase_order_items
  WHERE po_id = po_id_param;
  
  -- Determine new status
  IF total_delivered = 0 THEN
    SET new_status = 'approved';
  ELSEIF total_delivered >= total_ordered THEN
    SET new_status = 'delivered_completed';
  ELSE
    SET new_status = 'partially_delivered';
  END IF;
  
  -- Update PO status
  UPDATE purchase_orders
  SET status = new_status
  WHERE id = po_id_param;
END$$

DELIMITER ;

