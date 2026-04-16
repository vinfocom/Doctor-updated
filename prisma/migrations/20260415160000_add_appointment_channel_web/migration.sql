ALTER TABLE `appointment`
  MODIFY COLUMN `channel` ENUM('qr_scan', 'whatsapp_web', 'telegram', 'app', 'web') NULL;
