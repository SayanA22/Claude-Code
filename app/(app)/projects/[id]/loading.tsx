import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="mt-4 h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-48" />
      <Skeleton className="mt-6 h-1.5 w-full rounded-full" />
      <div className="mt-6">
        <ListSkeleton rows={4} />
      </div>
    </div>
  );
}
