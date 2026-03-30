-- Seed: Dummy Billing Data for Acme Networks
-- Creates 50 clients, 150 invoices (3 months per client), invoice items, and payments
-- For tenant: acme (tenant_id = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa)
-- Idempotent: safe to run multiple times

DO $$
DECLARE
  tenant_id_val UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID;
  owner_user_id_val UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID;
  service_package_regular UUID := 'a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2'::UUID;
  service_package_business UUID := 'a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3'::UUID;
  service_package_enterprise UUID := 'a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4'::UUID;
  service_package_lite UUID := 'a5a5a5a5-a5a5-a5a5-a5a5-a5a5a5a5a5a5'::UUID;
  client_num INT;
  package_id UUID;
  category_val TEXT;
  monthly_fee_val DECIMAL(12,2);
  group_id_val UUID;
  client_rec RECORD;
  month_offset INT;
  inv_month DATE;
  period_start DATE;
  period_end DATE;
  due_date DATE;
  invoice_id UUID;
  invoice_num TEXT;
  invoice_status TEXT;
  subtotal_val BIGINT;
  total_val BIGINT;
  paid_amount_val BIGINT;
  paid_at_val TIMESTAMPTZ;
  month_num INT;
  client_counter INT;
  inv_rec RECORD;
  payment_id UUID;
  payment_method TEXT;
  payment_ref TEXT;
  payment_num INT;
  client_count INT;
  invoice_count INT;
  payment_count INT;
  group_count INT;
