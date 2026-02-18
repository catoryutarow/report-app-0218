"use client";

import { MobileSidebar } from "./Sidebar";

type Props = {
  children?: React.ReactNode;
};

export function Header({ children }: Props) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b bg-background px-4 py-3 md:px-6">
      <MobileSidebar />
      <div className="flex-1 flex items-center gap-4">
        {children}
      </div>
    </header>
  );
}
