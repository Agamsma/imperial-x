import Link from "next/link";
import { GITHUB_URL } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.07] bg-night text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-medium text-white/85">Decision-support prototype. Not an official IMD warning.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/demo" className="transition-colors hover:text-white">
            Demo
          </Link>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">
            GitHub
          </a>
          <span>Team OmniSense · SIH 2026</span>
        </div>
      </div>
    </footer>
  );
}
