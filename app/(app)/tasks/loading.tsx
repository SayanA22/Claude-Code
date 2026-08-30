import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-2 h-4 w-28" />
      <Skeleton className="mt-5 h-11 w-full rounded-xl" />
      <div className="mt-4">
        <ListSkeleton rows={5} />
      </div>
    </div>
  );
}
