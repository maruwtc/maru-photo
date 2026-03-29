"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createApi } from "@/lib/api";
import type { SystemSetting } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type EditState = { key: string; value: string; description: string };

export default function SettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditState>({ key: "", value: "", description: "" });
  const [isNew, setIsNew] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setSettings(await createApi(token).settings.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm({ key: "", value: "", description: "" });
    setIsNew(true);
    setEditOpen(true);
  }

  function openEdit(s: SystemSetting) {
    setForm({
      key: s.key,
      value: typeof s.value === "string" ? s.value : JSON.stringify(s.value),
      description: s.description ?? "",
    });
    setIsNew(false);
    setEditOpen(true);
  }

  async function handleSave() {
    if (!token || !form.key) return;
    setSaving(true);
    try {
      let parsedValue: unknown;
      try { parsedValue = JSON.parse(form.value); } catch { parsedValue = form.value; }
      await createApi(token).settings.upsert(form.key, parsedValue, form.description || undefined);
      toast.success(`Setting "${form.key}" saved`);
      setEditOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !deleteKey) return;
    try {
      await createApi(token).settings.delete(deleteKey);
      toast.success(`Setting "${deleteKey}" deleted`);
      setDeleteKey(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">System configuration key-value store</p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Setting
        </Button>
      </div>

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
        ) : settings.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">No settings configured</CardContent>
          </Card>
        ) : (
          settings.map(s => (
            <Card key={s.key}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-mono">{s.key}</CardTitle>
                    {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteKey(s.key)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="flex items-center gap-3">
                  <code className="flex-1 text-xs bg-muted rounded px-2 py-1 truncate">
                    {typeof s.value === "string" ? s.value : JSON.stringify(s.value)}
                  </code>
                  <Badge variant="outline" className="text-xs shrink-0">{typeof s.value}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Updated {formatDate(s.updatedAt)}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? "New Setting" : `Edit "${form.key}"`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isNew && (
              <div className="space-y-1.5">
                <Label htmlFor="key">Key</Label>
                <Input
                  id="key"
                  placeholder="e.g. max_upload_size_mb"
                  value={form.key}
                  onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                placeholder='e.g. 100 or "text" or {"key": "val"}'
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">JSON values are parsed automatically</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="What does this setting control?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.key}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteKey} onOpenChange={open => !open && setDeleteKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete setting?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <code className="font-mono">{deleteKey}</code>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteKey(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
