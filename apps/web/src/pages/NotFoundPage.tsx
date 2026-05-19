import { Link } from "react-router";
import { Layout } from "@/shared/components/Layout";

export default function NotFoundPage() {
  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
        <h1 className="text-6xl font-bold text-[var(--mmp-color-primary)]">404</h1>
        <p className="text-lg text-[var(--mmp-color-steel)]">페이지를 찾을 수 없습니다.</p>
        <Link
          to="/"
          className="mt-4 rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] px-6 py-3 text-[var(--mmp-color-ink)] transition-colors hover:bg-[var(--mmp-color-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mmp-color-primary)]"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </Layout>
  );
}
