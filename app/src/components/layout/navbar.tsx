'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { UserNav } from './user-nav';
import { ThemeToggle } from './theme-toggle';
import { GraduationCap } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
}

interface NavbarProps {
  items: NavItem[];
}

export function Navbar({ items }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 text-foreground backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex h-14 w-full items-center px-4 md:px-6">
        <div className="mr-8 flex items-center space-x-2">
          <GraduationCap className="h-6 w-6" />
          <span className="text-xl font-bold">ThinkMate</span>
        </div>
        <nav className="flex flex-1 items-center space-x-6 text-sm font-medium">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'transition-colors hover:text-foreground/80',
                pathname === item.href
                  ? 'text-foreground'
                  : 'text-foreground/60'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <UserNav />
        </div>
      </div>
    </header>
  );
}
