-- A2 Panel seed data
-- Default login is admin / admin. Change it immediately after first login.

INSERT IGNORE INTO a2_roles (name, label, description) VALUES
('Owner', 'Owner', 'Full A2 Panel access'),
('Super Admin', 'Super Admin', 'All operational access except owner-only deletion by default'),
('Admin', 'Admin', 'Advanced staff management and server operations'),
('Moderator', 'Moderator', 'Player moderation operations'),
('Support', 'Support', 'Reports and basic player support'),
('Viewer', 'Viewer', 'Read-only panel access');

INSERT IGNORE INTO a2_permissions (name, description) VALUES
('dashboard.view', 'View dashboard'),
('players.view', 'View online and offline players'),
('players.kick', 'Kick players'),
('players.ban', 'Ban players'),
('players.warn', 'Warn players'),
('players.revive', 'Revive players'),
('players.heal', 'Heal players'),
('players.teleport', 'Teleport, bring, freeze, and go-to actions'),
('players.screenshot', 'Request screenshots'),
('players.inventory.view', 'View inventory'),
('players.inventory.edit', 'Edit inventory'),
('players.money.view', 'View money accounts'),
('players.money.edit', 'Edit money accounts'),
('players.job.edit', 'Edit jobs'),
('players.gang.edit', 'Edit gangs'),
('bans.view', 'View bans'),
('bans.create', 'Create and edit bans'),
('bans.delete', 'Delete and unban'),
('reports.view', 'View reports'),
('reports.claim', 'Claim and note reports'),
('reports.close', 'Close reports'),
('staff.view', 'View staff'),
('staff.create', 'Create staff'),
('staff.edit', 'Edit staff'),
('staff.delete', 'Delete staff'),
('settings.view', 'View settings'),
('settings.edit', 'Edit settings'),
('console.use', 'Use FiveM console commands'),
('logs.view', 'View audit logs'),
('database.write', 'Perform database write actions');

INSERT IGNORE INTO a2_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM a2_roles r JOIN a2_permissions p WHERE r.name = 'Owner';

INSERT IGNORE INTO a2_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM a2_roles r JOIN a2_permissions p WHERE r.name = 'Super Admin' AND p.name <> 'staff.delete';

INSERT IGNORE INTO a2_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM a2_roles r JOIN a2_permissions p WHERE r.name = 'Admin' AND p.name IN (
  'dashboard.view','players.view','players.kick','players.ban','players.warn','players.revive','players.heal','players.teleport',
  'players.screenshot','players.inventory.view','players.inventory.edit','players.money.view','players.money.edit','players.job.edit',
  'players.gang.edit','bans.view','bans.create','reports.view','reports.claim','reports.close','settings.view','console.use','logs.view','database.write'
);

INSERT IGNORE INTO a2_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM a2_roles r JOIN a2_permissions p WHERE r.name = 'Moderator' AND p.name IN (
  'dashboard.view','players.view','players.kick','players.ban','players.warn','players.revive','players.heal','players.teleport',
  'players.inventory.view','players.money.view','bans.view','bans.create','reports.view','reports.claim','reports.close','logs.view'
);

INSERT IGNORE INTO a2_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM a2_roles r JOIN a2_permissions p WHERE r.name = 'Support' AND p.name IN (
  'dashboard.view','players.view','players.warn','reports.view','reports.claim','reports.close'
);

INSERT IGNORE INTO a2_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM a2_roles r JOIN a2_permissions p WHERE r.name = 'Viewer' AND p.name IN (
  'dashboard.view','players.view','bans.view','reports.view','logs.view'
);

INSERT INTO a2_users (username, display_name, password_hash, role_id)
VALUES ('admin', 'A2 Owner', '$2a$12$abmaBhO8JMYvlEIqwB0.8eaYFdzwMAUgghx8XgiQNwg2x3LnrfYbm', (SELECT id FROM a2_roles WHERE name = 'Owner' LIMIT 1))
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), role_id = VALUES(role_id);

INSERT INTO a2_settings (setting_key, setting_value, is_secret) VALUES
('serverName', JSON_QUOTE('A2 FiveM Server'), 0),
('backendPublicUrl', JSON_QUOTE('http://localhost:3001'), 0),
('fivemServerIp', JSON_QUOTE('127.0.0.1'), 0),
('fivemServerPort', '30120', 0),
('frameworkMode', JSON_QUOTE('qbcore'), 0),
('accentColor', JSON_QUOTE('#b7fe1a'), 0),
('logoText', JSON_QUOTE('A2 Panel'), 0),
('modules', '{"reports":true,"discord":true,"screenshot":true,"console":true,"inventory":true,"money":true,"vehicles":true,"jobsGangs":true,"liveView":true}', 0),
('tableMapping', '{"qbcore":{"players":"players","vehicles":"player_vehicles"},"esx":{"users":"users","vehicles":"owned_vehicles"}}', 0)
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

INSERT IGNORE INTO a2_discord_webhooks (name, webhook_url, enabled) VALUES
('admin', NULL, 1),
('bans', NULL, 1),
('kicks', NULL, 1),
('warnings', NULL, 1),
('reports', NULL, 1),
('login', NULL, 1),
('errors', NULL, 1),
('joins_leaves', NULL, 1);

INSERT INTO a2_audit_logs (staff_user_id, staff_name, action_type, target_player, reason, metadata, ip_address, success)
VALUES
(NULL, 'A2 Panel', 'system.seed', NULL, 'A2 Panel seed data imported', '{"demo":true}', NULL, 1),
(NULL, 'A2 Panel', 'security.notice', 'admin', 'Default admin/admin must be changed in production', '{"defaultLogin":"admin/admin"}', NULL, 1);
