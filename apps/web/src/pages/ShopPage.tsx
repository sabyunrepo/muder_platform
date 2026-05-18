import { CoinBalance } from '@/features/payment/components/CoinBalance';
import { CoinPackageList } from '@/features/payment/components/CoinPackageList';
import { PageShell, SectionHeader } from '@/shared/components/ui';

export default function ShopPage() {
  return (
    <PageShell header={<SectionHeader title="상점" />}>
      <section>
        <CoinBalance />
      </section>
      <section>
        <CoinPackageList />
      </section>
    </PageShell>
  );
}
