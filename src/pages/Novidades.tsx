import { useEffect } from 'react';
import { ChangelogList } from '@/components/changelog/ChangelogList';
import { useChangelogs } from '@/hooks/useChangelogs';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Skeleton } from '@/components/ui/skeleton';

export default function Novidades() {
  const { changelogs, loading } = useChangelogs();
  usePageTitle('Novidades');

  useEffect(() => {
    // Auto-mark as viewed when page loads
    const timer = setTimeout(() => {
      // This will be handled by individual changelog cards
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-6 rounded-lg border bg-card space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <ChangelogList />
    </div>
  );
}