import { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-xl px-md border border-dashed border-outline-variant rounded-card bg-surface-container-low">
      <h3 className="font-section-title text-primary mb-sm">{title}</h3>
      {description ? (
        <p className="font-body-dense text-on-surface-variant mb-md max-w-md mx-auto">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}
