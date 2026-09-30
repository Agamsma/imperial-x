import Link from "next/link";
import { GITHUB_URL } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-medium text-ink">Decision-support prototype. Not an official IMD warning.</p>
        <div className="flex gap-5">
          <Link href="/demo" className="hover:text-accent">
            Demo
          </Link>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
            GitHub
          </a>
          <span>Team OmniSense · SIH 2026</span>
        </div>
      </div>
    </footer>
  );
}
