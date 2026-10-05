// CubeForge Node API Edge Function v3
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let path = url.pathname;
    path = path.replace(/^\/functions\/v1\/node-api/, "");
    path = path.replace(/^\/node-api/, "");

    // Node registration
    if (path === "/register" && req.method === "POST") {
      const body = await req.json();
      const { name, publicAddress, availableRamMb, availableCpuPercent, availableStorageMb, javaVersion, dockerAvailable } = body;

      // FIRST: check if a node with this name already exists
      // (stable name means restarts find the same record)
      const { data: existing } = await supabase
        .from("compute_nodes")
        .select("*")
        .eq("name", name)
        .maybeSingle();

      let nodeIdResult: string;

      if (existing) {
        // Reuse existing node record — update it to online
        const { data: updated } = await supabase
          .from("compute_nodes")
          .update({
            status: "online",
            public_address: publicAddress,
            available_ram_mb: availableRamMb,
            available_cpu_percent: availableCpuPercent,
            available_storage_mb: availableStorageMb,
            used_ram_mb: 0,
            used_cpu_percent: 0,
            used_storage_mb: 0,
            total_servers: 0,
            last_seen_at: new Date().toISOString(),
            java_version: javaVersion,
            docker_available: dockerAvailable,
          })
          .eq("id", existing.id)
          .select()
          .single();

        nodeIdResult = updated.id;

        // Reassign orphaned servers: any server whose node is offline
        // or whose node_id is null gets assigned to this node
        const { data: offlineNodes } = await supabase
          .from("compute_nodes")
          .select("id")
          .eq("status", "offline");

        const offlineNodeIds = (offlineNodes || []).map((n: any) => n.id);

        // Reassign servers from offline nodes to this node
        if (offlineNodeIds.length > 0) {
          await supabase
            .from("servers")
            .update({ node_id: nodeIdResult, updated_at: new Date().toISOString() })
            .in("node_id", offlineNodeIds);
        }

        // Also reassign servers with no node_id
        await supabase
          .from("servers")
          .update({ node_id: nodeIdResult, updated_at: new Date().toISOString() })
          .is("node_id", null);

        // Mark any servers that were stuck in starting/stopping as offline
        await supabase
          .from("servers")
          .update({ status: "offline", players_online: 0, updated_at: new Date().toISOString() })
          .eq("node_id", nodeIdResult)
          .in("status", ["starting", "stopping"]);

        return new Response(JSON.stringify({ nodeId: nodeIdResult, authToken: existing.auth_token }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // No existing node with this name — create new one
      const authToken = crypto.randomUUID();
      const { data, error } = await supabase
        .from("compute_nodes")
        .insert({
          name,
          status: "online",
          public_address: publicAddress,
          available_ram_mb: availableRamMb,
          available_cpu_percent: availableCpuPercent,
          available_storage_mb: availableStorageMb,
          used_ram_mb: 0,
          used_cpu_percent: 0,
          used_storage_mb: 0,
          total_servers: 0,
          last_seen_at: new Date().toISOString(),
          java_version: javaVersion,
          docker_available: dockerAvailable,
          supported_editions: ["java", "bedrock"],
          auth_token: authToken,
        })
        .select()
        .single();

      if (error) throw error;

      // Reassign any orphaned servers (no node or offline node) to this new node
      await supabase
        .from("servers")
        .update({ node_id: data.id, updated_at: new Date().toISOString() })
        .is("node_id", null);

      const { data: offlineNodes } = await supabase
        .from("compute_nodes")
        .select("id")
        .eq("status", "offline")
        .neq("id", data.id);

      const offlineNodeIds = (offlineNodes || []).map((n: any) => n.id);
      if (offlineNodeIds.length > 0) {
        await supabase
          .from("servers")
          .update({ node_id: data.id, updated_at: new Date().toISOString() })
          .in("node_id", offlineNodeIds);
      }

      return new Response(JSON.stringify({ nodeId: data.id, authToken }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Heartbeat — node updates its status and metrics
    if (path === "/heartbeat" && req.method === "POST") {
      const body = await req.json();
      const { nodeId, status: nodeStatus, usedRamMb, usedCpuPercent, usedStorageMb, totalServers } = body;

      // If node is going offline, update status and stop all its servers
      if (nodeStatus === "offline") {
        await supabase
          .from("compute_nodes")
          .update({
            status: "offline",
            used_ram_mb: 0,
            used_cpu_percent: 0,
            used_storage_mb: 0,
            total_servers: 0,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", nodeId);

        await supabase
          .from("servers")
          .update({ status: "offline", players_online: 0, updated_at: new Date().toISOString() })
          .eq("node_id", nodeId)
          .in("status", ["online", "starting", "stopping"]);

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("compute_nodes")
        .update({
          status: "online",
          used_ram_mb: usedRamMb,
          used_cpu_percent: usedCpuPercent,
          used_storage_mb: usedStorageMb,
          total_servers: totalServers,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", nodeId);

      // Stale detection: mark nodes not seen in 60s as offline
      const staleThreshold = new Date(Date.now() - 60000).toISOString();
      const { data: staleNodes } = await supabase
        .from("compute_nodes")
        .select("id")
        .eq("status", "online")
        .lt("last_seen_at", staleThreshold);

      if (staleNodes && staleNodes.length > 0) {
        const staleNodeIds = staleNodes.map((n: any) => n.id);
        await supabase
          .from("compute_nodes")
          .update({ status: "offline" })
          .in("id", staleNodeIds);
        await supabase
          .from("servers")
          .update({ status: "offline", players_online: 0, updated_at: new Date().toISOString() })
          .in("node_id", staleNodeIds)
          .in("status", ["online", "starting"]);
      }

      // Fetch pending server actions
      const { data: servers } = await supabase
        .from("servers")
        .select("*")
        .eq("node_id", nodeId)
        .in("status", ["starting", "stopping", "creating"]);

      // Also detect servers stuck in starting/stopping for more than 2 minutes
      // and reset them so the agent can pick them up again
      const twoMinAgo = new Date(Date.now() - 120000).toISOString();
      const { data: stuckServers } = await supabase
        .from("servers")
        .select("*")
        .eq("node_id", nodeId)
        .in("status", ["starting", "stopping"])
        .lt("updated_at", twoMinAgo);

      if (stuckServers && stuckServers.length > 0) {
        for (const s of stuckServers) {
          await supabase
            .from("servers")
            .update({ status: "offline", updated_at: new Date().toISOString() })
            .eq("id", s.id);
          console.log(`Reset stuck server ${s.id} from ${s.status} to offline`);
        }
      }

      return new Response(JSON.stringify({ pendingActions: servers || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pending commands — node polls for console commands typed in the web UI
    if (path === "/pending-commands" && req.method === "POST") {
      const body = await req.json();
      const { serverId, since } = body;

      let query = supabase
        .from("server_logs")
        .select("id, message, created_at")
        .eq("server_id", serverId)
        .eq("level", "command")
        .order("created_at", { ascending: true })
        .limit(20);

      if (since) {
        query = query.gt("created_at", since);
      }

      const { data: commands } = await query;

      return new Response(JSON.stringify({ commands: commands || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server status update — node reports server status/metrics
    if (path === "/server-status" && req.method === "POST") {
      const body = await req.json();
      const { serverId, status, playersOnline, cpuUsage, ramUsageMb, storageUsageMb, networkInKbps, networkOutKbps, uptimeSeconds, port, address } = body;

      // Check if server still exists (might have been deleted)
      const { data: existing } = await supabase
        .from("servers")
        .select("id")
        .eq("id", serverId)
        .maybeSingle();

      if (!existing) {
        return new Response(JSON.stringify({ ok: false, deleted: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const update: Record<string, unknown> = {
        status,
        players_online: playersOnline ?? 0,
        cpu_usage: cpuUsage ?? 0,
        ram_usage_mb: ramUsageMb ?? 0,
        storage_usage_mb: storageUsageMb ?? 0,
        network_in_kbps: networkInKbps ?? 0,
        network_out_kbps: networkOutKbps ?? 0,
        uptime_seconds: uptimeSeconds ?? 0,
        updated_at: new Date().toISOString(),
      };
      if (port !== undefined) update.port = port;
      if (address !== undefined) update.address = address;
      if (status === "online") update.last_started_at = new Date().toISOString();

      await supabase.from("servers").update(update).eq("id", serverId);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server log — node sends console output
    if (path === "/server-log" && req.method === "POST") {
      const body = await req.json();
      const { serverId, level, message } = body;

      // Check if server still exists before inserting log
      const { data: existing } = await supabase
        .from("servers")
        .select("id")
        .eq("id", serverId)
        .maybeSingle();

      if (!existing) {
        return new Response(JSON.stringify({ ok: false, deleted: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("server_logs").insert({
        server_id: serverId,
        level: level || "info",
        message,
      });

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete server — called by the frontend to delete a server and all related data
    if (path === "/delete-server" && req.method === "POST") {
      const body = await req.json();
      const { serverId } = body;

      // Delete all related data
      await supabase.from("server_logs").delete().eq("server_id", serverId);
      await supabase.from("server_settings").delete().eq("server_id", serverId);
      await supabase.from("players").delete().eq("server_id", serverId);
      await supabase.from("backups").delete().eq("server_id", serverId);
      await supabase.from("schedules").delete().eq("server_id", serverId);
      await supabase.from("activity").delete().eq("server_id", serverId);
      await supabase.from("servers").delete().eq("id", serverId);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Player update — node reports player join/leave
    if (path === "/player-update" && req.method === "POST") {
      const body = await req.json();
      const { serverId, username, uuid, online, isOp, isBanned } = body;

      const { data: existing } = await supabase
        .from("players")
        .select("*")
        .eq("server_id", serverId)
        .eq("uuid", uuid)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("players")
          .update({
            online,
            last_seen: new Date().toISOString(),
            is_op: isOp ?? existing.is_op,
            is_banned: isBanned ?? existing.is_banned,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("players").insert({
          server_id: serverId,
          username,
          uuid,
          online,
          first_joined: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          is_op: isOp || false,
          is_banned: isBanned || false,
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Backup status update
    if (path === "/backup-status" && req.method === "POST") {
      const body = await req.json();
      const { backupId, status, sizeBytes } = body;
      const update: Record<string, unknown> = { status };
      if (sizeBytes !== undefined) update.size_bytes = sizeBytes;
      await supabase.from("backups").update(update).eq("id", backupId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get server details for the node
    if (path === "/server-details" && req.method === "POST") {
      const body = await req.json();
      const { serverId } = body;
      const { data: server } = await supabase
        .from("servers")
        .select("*, server_settings(*)")
        .eq("id", serverId)
        .maybeSingle();

      return new Response(JSON.stringify({ server }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
