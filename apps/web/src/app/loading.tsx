import { RouteListSkeleton } from "@/components/feedback/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl py-4">
      <RouteListSkeleton />
    </div>
  );
}
