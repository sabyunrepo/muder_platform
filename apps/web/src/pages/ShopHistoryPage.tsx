import { PaymentHistory } from "@/features/payment/components/PaymentHistory";
import { CoinTransactions } from "@/features/payment/components/CoinTransactions";

export default function ShopHistoryPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-slate-100">구매 내역</h1>
      <section className="mt-6">
        <PaymentHistory />
      </section>
      <section className="mt-8">
        <h2 className="mb-4 text-xl font-semibold text-slate-100">
          코인 거래 내역
        </h2>
        <CoinTransactions />
      </section>
    </div>
  );
}
