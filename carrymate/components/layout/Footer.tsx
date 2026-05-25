import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <p className="text-lg font-bold text-brand-primary">CarryMate</p>
            <p className="text-sm text-gray-500">Carry more. Share the journey.</p>
          </div>
          <div className="flex gap-6 text-sm text-gray-600">
            <Link href="/terms" className="hover:text-brand-primary">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-brand-primary">
              Privacy Policy
            </Link>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} CarryMate. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
