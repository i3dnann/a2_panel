-- A2 Panel MySQL/MariaDB migration
-- Safe for FiveM databases: only creates a2_* tables.

CREATE TABLE IF NOT EXISTS a2_roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL UNIQUE,
  label VARCHAR(128) NOT NULL,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS a2_permissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS a2_role_permissions (
  role_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_a2_role_permissions_role FOREIGN KEY (role_id) REFERENCES a2_roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_a2_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES a2_permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS a2_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(128) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT UNSIGNED NULL,
  disabled TINYINT(1) NOT NULL DEFAULT 0,
  failed_login_count INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_a2_users_role FOREIGN KEY (role_id) REFERENCES a2_roles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE a2_users
  ADD COLUMN IF NOT EXISTS discord_id VARCHAR(32) NULL AFTER display_name,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL AFTER discord_id,
  ADD COLUMN IF NOT EXISTS login_provider ENUM('password','discord','both') NOT NULL DEFAULT 'password' AFTER password_hash,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER disabled;

CREATE UNIQUE INDEX IF NOT EXISTS idx_a2_users_discord_id ON a2_users (discord_id);

CREATE TABLE IF NOT EXISTS a2_user_permissions (
  user_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  allowed TINYINT(1) NOT NULL DEFAULT 1,
  granted_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission_id),
  CONSTRAINT fk_a2_user_permissions_user FOREIGN KEY (user_id) REFERENCES a2_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_a2_user_permissions_permission FOREIGN KEY (permission_id) REFERENCES a2_permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS a2_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  token_id VARCHAR(128) NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_a2_sessions_user (user_id),
  CONSTRAINT fk_a2_sessions_user FOREIGN KEY (user_id) REFERENCES a2_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS a2_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  staff_user_id INT UNSIGNED NULL,
  staff_name VARCHAR(128) NOT NULL,
  action_type VARCHAR(128) NOT NULL,
  target_player VARCHAR(128) NULL,
  reason TEXT NULL,
  metadata JSON NULL,
  ip_address VARCHAR(64) NULL,
  success TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_a2_audit_action (action_type),
  KEY idx_a2_audit_staff (staff_name),
  KEY idx_a2_audit_target (target_player),
  KEY idx_a2_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS a2_bans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  target_name VARCHAR(128) NOT NULL,
  citizenid VARCHAR(64) NULL,
  license VARCHAR(128) NULL,
  steam VARCHAR(128) NULL,
  discord VARCHAR(128) NULL,
  fivem VARCHAR(128) NULL,
  ip VARCHAR(64) NULL,
  reason TEXT NOT NULL,
  evidence TEXT NULL,
  staff_user_id INT UNSIGNED NULL,
  staff_name VARCHAR(128) NOT NULL,
  permanent TINYINT(1) NOT NULL DEFAULT 0,
  expires_at DATETIME NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  evasion_notes TEXT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_a2_bans_active (active),
  KEY idx_a2_bans_identifiers (citizenid, license, discord)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS a2_warnings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  target_name VARCHAR(128) NOT NULL,
  citizenid VARCHAR(64) NULL,
  license VARCHAR(128) NULL,
  severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'low',
  reason TEXT NOT NULL,
  evidence TEXT NULL,
  staff_user_id INT UNSIGNED NULL,
  staff_name VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_a2_warnings_target (target_name, citizenid),
  KEY idx_a2_warnings_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS a2_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter_name VARCHAR(128) NOT NULL,
  reporter_server_id INT NULL,
  reporter_citizenid VARCHAR(64) NULL,
  message TEXT NOT NULL,
  status ENUM('pending','claimed','closed') NOT NULL DEFAULT 'pending',
  assigned_staff_id INT UNSIGNED NULL,
  assigned_staff_name VARCHAR(128) NULL,
  resolution TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_a2_reports_status (status),
  KEY idx_a2_reports_reporter (reporter_name, reporter_citizenid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS a2_report_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id BIGINT UNSIGNED NOT NULL,
  staff_user_id INT UNSIGNED NULL,
  staff_name VARCHAR(128) NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_a2_report_notes_report (report_id),
  CONSTRAINT fk_a2_report_notes_report FOREIGN KEY (report_id) REFERENCES a2_reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE a2_report_notes
  ADD COLUMN IF NOT EXISTS sent_to_player TINYINT(1) NOT NULL DEFAULT 0 AFTER note;

CREATE TABLE IF NOT EXISTS a2_player_action_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  command_id VARCHAR(64) NULL,
  action_type VARCHAR(128) NOT NULL,
  target_identifier VARCHAR(128) NULL,
  target_server_id INT NULL,
  staff_user_id INT UNSIGNED NULL,
  staff_name VARCHAR(128) NOT NULL,
  reason TEXT NULL,
  payload JSON NULL,
  status ENUM('queued','sent','complete','failed') NOT NULL DEFAULT 'queued',
  result JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_a2_player_action_target (target_identifier, target_server_id),
  KEY idx_a2_player_action_command (command_id),
  KEY idx_a2_player_action_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS a2_staff_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  target_identifier VARCHAR(128) NOT NULL,
  staff_user_id INT UNSIGNED NULL,
  staff_name VARCHAR(128) NOT NULL,
  note TEXT NOT NULL,
  suspicious TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_a2_staff_notes_target (target_identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS a2_settings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(128) NOT NULL UNIQUE,
  setting_value JSON NULL,
  is_secret TINYINT(1) NOT NULL DEFAULT 0,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS a2_discord_webhooks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(64) NOT NULL UNIQUE,
  webhook_url TEXT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS a2_screenshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  target_identifier VARCHAR(128) NOT NULL,
  server_id INT NULL,
  requested_by INT UNSIGNED NULL,
  requested_by_name VARCHAR(128) NOT NULL,
  url TEXT NULL,
  status ENUM('requested','complete','failed') NOT NULL DEFAULT 'requested',
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_a2_screenshots_target (target_identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS a2_console_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  staff_user_id INT UNSIGNED NULL,
  staff_name VARCHAR(128) NOT NULL,
  command VARCHAR(255) NOT NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'queued',
  output TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_a2_console_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS a2_saved_commands (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  command VARCHAR(255) NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
