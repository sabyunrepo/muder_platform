import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { DeleteAccountModal } from "./DeleteAccountModal";

// ---------------------------------------------------------------------------
// DangerZone
// ---------------------------------------------------------------------------

export function DangerZone() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-red-900/60 bg-red-950/10 p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <h2 className="text-base font-semibold text-red-400">계정 삭제</h2>
        </div>
        <p className="mb-4 text-sm text-slate-400">
          계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다.
        </p>
        <div className="flex justify-end">
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            계정 삭제
          </button>
        </div>
      </div>

      {modalOpen && (
        <DeleteAccountModal onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
