'use client';

/* ── Empty State ─────────────────────────────────── */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-5xl mb-4 opacity-40">🏥</div>
      <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-sm">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ── Error Banner ────────────────────────────────── */
export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
      <span className="text-sm text-red-700">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-red-600 font-medium hover:text-red-800 underline ml-4 shrink-0"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

/* ── Skeleton Card ───────────────────────────────── */
export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 animate-pulse">
      <div className="flex justify-between items-start mb-2">
        <div className="h-4 w-28 bg-gray-200 rounded" />
        <div className="h-7 w-7 bg-gray-200 rounded-full" />
      </div>
      <div className="h-3 w-40 bg-gray-100 rounded mt-2" />
      <div className="h-3 w-24 bg-gray-100 rounded mt-2" />
      <div className="h-3 w-20 bg-gray-100 rounded mt-2" />
    </div>
  );
}

/* ── Skeleton Column ─────────────────────────────── */
export function SkeletonColumn() {
  return (
    <div className="w-72 shrink-0 bg-gray-50 rounded-xl p-3">
      <div className="h-5 w-24 bg-gray-200 rounded mb-3 animate-pulse" />
      <div className="space-y-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

/* ── Toast ────────────────────────────────────────── */
export function Toast({
  message,
  type = 'success',
  onClose,
}: {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
}) {
  const bg = type === 'success' ? 'bg-green-600' : 'bg-red-600';

  return (
    <div className={`fixed bottom-6 right-6 z-[100] ${bg} text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-up`}>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="text-white/70 hover:text-white text-lg leading-none">&times;</button>
    </div>
  );
}
