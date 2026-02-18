"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Settings, Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { signOut } from "@/lib/firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "ダッシュボード", icon: Home },
  { href: "/settings", label: "設定", icon: Settings },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b">
        <Link href="/" onClick={onNavigate}>
          <h2 className="text-lg font-bold">SNSレポート</h2>
          <p className="text-xs text-muted-foreground">支援ツール</p>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="p-3 border-t">
        {user && (
          <div className="flex items-center gap-2 px-3 py-2">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="h-6 w-6 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs">
                {user.displayName?.[0] ?? "?"}
              </div>
            )}
            <span className="text-sm truncate flex-1">
              {user.displayName ?? user.email}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={async () => {
            await signOut();
          }}
        >
          <LogOut className="h-4 w-4" />
          ログアウト
        </Button>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-background h-screen sticky top-0">
      <NavContent />
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-56 p-0">
        <SheetTitle className="sr-only">ナビゲーション</SheetTitle>
        <NavContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