BEGIN
  -- 1. Insert Client Groups (optional, for variety)
  INSERT INTO client_groups (id, tenant_id, name, description, created_at, updated_at)
  VALUES
    ('11111111-1111-1111-1111-111111111111'::UUID, tenant_id_val, 'Residential', 'Residential customers', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222222'::UUID, tenant_id_val, 'Business', 'Business customers', NOW(), NOW()),
    ('33333333-3333-3333-3333-333333333333'::UUID, tenant_id_val, 'Enterprise', 'Enterprise customers', NOW(), NOW()),
    ('44444444-4444-4444-4444-444444444444'::UUID, tenant_id_val, 'VIP', 'VIP customers', NOW(), NOW())
  ON CONFLICT (tenant_id, name) DO NOTHING;

  -- 2. Insert 50 Clients
  FOR client_num IN 1..50 LOOP
    DECLARE
      v_client_code TEXT;
      v_client_id UUID;
      v_client_name TEXT;
      v_pppoe_user TEXT;
    BEGIN
      v_client_id := gen_random_uuid();
      v_client_code := 'ACME-' || LPAD(client_num::TEXT, 4, '0');
      
      -- Variasi nama
      v_client_name := CASE (client_num % 10)
        WHEN 0 THEN 'PT. ' || v_client_code || ' Corp'
        WHEN 1 THEN 'CV. ' || v_client_code || ' Jaya'
        WHEN 2 THEN 'UD. ' || v_client_code || ' Mandiri'
        WHEN 3 THEN 'Toko ' || v_client_code
        ELSE 'Customer ' || v_client_code
      END;
    
    -- Assign package based on client number (variasi)
    CASE (client_num % 4)
      WHEN 0 THEN 
        package_id := service_package_regular;
        category_val := 'regular';
        monthly_fee_val := 150000;
        group_id_val := '11111111-1111-1111-1111-111111111111'::UUID;
      WHEN 1 THEN 
        package_id := service_package_business;
        category_val := 'business';
        monthly_fee_val := 300000;
        group_id_val := '22222222-2222-2222-2222-222222222222'::UUID;
      WHEN 2 THEN 
        package_id := service_package_enterprise;
        category_val := 'enterprise';
        monthly_fee_val := 600000;
        group_id_val := '33333333-3333-3333-3333-333333333333'::UUID;
      ELSE 
        package_id := service_package_lite;
        category_val := 'lite';
        monthly_fee_val := 50000; -- per device, but set base fee for invoice
        group_id_val := '44444444-4444-4444-4444-444444444444'::UUID;
    END CASE;
    
      v_pppoe_user := 'acme-' || v_client_code;
      
      INSERT INTO clients (
        id, tenant_id, client_code, name, email, phone, address,
        category, service_package_id, monthly_fee, billing_date,
        pppoe_username, status, group_id,
        created_at, updated_at
      ) VALUES (
        v_client_id,
        tenant_id_val,
        v_client_code,
        v_client_name,
        'client' || client_num || '@acme.test',
        '+6281' || LPAD((1000000 + client_num)::TEXT, 9, '0'),
        'Jl. Test No. ' || client_num || ', Jakarta',
        category_val::VARCHAR,
        package_id,
        monthly_fee_val,
        (client_num % 28) + 1, -- billing_date 1-28
        v_pppoe_user,
        CASE WHEN client_num % 20 = 0 THEN 'isolir' ELSE 'active' END,
        group_id_val,
        NOW() - (INTERVAL '90 days' * (client_num % 3)), -- variasi created_at
        NOW()
      )
      ON CONFLICT (tenant_id, client_code) DO NOTHING;
    END;
  END LOOP;

  -- 3. Insert Invoices (3 months per client: Nov, Dec, Jan)
  -- Status distribution: ~40% paid, ~40% pending, ~15% overdue, ~5% draft
  client_counter := 0;
  FOR client_rec IN 
    SELECT id, client_code, monthly_fee 
    FROM clients 
    WHERE tenant_id = tenant_id_val 
    ORDER BY client_code
  LOOP
    client_counter := client_counter + 1;
    
    -- Generate 3 invoices (Nov, Dec, Jan)
    FOR month_num IN 0..2 LOOP
      month_offset := month_num - 2; -- -2 = Nov, -1 = Dec, 0 = Jan
      inv_month := DATE_TRUNC('month', CURRENT_DATE + (month_offset || ' months')::INTERVAL)::DATE;
      period_start := inv_month;
      period_end := (inv_month + INTERVAL '1 month - 1 day')::DATE;
      due_date := inv_month + INTERVAL '10 days'; -- due date = 10th of month
      
      invoice_id := gen_random_uuid();
      invoice_num := 'ACME-INV-' || TO_CHAR(inv_month, 'YYYY-MM') || '-' || LPAD(client_counter::TEXT, 4, '0');
      
      -- Status distribution based on client number and month
      CASE (client_counter % 20)
        WHEN 0, 1, 2, 3, 4, 5, 6, 7 THEN 
          invoice_status := 'paid';
          paid_amount_val := (client_rec.monthly_fee * 100)::BIGINT; -- convert to cents
          paid_at_val := due_date + (RANDOM() * 5 || ' days')::INTERVAL;
        WHEN 8, 9, 10, 11, 12, 13, 14, 15 THEN 
          invoice_status := 'pending';
          paid_amount_val := 0;
          paid_at_val := NULL;
        WHEN 16, 17, 18 THEN 
          invoice_status := 'overdue';
          paid_amount_val := 0;
          paid_at_val := NULL;
        ELSE 
          invoice_status := 'draft';
          paid_amount_val := 0;
          paid_at_val := NULL;
      END CASE;
      
      -- For some paid invoices, make partial payments (cicilan)
      IF invoice_status = 'paid' AND (client_counter % 10) = 0 THEN
        paid_amount_val := (paid_amount_val * 0.5)::BIGINT; -- partial payment
        invoice_status := 'pending'; -- still pending after partial
      END IF;
      
      subtotal_val := (client_rec.monthly_fee * 100)::BIGINT;
      total_val := subtotal_val;
      
      INSERT INTO invoices (
        id, tenant_id, client_id, invoice_number,
        period_start, period_end, due_date,
        subtotal, tax_amount, discount_amount, total_amount,
        paid_amount, currency, status, notes,
        created_at, updated_at, paid_at
      ) VALUES (
        invoice_id,
        tenant_id_val,
        client_rec.id,
        invoice_num,
        period_start,
        period_end,
        due_date,
        subtotal_val,
        0, -- no tax
        0, -- no discount for now
        total_val,
        paid_amount_val,
        'IDR',
        invoice_status,
        'Invoice bulanan ' || TO_CHAR(inv_month, 'Month YYYY'),
        inv_month + INTERVAL '1 day', -- created at start of month
        NOW(),
        paid_at_val
      )
      ON CONFLICT (tenant_id, invoice_number) DO NOTHING;
      
      -- Insert invoice item
      INSERT INTO invoice_items (
        id, invoice_id, description, quantity, unit_price, amount, created_at
      ) VALUES (
        gen_random_uuid(),
        invoice_id,
        'Layanan Internet Bulanan',
        1,
        subtotal_val,
        subtotal_val,
        inv_month + INTERVAL '1 day'
      );
      
    END LOOP;
  END LOOP;

  -- 4. Insert Payments for paid invoices
  payment_num := 0;
  FOR inv_rec IN 
    SELECT 
      i.id AS invoice_id,
      i.client_id,
      i.total_amount,
      i.paid_amount,
      i.paid_at,
      i.invoice_number
    FROM invoices i
    WHERE i.tenant_id = tenant_id_val
      AND i.paid_amount > 0
      AND i.paid_at IS NOT NULL
    ORDER BY i.paid_at
  LOOP
    payment_num := payment_num + 1;
    payment_id := gen_random_uuid();
    
    -- Variasi payment method
    payment_method := CASE (payment_num % 6)
      WHEN 0 THEN 'cash'
      WHEN 1 THEN 'bank_transfer'
      WHEN 2 THEN 'e_wallet'
      WHEN 3 THEN 'qris'
      WHEN 4 THEN 'virtual_account'
      ELSE 'collector'
    END;
    
    -- Reference based on method
    payment_ref := CASE payment_method
      WHEN 'cash' THEN 'CASH-' || TO_CHAR(inv_rec.paid_at, 'YYYYMMDD') || '-' || LPAD(payment_num::TEXT, 4, '0')
      WHEN 'bank_transfer' THEN 'TRF-' || TO_CHAR(inv_rec.paid_at, 'YYYYMMDD') || '-' || LPAD(payment_num::TEXT, 4, '0')
      WHEN 'e_wallet' THEN 'EW-' || TO_CHAR(inv_rec.paid_at, 'YYYYMMDD') || '-' || LPAD(payment_num::TEXT, 4, '0')
      WHEN 'qris' THEN 'QRIS-' || TO_CHAR(inv_rec.paid_at, 'YYYYMMDD') || '-' || LPAD(payment_num::TEXT, 4, '0')
      WHEN 'virtual_account' THEN 'VA-' || TO_CHAR(inv_rec.paid_at, 'YYYYMMDD') || '-' || LPAD(payment_num::TEXT, 4, '0')
      ELSE 'COL-' || TO_CHAR(inv_rec.paid_at, 'YYYYMMDD') || '-' || LPAD(payment_num::TEXT, 4, '0')
    END;
    
    INSERT INTO payments (
      id, tenant_id, invoice_id, client_id,
      amount, currency, method, reference,
      received_at, created_at, created_by_user_id
    ) VALUES (
      payment_id,
      tenant_id_val,
      inv_rec.invoice_id,
      inv_rec.client_id,
      inv_rec.paid_amount,
      'IDR',
      payment_method,
      payment_ref,
      inv_rec.paid_at,
      inv_rec.paid_at,
      owner_user_id_val
    );
    
  END LOOP;

  -- Verification
  SELECT COUNT(*) INTO client_count 
  FROM clients 
  WHERE tenant_id = tenant_id_val;
  
  SELECT COUNT(*) INTO invoice_count 
  FROM invoices 
  WHERE tenant_id = tenant_id_val;
  
  SELECT COUNT(*) INTO payment_count 
  FROM payments 
  WHERE tenant_id = tenant_id_val;
  
  SELECT COUNT(*) INTO group_count 
  FROM client_groups 
  WHERE tenant_id = tenant_id_val;
  
  RAISE NOTICE 'Seed verification (Acme):';
  RAISE NOTICE '  Client groups: %', group_count;
  RAISE NOTICE '  Clients: %', client_count;
  RAISE NOTICE '  Invoices: %', invoice_count;
  RAISE NOTICE '  Payments: %', payment_count;
  
  IF client_count < 50 THEN
    RAISE WARNING 'Expected 50 clients, got %', client_count;
  END IF;
  
  IF invoice_count < 150 THEN
    RAISE WARNING 'Expected ~150 invoices, got %', invoice_count;
  END IF;
END $$;
