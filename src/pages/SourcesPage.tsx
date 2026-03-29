import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Search as SearchIcon } from "lucide-react";

const CATEGORIES = ["ufo", "paranormal", "unresolved", "weird_news", "true_crime", "cryptid", "conspiracy"] as const;

export default function SourcesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Discover state
  const [discovering, setDiscovering] = useState(false);

  // Add form state
  const [newUrl, setNewUrl] = useState("");
  const [newGenre, setNewGenre] = useState("");
  const [newCategory, setNewCategory] = useState<string>("");
  const [newSourceType, setNewSourceType] = useState<string>("rss");

  // Fetch sources
  const { data: sources, isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sources")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Toggle active
  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("sources")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sources"] }),
  });

  // Add source
  const addSource = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sources").insert({
        source_url: newUrl,
        genre: newGenre,
        category: newCategory,
        source_type: newSourceType,
        client_id: null,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      setNewUrl("");
      setNewGenre("");
      setNewCategory("");
      setNewSourceType("rss");
      toast({ title: "Source added", description: "New source has been added successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Discover sources
  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const { data, error } = await supabase.functions.invoke("discover-sources", {
        headers: { "x-cron-secret": "trigger" },
      });
      if (error) throw error;
      toast({
        title: "Discovery complete",
        description: `Found ${data?.added ?? 0} new sources (${data?.validated ?? 0} validated, ${data?.skipped_duplicates ?? 0} skipped)`,
      });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
    } catch (err: any) {
      toast({ title: "Discovery failed", description: err.message, variant: "destructive" });
    } finally {
      setDiscovering(false);
    }
  };

  const truncateUrl = (url: string, max = 50) => (url.length > max ? url.slice(0, max) + "…" : url);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-display font-bold">Sources</h1>
        </div>

        {/* Section 1 — Discover */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Discover New Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Automatically discover RSS feeds from domains that appear in your story cards.
            </p>
            <Button onClick={handleDiscover} disabled={discovering}>
              {discovering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Discovering…
                </>
              ) : (
                <>
                  <SearchIcon className="mr-2 h-4 w-4" />
                  Discover New Sources
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Section 3 — Add manual source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add Source Manually</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-1 block">Source URL</label>
                <Input
                  placeholder="https://example.com/feed"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Genre</label>
                <Input
                  placeholder="e.g. paranormal"
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Category</label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Type</label>
                <Select value={newSourceType} onValueChange={setNewSourceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rss">RSS</SelectItem>
                    <SelectItem value="reddit">Reddit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="mt-4"
              onClick={() => addSource.mutate()}
              disabled={!newUrl || !newGenre || !newCategory || addSource.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Source
            </Button>
          </CardContent>
        </Card>

        {/* Section 2 — Sources table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              All Sources {sources ? `(${sources.length})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Genre</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Last Fetched</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources?.map((source) => (
                      <TableRow key={source.id}>
                        <TableCell
                          className="max-w-[300px] truncate"
                          title={source.source_url}
                        >
                          {truncateUrl(source.source_url)}
                        </TableCell>
                        <TableCell>{source.genre}</TableCell>
                        <TableCell>
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">
                            {source.category}
                          </span>
                        </TableCell>
                        <TableCell>{source.source_type}</TableCell>
                        <TableCell>
                          <Switch
                            checked={source.active}
                            onCheckedChange={(checked) =>
                              toggleActive.mutate({ id: source.id, active: checked })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {source.last_fetched_at
                            ? new Date(source.last_fetched_at).toLocaleDateString()
                            : "Never"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
