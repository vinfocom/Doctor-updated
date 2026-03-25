ALTER TABLE `patients`
  ADD COLUMN `profile_type` ENUM('SELF', 'OTHER') NOT NULL DEFAULT 'SELF' AFTER `doctor_id`;

CREATE INDEX `idx_patients_admin_phone_profile_type`
  ON `patients`(`admin_id`, `phone`, `profile_type`);
