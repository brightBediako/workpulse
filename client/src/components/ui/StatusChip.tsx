const toneMap: Record<string, string> = {
  pending: "bg-secondary-fixed/40 text-on-secondary-fixed-variant",
  approved: "bg-primary-fixed/50 text-on-primary-fixed-variant",
  verified: "bg-primary-fixed/50 text-on-primary-fixed-variant",
  rejected: "bg-error-container text-on-error-container",
  suspended: "bg-surface-container-highest text-on-surface-variant",
  closed: "bg-surface-container-highest text-on-surface-variant",
  in_progress: "bg-tertiary-fixed/60 text-on-tertiary-fixed-variant",
  completed: "bg-primary-fixed/50 text-on-primary-fixed-variant",
  paid: "bg-primary-fixed/50 text-on-primary-fixed-variant",
  cancelled: "bg-surface-container-highest text-on-surface-variant",
  disputed: "bg-error-container text-on-error-container",
  open: "bg-primary-fixed/40 text-on-primary-fixed-variant",
  filled: "bg-secondary-fixed/50 text-on-secondary-fixed-variant",
  accepted: "bg-primary-fixed/50 text-on-primary-fixed-variant",
  default: "bg-surface-container-high text-on-surface-variant",
};

export function StatusChip({
  status,
  label,
}: {
  status?: string | null;
  label?: string;
}) {
  const key = (status || "").toLowerCase();
  const tone = toneMap[key] || toneMap.default;
  const text = label || (status || "unknown").replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm font-label-caps ${tone}`}
    >
      {text}
    </span>
  );
}
