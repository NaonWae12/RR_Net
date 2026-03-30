-- Migration Down: Remove relational tables for addon features and limits

DROP TABLE IF EXISTS addon_features;
DROP TABLE IF EXISTS addon_limits;
