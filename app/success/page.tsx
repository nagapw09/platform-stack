'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [session, setSession] = useState<{
    status: string;
    paymentStatus: string;
    customerEmail: string;
    amountTotal: number;
    currency: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      fetch(`/api/checkout?session_id=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setSession(data.data);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [sessionId]);

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
      <div className="glass-card p-12 max-w-lg w-full text-center animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">
          Payment Successful!
        </h1>

        <p className="text-gray-400 mb-8">
          Thank you for your subscription. Your account has been activated.
        </p>

        {loading ? (
          <div className="skeleton h-24 rounded-lg mb-8" />
        ) : session ? (
          <div className="bg-black/20 rounded-lg p-6 mb-8 text-left">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Status</div>
                <div className="text-white font-medium capitalize">{session.status}</div>
              </div>
              <div>
                <div className="text-gray-500">Payment</div>
                <div className="text-emerald-400 font-medium capitalize">{session.paymentStatus}</div>
              </div>
              <div>
                <div className="text-gray-500">Email</div>
                <div className="text-white font-medium">{session.customerEmail || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-500">Amount</div>
                <div className="text-white font-medium">
                  {session.amountTotal 
                    ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: session.currency?.toUpperCase() || 'USD',
                      }).format(session.amountTotal / 100)
                    : 'N/A'
                  }
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <Link 
          href="/"
          className="btn-primary inline-block"
        >
          Back to Home
        </Link>

        {sessionId && (
          <div className="mt-6 text-gray-500 text-xs font-mono break-all">
            Session: {sessionId}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="skeleton w-96 h-64 rounded-2xl" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}

