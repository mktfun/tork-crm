import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Changelog {
  id: string;
  version: string;
  title: string;
  description: string;
  category: 'feature' | 'bugfix' | 'improvement' | 'breaking';
  priority: 'low' | 'medium' | 'high' | 'critical';
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChangelogView {
  id: string;
  user_id: string;
  changelog_id: string;
  viewed_at: string;
}

export function useChangelogs() {
  const [changelogs, setChangelogs] = useState<Changelog[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [viewedChangelogIds, setViewedChangelogIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      fetchChangelogs();
    }
  }, [user?.id]);

  const fetchChangelogs = async () => {
    try {
      setLoading(true);

      // Fetch published changelogs
      const { data: changelogsData, error: changelogsError } = await supabase
        .from('changelogs')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (changelogsError) throw changelogsError;

      // Fetch user's viewed changelogs
      const { data: viewsData, error: viewsError } = await supabase
        .from('user_changelog_views')
        .select('changelog_id')
        .eq('user_id', user!.id);

      if (viewsError) throw viewsError;

      const viewedIds = new Set(viewsData?.map(v => v.changelog_id) || []);
      const unreadChangelogs = changelogsData?.filter(c => !viewedIds.has(c.id)) || [];

      setChangelogs((changelogsData as Changelog[]) || []);
      setViewedChangelogIds(viewedIds);
      setUnreadCount(unreadChangelogs.length);
    } catch (error) {
      console.error('Error fetching changelogs:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsViewed = async (changelogId: string) => {
    if (!user?.id) return;

    // Check if already viewed to avoid duplicate calls
    if (viewedChangelogIds.has(changelogId)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('user_changelog_views')
        .upsert(
          {
            user_id: user.id,
            changelog_id: changelogId
          },
          {
            onConflict: 'user_id,changelog_id',
            ignoreDuplicates: true
          }
        );

      if (error) throw error;

      // Update local state immediately
      setViewedChangelogIds(prev => new Set([...prev, changelogId]));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking changelog as viewed:', error);
    }
  };

  const markAllAsViewed = async () => {
    if (!user?.id || changelogs.length === 0) return;

    try {
      // Only process unread changelogs to avoid duplicate key errors
      const unreadChangelogs = changelogs.filter(changelog => !viewedChangelogIds.has(changelog.id));
      
      if (unreadChangelogs.length === 0) {
        return; // All already viewed
      }

      const viewsToInsert = unreadChangelogs.map(changelog => ({
        user_id: user.id,
        changelog_id: changelog.id
      }));

      const { error } = await supabase
        .from('user_changelog_views')
        .upsert(viewsToInsert, {
          onConflict: 'user_id,changelog_id',
          ignoreDuplicates: true
        });

      if (error) throw error;

      // Update local state
      const newViewedIds = new Set([...viewedChangelogIds, ...unreadChangelogs.map(c => c.id)]);
      setViewedChangelogIds(newViewedIds);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as viewed:', error);
    }
  };

  return {
    changelogs,
    unreadCount,
    viewedChangelogIds,
    loading,
    markAsViewed,
    markAllAsViewed,
    refetch: fetchChangelogs
  };
}