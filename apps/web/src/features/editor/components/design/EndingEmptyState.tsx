export function EndingEmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
      <div className="max-w-md space-y-3">
        <h3 className="text-lg font-semibold text-slate-100">아직 결말이 없습니다</h3>
        <p className="text-sm leading-6 text-slate-400">
          Flow에서 결말 노드를 추가하면 이곳에서 결말 내용을 작성할 수 있어요. 바로 시작하려면 위의 “결말 추가”
          버튼을 눌러도 됩니다.
        </p>
      </div>
    </div>
  );
}
