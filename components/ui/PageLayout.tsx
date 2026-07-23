import { type HTMLAttributes, type ReactNode } from "react";

type ContainerWidth = "narrow" | "default" | "wide" | "full";

type GridCols = 1 | 2 | 3 | 4;

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  width?: ContainerWidth;
}

interface SectionProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  action?: ReactNode;
}

interface ContentGridProps extends HTMLAttributes<HTMLDivElement> {
  cols?: GridCols;
}

interface TwoColumnLayoutProps extends HTMLAttributes<HTMLDivElement> {
  sidebar: ReactNode;
  sidebarPosition?: "left" | "right";
}

const widthClasses: Record<ContainerWidth, string> = {
  narrow: "max-w-3xl",
  default: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

const gridClasses: Record<GridCols, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
};

export function PageContainer({
  width = "default",
  className = "",
  children,
  ...props
}: PageContainerProps) {
  return (
    <div className={`mx-auto w-full ${widthClasses[width]} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Section({
  title,
  description,
  action,
  className = "",
  children,
  ...props
}: SectionProps) {
  return (
    <section className={`app-section ${className}`} {...props}>
      {(title || description || action) && (
        <SectionHeader title={title} description={description} action={action} />
      )}
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  if (!title && !description && !action) return null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {title && <h2 className="type-section-title text-xl text-foreground">{title}</h2>}
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function ContentGrid({
  cols = 2,
  className = "",
  children,
  ...props
}: ContentGridProps) {
  return (
    <div className={`grid gap-4 ${gridClasses[cols]} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function TwoColumnLayout({
  sidebar,
  sidebarPosition = "right",
  className = "",
  children,
  ...props
}: TwoColumnLayoutProps) {
  const sidebarNode = <aside className="xl:w-80 xl:shrink-0">{sidebar}</aside>;
  const contentNode = <div className="min-w-0 flex-1">{children}</div>;

  return (
    <div className={`flex flex-col gap-6 xl:flex-row ${className}`} {...props}>
      {sidebarPosition === "left" ? sidebarNode : contentNode}
      {sidebarPosition === "left" ? contentNode : sidebarNode}
    </div>
  );
}

export function NarrowFormLayout({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mx-auto w-full max-w-md ${className}`} {...props}>
      {children}
    </div>
  );
}
