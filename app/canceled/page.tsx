import Link from 'next/link';

export default function CanceledPage() {
  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
      <div className="glass-card p-12 max-w-lg w-full text-center animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-amber-500/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">
          Checkout Canceled
        </h1>

        <p className="text-gray-400 mb-8">
          Your checkout was canceled. No charges were made.
          Feel free to try again when you&apos;re ready.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link 
            href="/"
            className="btn-primary"
          >
            Try Again
          </Link>
          <Link 
            href="/"
            className="px-6 py-3 border border-white/20 rounded-xl text-white font-medium hover:bg-white/5 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

