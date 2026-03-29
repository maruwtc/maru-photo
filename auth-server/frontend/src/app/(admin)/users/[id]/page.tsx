"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createApi } from "@/lib/api";
import type { UserRecord } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, email: selfEmail } = useAuth();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const api = createApi(token);
      setUser(await api.users.getById(id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load user");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);

  async function patch(patch: { isAdmin?: boolean; isDisabled?: boolean }) {
    if (!token || !user) return;
    setSaving(true);
    try {
      const updated = await createApi(token).users.update(id, patch);
      setUser(updated);
      toast.success("User updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token) return;
    setDeleting(true);
    try {
      await createApi(token).users.delete(id);
      toast.success("User deleted");
      router.replace("/users");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  }

  const isSelf = user?.email === selfEmail;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">User Detail</h1>
          {user && <p className="text-sm text-muted-foreground">{user.email}</p>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
            </div>
          ) : user ? (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">ID</p>
                  <p className="font-mono text-xs break-all">{user.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Firebase UID</p>
                  <p className="font-mono text-xs break-all">{user.firebaseUid}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p>{user.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Joined</p>
                  <p>{formatDate(user.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Assets</p>
                  <p>{user.assetCount ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Devices</p>
                  <p>{user.deviceCount ?? 0}</p>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap pt-2">
                {user.isAdmin && <Badge>Admin</Badge>}
                {user.isDisabled ? <Badge variant="destructive">Disabled</Badge> : <Badge variant="success">Active</Badge>}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {user && (
        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Admin access</Label>
                <p className="text-xs text-muted-foreground">Can access this CMS panel</p>
              </div>
              <Switch
                checked={user.isAdmin}
                disabled={saving || isSelf}
                onCheckedChange={v => patch({ isAdmin: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Account disabled</Label>
                <p className="text-xs text-muted-foreground">Prevents sign-in</p>
              </div>
              <Switch
                checked={user.isDisabled}
                disabled={saving || isSelf}
                onCheckedChange={v => patch({ isDisabled: v })}
              />
            </div>
            {isSelf && (
              <p className="text-xs text-muted-foreground">You cannot modify your own account.</p>
            )}
          </CardContent>
        </Card>
      )}

      {user && !isSelf && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete user?</DialogTitle>
                  <DialogDescription>
                    This will permanently delete <strong>{user.email}</strong> and all their data. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                    {deleting ? "Deleting…" : "Delete"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
