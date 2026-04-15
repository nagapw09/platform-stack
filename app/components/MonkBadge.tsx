'use client';

export default function MonkBadge() {
  return (
    <a 
      href="https://monk.io" 
      target="_blank" 
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all hover:scale-105"
    >
      <svg 
        width="20" 
        height="20" 
        viewBox="0 0 32 32" 
        fill="none" 
        className="text-indigo-400"
      >
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
        <circle cx="16" cy="16" r="6" fill="currentColor" />
      </svg>
      <span className="text-sm font-medium text-gray-300">
        Deployed with <span className="text-white font-semibold">Monk</span>
      </span>
    </a>
  );
}

