"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createApi } from "@/lib/api";
import type { AssetRecord } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatBytes, formatDate } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "@/lib/hooks";

const PAGE_SIZE = 20;
const MIME_OPTIONS = [
  { label: "All types", value: "" },
  { label: "Images", value: "image/" },
  { label: "Videos", value: "video/" },
];

export default function AssetsPage() {
  const { token } = useAuth();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const debouncedUserId = useDebounce(userId, 300);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const api = createApi(token);
      const res = await api.assets.list({
        page,
        limit: PAGE_SIZE,
        userId: debouncedUserId || undefined,
        mimeType: mimeType || undefined,
      });
      setAssets(res.assets);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, [token, page, debouncedUserId, mimeType]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedUserId, mimeType]);

  async function handleDelete() {
    if (!token || !deleteId) return;
    setDeleting(true);
    try {
      await createApi(token).assets.delete(deleteId);
      toast.success("Asset deleted");
      setDeleteId(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Assets</h1>
        <p className="text-sm text-muted-foreground">{total} total assets</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by user ID..."
                value={userId}
                onChange={e => setUserId(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={mimeType} onValueChange={setMimeType}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="MIME type" />
              </SelectTrigger>
              <SelectContent>
                {MIME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : assets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">No assets found</TableCell>
                </TableRow>
              ) : (
                assets.map(asset => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{asset.fileName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{asset.mimeType}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatBytes(asset.fileSize)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-[100px] truncate">{asset.userId}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(asset.createdAt)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(asset.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
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

      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete asset?</DialogTitle>
            <DialogDescription>This will permanently delete the asset and remove it from storage. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
