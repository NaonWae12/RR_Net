-- Down Migration: Drop WhatsApp templates + unified message logs

DROP TABLE IF EXISTS wa_message_logs;
DROP TABLE IF EXISTS wa_templates;


