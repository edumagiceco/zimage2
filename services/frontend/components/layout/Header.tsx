'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ImageIcon, LayoutGrid, Layers, User, Menu } from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: '이미지 생성', href: '/', icon: ImageIcon },
  { name: '갤러리', href: '/gallery', icon: LayoutGrid },
  { name: '템플릿', href: '/templates', icon: Layers },
];

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="font-bold text-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">MagicEcole</span>
            <span className="text-xs text-muted-foreground -mt-1">Image Maker</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'gap-2',
                    isActive && 'bg-secondary'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* User Menu */}
        <div className="flex items-center space-x-2">
          <Link href="/auth/login">
            <Button variant="outline" size="sm" className="hidden sm:flex gap-2">
              <User className="h-4 w-4" />
              로그인
            </Button>
          </Link>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t">
          <nav className="container py-4 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-2"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              );
            })}
            <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full justify-start gap-2">
                <User className="h-4 w-4" />
                로그인
              </Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
