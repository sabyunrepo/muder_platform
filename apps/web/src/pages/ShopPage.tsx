import { CoinBalance } from "@/features/payment/components/CoinBalance";
import { CoinPackageList } from "@/features/payment/components/CoinPackageList";

export default function ShopPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-slate-100">상점</h1>
      <section className="mt-6">
        <CoinBalance />
      </section>
      <section className="mt-6">
        <CoinPackageList />
      </section>
    </div>
  );
}
