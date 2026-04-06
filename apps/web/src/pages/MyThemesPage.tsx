import { PurchasedThemes } from "@/features/coin/components/PurchasedThemes";

export default function MyThemesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-slate-100">내 테마</h1>
      <section className="mt-6">
        <PurchasedThemes />
      </section>
    </div>
  );
}
