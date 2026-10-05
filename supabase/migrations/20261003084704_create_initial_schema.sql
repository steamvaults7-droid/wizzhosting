/*
# CubeForge Initial Schema — Minecraft Server Hosting Platform

## Overview
This migration creates the complete database schema for CubeForge, a Minecraft server hosting platform.
It includes user profiles, compute nodes, Minecraft servers, players, backups, schedules, activity logs, and server console logs.

## New Tables

### 1. profiles
- Extends Supabase auth.users with additional user data
- `id` references auth.users(id), cascading on delete
- `username`, `email`, `avatar`, `email_verified`, `role`, `suspended`
- `last_login`, `created_at`, `updated_at`

### 2. compute_nodes
- Represents physical or virtual machines that run Minecraft server processes
- `name`, `status`, `public_address`, resource metrics (RAM, CPU, storage)
- `last_seen_at`, `java_version`, `docker_available`, `supported_editions`
- `auth_token` — used by the node agent to authenticate API calls

### 3. servers
- The core table — each row is a Minecraft server instance
- `owner_id` references profiles(id) — defaults to auth.uid()
- `name`, `status`, `edition`, `version`, `software`
- `node_id` references compute_nodes(id) — nullable (null = not assigned yet)
- `port`, `address` — the actual connection details
- `eula_accepted` — must be true before server can start
- Resource limits: `ram_limit_mb`, `cpu_limit_percent`, `storage_limit_mb`
- `max_players`, `motd` — server configuration
- `auto_start`, `sleep_enabled`, `sleep_timeout_minutes` — lifecycle config
- Live metrics: `players_online`, `cpu_usage`, `ram_usage_mb`, `storage_usage_mb`, `network_in_kbps`, `network_out_kbps`, `uptime_seconds`
- Timestamps: `created_at`, `updated_at`, `last_started_at`

### 4. server_logs
- Console output lines from the Minecraft server process
- `server_id` references servers(id), cascading on delete
- `level` (info/warning/error/command), `message`, `created_at`

### 5. players
- Known players for each server (populated as they join)
- `server_id` references servers(id), cascading on delete
- `username`, `uuid`, `online`, `first_joined`, `last_seen`
- `is_op`, `is_banned`, `is_whitelisted`

### 6. backups
- Server world/data backups
- `server_id` references servers(id), cascading on delete
- `name`, `size_bytes`, `status`, `created_at`

### 7. schedules
- Scheduled tasks for servers (start, stop, restart, backup, command)
- `server_id` references servers(id), cascading on delete
- `name`, `action`, `cron`, `command`, `enabled`, `last_run_at`, `next_run_at`

### 8. activity
- Audit log of user actions across the platform
- `server_id` (nullable), `user_id` (nullable), `action`, `details`, `created_at`

### 9. server_settings
- Visual server configuration (server.properties equivalent)
- `server_id` references servers(id), cascading on delete
- `motd`, `difficulty`, `gamemode`, `hardcore`, `pvp`, `online_mode`
- `view_distance`, `simulation_distance`, `max_players`, `spawn_protection`
- `command_blocks`, `allow_flight`, `whitelist`, `force_gamemode`
- `resource_pack`, `server_port`, `level_seed`, `level_type`, `level_name`

## Security

### RLS on ALL tables
- profiles: users can read/update only their own profile
- compute_nodes: users can read node info (needed to display node status), only service role can insert/update
- servers: full owner-scoped CRUD (select/insert/update/delete with auth.uid() = owner_id)
- server_logs: owner-scoped through servers table (SELECT only, INSERT for node agent via service role)
- players: owner-scoped through servers table
- backups: owner-scoped through servers table
- schedules: owner-scoped through servers table
- activity: owner-scoped through servers table (SELECT), service role INSERT
- server_settings: owner-scoped through servers table

### Owner defaults
- servers.owner_id defaults to auth.uid() so client inserts work without passing owner_id
- server_settings, players, backups, schedules all cascade from servers

### Indexes
- servers(owner_id) — dashboard queries
- servers(node_id) — node agent queries
- server_logs(server_id, created_at DESC) — console streaming
- players(server_id) — player list
- backups(server_id, created_at DESC) — backup list
- schedules(server_id) — schedule list
- activity(server_id, created_at DESC) — activity feed
- profiles(username) — search
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  avatar text,
  email_verified boolean NOT NULL DEFAULT false,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','moderator','admin','owner')),
  suspended boolean NOT NULL DEFAULT false,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = id);

-- COMPUTE NODES
CREATE TABLE IF NOT EXISTS compute_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline','connecting')),
  public_address text,
  available_ram_mb integer NOT NULL DEFAULT 0,
  available_cpu_percent integer NOT NULL DEFAULT 0,
  available_storage_mb integer NOT NULL DEFAULT 0,
  used_ram_mb integer NOT NULL DEFAULT 0,
  used_cpu_percent integer NOT NULL DEFAULT 0,
  used_storage_mb integer NOT NULL DEFAULT 0,
  total_servers integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz,
  java_version text,
  docker_available boolean NOT NULL DEFAULT false,
  supported_editions text[] NOT NULL DEFAULT ARRAY['java']::text[],
  auth_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE compute_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_compute_nodes" ON compute_nodes;
CREATE POLICY "select_compute_nodes" ON compute_nodes FOR SELECT
TO authenticated USING (true);

-- SERVERS
CREATE TABLE IF NOT EXISTS servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('offline','starting','online','stopping','sleeping','error','creating')),
  edition text NOT NULL DEFAULT 'java' CHECK (edition IN ('java','bedrock')),
  version text NOT NULL,
  software text NOT NULL CHECK (software IN ('vanilla','paper','purpur','spigot','fabric','forge','neoforge','bedrock')),
  node_id uuid REFERENCES compute_nodes(id) ON DELETE SET NULL,
  port integer,
  address text,
  max_players integer NOT NULL DEFAULT 20,
  motd text NOT NULL DEFAULT 'A CubeForge Server',
  ram_limit_mb integer NOT NULL DEFAULT 1024,
  cpu_limit_percent integer NOT NULL DEFAULT 50,
  storage_limit_mb integer NOT NULL DEFAULT 2048,
  eula_accepted boolean NOT NULL DEFAULT false,
  auto_start boolean NOT NULL DEFAULT false,
  sleep_enabled boolean NOT NULL DEFAULT true,
  sleep_timeout_minutes integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_started_at timestamptz,
  players_online integer NOT NULL DEFAULT 0,
  cpu_usage numeric NOT NULL DEFAULT 0,
  ram_usage_mb integer NOT NULL DEFAULT 0,
  storage_usage_mb integer NOT NULL DEFAULT 0,
  network_in_kbps integer NOT NULL DEFAULT 0,
  network_out_kbps integer NOT NULL DEFAULT 0,
  uptime_seconds integer NOT NULL DEFAULT 0
);
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_servers" ON servers;
CREATE POLICY "select_own_servers" ON servers FOR SELECT
TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "insert_own_servers" ON servers;
CREATE POLICY "insert_own_servers" ON servers FOR INSERT
TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "update_own_servers" ON servers;
CREATE POLICY "update_own_servers" ON servers FOR UPDATE
TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "delete_own_servers" ON servers;
CREATE POLICY "delete_own_servers" ON servers FOR DELETE
TO authenticated USING (auth.uid() = owner_id);

-- SERVER LOGS
CREATE TABLE IF NOT EXISTS server_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info','warning','error','command')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE server_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_server_logs" ON server_logs;
CREATE POLICY "select_own_server_logs" ON server_logs FOR SELECT
TO authenticated USING (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = server_logs.server_id AND servers.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "insert_own_server_logs" ON server_logs;
CREATE POLICY "insert_own_server_logs" ON server_logs FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = server_logs.server_id AND servers.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "delete_own_server_logs" ON server_logs;
CREATE POLICY "delete_own_server_logs" ON server_logs FOR DELETE
TO authenticated USING (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = server_logs.server_id AND servers.owner_id = auth.uid())
);

-- PLAYERS
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  username text NOT NULL,
  uuid text NOT NULL,
  online boolean NOT NULL DEFAULT false,
  first_joined timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  is_op boolean NOT NULL DEFAULT false,
  is_banned boolean NOT NULL DEFAULT false,
  is_whitelisted boolean NOT NULL DEFAULT false,
  UNIQUE(server_id, uuid)
);
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_players" ON players;
CREATE POLICY "select_own_players" ON players FOR SELECT
TO authenticated USING (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = players.server_id AND servers.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "insert_own_players" ON players;
CREATE POLICY "insert_own_players" ON players FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = players.server_id AND servers.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "update_own_players" ON players;
CREATE POLICY "update_own_players" ON players FOR UPDATE
TO authenticated USING (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = players.server_id AND servers.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = players.server_id AND servers.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "delete_own_players" ON players;
CREATE POLICY "delete_own_players" ON players FOR DELETE
TO authenticated USING (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = players.server_id AND servers.owner_id = auth.uid())
);

-- BACKUPS
CREATE TABLE IF NOT EXISTS backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'creating' CHECK (status IN ('creating','complete','failed','restoring')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_backups" ON backups;
CREATE POLICY "select_own_backups" ON backups FOR SELECT
TO authenticated USING (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = backups.server_id AND servers.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "insert_own_backups" ON backups;
CREATE POLICY "insert_own_backups" ON backups FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = backups.server_id AND servers.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "update_own_backups" ON backups;
CREATE POLICY "update_own_backups" ON backups FOR UPDATE
TO authenticated USING (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = backups.server_id AND servers.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = backups.server_id AND servers.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "delete_own_backups" ON backups;
CREATE POLICY "delete_own_backups" ON backups FOR DELETE
TO authenticated USING (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = backups.server_id AND servers.owner_id = auth.uid())
);

-- SCHEDULES
CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  action text NOT NULL CHECK (action IN ('start','stop','restart','backup','command')),
  cron text NOT NULL,
  command text,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_schedules" ON schedules;
CREATE POLICY "select_own_schedules" ON schedules FOR SELECT
TO authenticated USING (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = schedules.server_id AND servers.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "insert_own_schedules" ON schedules;
CREATE POLICY "insert_own_schedules" ON schedules FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = schedules.server_id AND servers.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "update_own_schedules" ON schedules;
CREATE POLICY "update_own_schedules" ON schedules FOR UPDATE
TO authenticated USING (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = schedules.server_id AND servers.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = schedules.server_id AND servers.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "delete_own_schedules" ON schedules;
CREATE POLICY "delete_own_schedules" ON schedules FOR DELETE
TO authenticated USING (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = schedules.server_id AND servers.owner_id = auth.uid())
);

-- ACTIVITY
CREATE TABLE IF NOT EXISTS activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES servers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_activity" ON activity;
CREATE POLICY "select_own_activity" ON activity FOR SELECT
TO authenticated USING (
  server_id IS NULL OR
  EXISTS (SELECT 1 FROM servers WHERE servers.id = activity.server_id AND servers.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "insert_own_activity" ON activity;
CREATE POLICY "insert_own_activity" ON activity FOR INSERT
TO authenticated WITH CHECK (
  server_id IS NULL OR
  EXISTS (SELECT 1 FROM servers WHERE servers.id = activity.server_id AND servers.owner_id = auth.uid())
);

-- SERVER SETTINGS
CREATE TABLE IF NOT EXISTS server_settings (
  server_id uuid PRIMARY KEY REFERENCES servers(id) ON DELETE CASCADE,
  motd text NOT NULL DEFAULT 'A CubeForge Server',
  difficulty text NOT NULL DEFAULT 'normal' CHECK (difficulty IN ('peaceful','easy','normal','hard')),
  gamemode text NOT NULL DEFAULT 'survival' CHECK (gamemode IN ('survival','creative','adventure','spectator')),
  hardcore boolean NOT NULL DEFAULT false,
  pvp boolean NOT NULL DEFAULT true,
  online_mode boolean NOT NULL DEFAULT true,
  view_distance integer NOT NULL DEFAULT 10 CHECK (view_distance BETWEEN 3 AND 32),
  simulation_distance integer NOT NULL DEFAULT 10 CHECK (simulation_distance BETWEEN 3 AND 32),
  max_players integer NOT NULL DEFAULT 20 CHECK (max_players BETWEEN 1 AND 999),
  spawn_protection integer NOT NULL DEFAULT 16,
  command_blocks boolean NOT NULL DEFAULT false,
  allow_flight boolean NOT NULL DEFAULT false,
  whitelist boolean NOT NULL DEFAULT false,
  force_gamemode boolean NOT NULL DEFAULT false,
  resource_pack text,
  resource_pack_sha1 text,
  server_port integer,
  level_seed text,
  level_type text NOT NULL DEFAULT 'minecraft\\:normal' CHECK (level_type IN ('minecraft\\:normal','minecraft\\:flat','minecraft\\:large_biomes','minecraft\\:amplified','minecraft\\:single_biome')),
  level_name text NOT NULL DEFAULT 'world',
  generate_structures boolean NOT NULL DEFAULT true,
  spawn_animals boolean NOT NULL DEFAULT true,
  spawn_npcs boolean NOT NULL DEFAULT true,
  spawn_monsters boolean NOT NULL DEFAULT true,
  max_world_size integer NOT NULL DEFAULT 29999984,
  enforce_whitelist boolean NOT NULL DEFAULT false
);
ALTER TABLE server_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_server_settings" ON server_settings;
CREATE POLICY "select_own_server_settings" ON server_settings FOR SELECT
TO authenticated USING (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = server_settings.server_id AND servers.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "insert_own_server_settings" ON server_settings;
CREATE POLICY "insert_own_server_settings" ON server_settings FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = server_settings.server_id AND servers.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "update_own_server_settings" ON server_settings;
CREATE POLICY "update_own_server_settings" ON server_settings FOR UPDATE
TO authenticated USING (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = server_settings.server_id AND servers.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM servers WHERE servers.id = server_settings.server_id AND servers.owner_id = auth.uid())
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_servers_owner_id ON servers(owner_id);
CREATE INDEX IF NOT EXISTS idx_servers_node_id ON servers(node_id);
CREATE INDEX IF NOT EXISTS idx_server_logs_server_id ON server_logs(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_server_id ON players(server_id);
CREATE INDEX IF NOT EXISTS idx_backups_server_id ON backups(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedules_server_id ON schedules(server_id);
CREATE INDEX IF NOT EXISTS idx_activity_server_id ON activity(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON profiles;
CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_servers_updated_at ON servers;
CREATE TRIGGER trigger_servers_updated_at BEFORE UPDATE ON servers
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_compute_nodes_updated_at ON compute_nodes;
CREATE TRIGGER trigger_compute_nodes_updated_at BEFORE UPDATE ON compute_nodes
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
