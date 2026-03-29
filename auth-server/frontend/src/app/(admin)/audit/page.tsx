"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createApi } from "@/lib/api";
import type { AuditLog } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "@/lib/hooks";

const PAGE_SIZE = 30;

const ACTION_OPTIONS = [
  { label: "All actions", value: "all" },
  { label: "user.signin", value: "user.signin" },
  { label: "user.microsoft_connect", value: "user.microsoft_connect" },
  { label: "asset.upload", value: "asset.upload" },
];

const RESOURCE_OPTIONS = [
  { label: "All resources", value: "all" },
  { label: "user", value: "user" },
  { label: "asset", value: "asset" },
];

const ACTION_COLORS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  "user.signin": "success",
  "user.microsoft_connect": "default",
  "asset.upload": "secondary",
};

export default function AuditPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("all");
  const [resourceType, setResourceType] = useState("all");
  const [loading, setLoading] = useState(true);
  const debouncedUserId = useDebounce(userId, 300);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const api = createApi(token);
      const res = await api.audit.list({
        page, limit: PAGE_SIZE,
        userId: debouncedUserId || undefined,
        action: action !== "all" ? action : undefined,
        resourceType: resourceType !== "all" ? resourceType : undefined,
      });
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [token, page, debouncedUserId, action, resourceType]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedUserId, action, resourceType]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">{total} total events</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Filter by user ID..."
              value={userId}
              onChange={e => setUserId(e.target.value)}
              className="w-48"
            />
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={resourceType} onValueChange={setResourceType}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Resource" />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">No logs found</TableCell>
                </TableRow>
              ) : (
                logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={ACTION_COLORS[log.action] ?? "outline"} className="text-xs">{log.action}</Badge>
                    </TableCell>
                    <TableCell>
                      {log.resourceType && (
                        <span className="text-xs text-muted-foreground">
                          {log.resourceType}{log.resourceId ? `:${log.resourceId.slice(0, 8)}…` : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-[120px] truncate">{log.userId ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.ipAddress ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
