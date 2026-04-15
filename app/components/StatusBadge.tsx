'use client';

interface StatusBadgeProps {
  status: 'healthy' | 'degraded' | 'unhealthy';
  label?: string;
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const statusColors = {
    healthy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    degraded: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    unhealthy: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${statusColors[status]}`}>
      <span className={`status-dot ${status}`} />
      <span className="text-sm font-medium capitalize">{label || status}</span>
    </div>
  );
}

