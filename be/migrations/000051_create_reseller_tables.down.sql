-- Drop reseller tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS reseller_purchases CASCADE;
DROP TABLE IF EXISTS reseller_discounts CASCADE;
DROP TABLE IF EXISTS reseller_prices CASCADE;
DROP TABLE IF EXISTS resellers CASCADE;
