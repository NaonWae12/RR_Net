-- 1. Delete orphan reseller_purchase transactions whose purchase record was deleted
DELETE FROM finance_transactions
WHERE source = 'reseller_purchase'
  AND source_id NOT IN (SELECT id FROM reseller_purchases);

-- 2. Delete orphan voucher_usage transactions whose voucher record was deleted
DELETE FROM finance_transactions
WHERE source = 'voucher_usage'
  AND source_id NOT IN (SELECT id FROM vouchers);

-- 3. Recalculate tenant_balances to reflect accurate total balance
UPDATE tenant_balances tb
SET balance = COALESCE((
    SELECT SUM(CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount ELSE 0 END)
    FROM finance_transactions ft
    WHERE ft.tenant_id = tb.tenant_id
), 0);
