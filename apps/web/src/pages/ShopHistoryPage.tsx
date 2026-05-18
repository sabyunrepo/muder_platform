import { PaymentHistory } from '@/features/payment/components/PaymentHistory';
import { CoinTransactions } from '@/features/payment/components/CoinTransactions';
import { PageShell, SectionHeader } from '@/shared/components/ui';

export default function ShopHistoryPage() {
  return (
    <PageShell header={<SectionHeader title="구매 내역" />}>
      <section>
        <PaymentHistory />
      </section>
      <section>
        <SectionHeader title="코인 거래 내역" className="mb-4" />
        <CoinTransactions />
      </section>
    </PageShell>
  );
}
