/*
# Add custom address column and clean up stale data

1. Changes
- Add `custom_address` text column to `servers` table (nullable)
  - When set, this overrides the auto-detected IP:port address shown to users
  - Lets users display a domain name instead of raw IP numbers

2. Data cleanup
- Mark all compute_nodes with stale last_seen_at (>60s old) as offline
- Mark all servers on stale nodes as offline (not error)
- Reset any servers stuck in 'starting' or 'stopping' for more than 2 minutes back to 'offline'
  (these get stuck when the node was killed mid-action)

3. Security
- No RLS changes — existing policies remain in place
*/

-- Add custom_address column
ALTER TABLE servers ADD COLUMN IF NOT EXISTS custom_address text;

-- Mark stale nodes as offline
UPDATE compute_nodes
SET status = 'offline'
WHERE status = 'online'
  AND last_seen_at < (now() - interval '60 seconds');

-- Mark servers on stale/offline nodes as offline
UPDATE servers
SET status = 'offline', players_online = 0, updated_at = now()
WHERE node_id IN (
  SELECT id FROM compute_nodes WHERE status = 'offline'
)
AND status IN ('online', 'starting', 'stopping');

-- Reset servers stuck in starting/stopping for more than 2 minutes
UPDATE servers
SET status = 'offline', updated_at = now()
WHERE status IN ('starting', 'stopping')
  AND updated_at < (now() - interval '2 minutes');
