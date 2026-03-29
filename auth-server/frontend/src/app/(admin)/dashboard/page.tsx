"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createApi } from "@/lib/api";
import type { MetricsSnapshot } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";
import { Users, Images, Activity, Clock, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function StatCard({ title, value, sub, icon: Icon, loading }: {
  title: string; value: string | number; sub?: string; icon: React.ElementType; loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<"ok" | "degraded" | "unknown">("unknown");

  const load = useCallback(async () => {
    if (!token) return;
    const api = createApi(token);
    try {
      const [m, h] = await Promise.all([
        api.metrics.get(),
        api.health.ready().catch(() => null),
      ]);
      setMetrics(m);
      setHealthStatus(h?.ok && h?.db?.ok ? "ok" : "degraded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const latencyData = metrics ? [
    { name: "p50", ms: metrics.responseTime.p50 },
    { name: "p90", ms: metrics.responseTime.p90 },
    { name: "p95", ms: metrics.responseTime.p95 },
    { name: "p99", ms: metrics.responseTime.p99 },
  ] : [];

  const uptime = metrics
    ? `${Math.floor(metrics.uptime / 3600)}h ${Math.floor((metrics.uptime % 3600) / 60)}m`
    : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">System overview and health</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={healthStatus === "ok" ? "success" : healthStatus === "degraded" ? "destructive" : "secondary"}>
            {healthStatus === "ok" ? "Healthy" : healthStatus === "degraded" ? "Degraded" : "Unknown"}
          </Badge>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Requests" value={metrics?.requests.total ?? "—"} sub={`${metrics?.requests.errors ?? 0} errors`} icon={Activity} loading={loading} />
        <StatCard title="Uptime" value={uptime} icon={Clock} loading={loading} />
        <StatCard title="Heap Used" value={metrics ? formatBytes(metrics.memory.heapUsed) : "—"} icon={Database} loading={loading} />
        <StatCard title="p99 Latency" value={metrics ? `${metrics.responseTime.p99} ms` : "—"} icon={Users} loading={loading} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Response Time (ms)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Line type="monotone" dataKey="ms" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
            {metrics && (
              <p className="text-xs text-muted-foreground mt-2">
                avg {metrics.responseTime.avg.toFixed(1)} ms
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" /> Memory & Database
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : metrics ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Heap used</span>
                  <span className="font-medium">{formatBytes(metrics.memory.heapUsed)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Heap total</span>
                  <span className="font-medium">{formatBytes(metrics.memory.heapTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">RSS</span>
                  <span className="font-medium">{formatBytes(metrics.memory.rss)}</span>
                </div>
                {metrics.db && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">DB pool total</span>
                      <span className="font-medium">{metrics.db.totalConnections}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">DB pool idle</span>
                      <span className="font-medium">{metrics.db.idleConnections}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">DB pool waiting</span>
                      <span className="font-medium">{metrics.db.waitingClients}</span>
                    </div>
                  </>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {metrics && metrics.requests.byRoute && Object.keys(metrics.requests.byRoute).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Requests by Route</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(metrics.requests.byRoute)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([route, count]) => (
                  <div key={route} className="flex items-center gap-3">
                    <code className="flex-1 text-xs truncate text-muted-foreground">{route}</code>
                    <span className="text-sm font-medium tabular-nums">{count}</span>
                    <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, (count / metrics.requests.total) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
