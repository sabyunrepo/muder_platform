import { Search } from "lucide-react";
import { useNavigate } from "react-router";
import { Layout } from "@/shared/components/Layout";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6">
        <div className="flex items-center gap-3">
          <Search className="h-10 w-10 text-amber-500" />
          <h1 className="text-4xl font-bold tracking-tight text-slate-100">
            Murder Mystery Platform
          </h1>
        </div>
        <p className="max-w-md text-center text-lg text-slate-400">
          실시간 멀티플레이어 머더미스터리 게임 플랫폼
        </p>
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="mt-4 rounded-lg bg-amber-500 px-6 py-3 font-semibold text-slate-950 transition-colors hover:bg-amber-400"
        >
          시작하기
        </button>
      </div>
    </Layout>
  );
}
