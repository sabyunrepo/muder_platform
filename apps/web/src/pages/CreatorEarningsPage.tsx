import { EarningsList } from "@/features/creator/components/EarningsList";

export default function CreatorEarningsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-slate-100">수익 내역</h1>
      <section className="mt-6">
        <EarningsList />
      </section>
    </div>
  );
}
