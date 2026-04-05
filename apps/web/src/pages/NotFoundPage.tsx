import { Link } from "react-router";
import { Layout } from "@/shared/components/Layout";

export default function NotFoundPage() {
  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
        <h1 className="text-6xl font-bold text-amber-500">404</h1>
        <p className="text-lg text-slate-400">페이지를 찾을 수 없습니다.</p>
        <Link
          to="/"
          className="mt-4 rounded-lg bg-slate-800 px-6 py-3 text-slate-200 transition-colors hover:bg-slate-700"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </Layout>
  );
}
