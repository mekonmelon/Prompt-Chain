'use client'

import { useEffect, useState } from 'react'
import { LoginButton } from '@/components/login-button'

const JUDGING_LINES = [
  "you don't LOOK like a super admin...",
  'nice try.',
  'denied. probably.',
  'hmm. suspicious.',
  'prove it.'
]

export default function LoginPage() {
  const [lineIndex, setLineIndex] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLineIndex((current) => (current + 1) % JUDGING_LINES.length)
    }, 3200)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <main className="login-page min-h-screen overflow-hidden bg-slate-100 px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col items-center justify-center">
        <p className="mb-8 text-center text-4xl font-black tracking-tight text-slate-900 sm:text-6xl">
          Humor Project Admin Panel
        </p>

        <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="flex justify-center">
            <div className="face-wrapper relative">
              <div className="speech-bubble absolute -right-6 top-0 z-10 max-w-xs rounded-3xl border-4 border-slate-900 bg-white px-6 py-4 text-lg font-bold leading-8 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.15)] sm:text-2xl">
                {JUDGING_LINES[lineIndex]}
                <div className="speech-tail absolute -bottom-5 left-10 h-8 w-8 rotate-45 border-b-4 border-r-4 border-slate-900 bg-white" />
              </div>

              <div className="face relative mt-24 flex h-[420px] w-[320px] items-center justify-center rounded-[45%] border-4 border-slate-900 bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
                <div className="eyebrow-left absolute left-12 top-24 h-3 w-20 rotate-[25deg] rounded-full bg-slate-900" />
                <div className="eyebrow-right absolute right-12 top-24 h-3 w-20 rotate-[-25deg] rounded-full bg-slate-900" />

                <div className="eye absolute left-10 top-32 h-20 w-20 rounded-full border-4 border-slate-900 bg-white">
                  <div className="eyelid absolute inset-x-0 top-0 h-0 rounded-t-full bg-slate-200" />
                  <div className="eye-pupil absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900" />
                  <div className="absolute left-[50%] top-[50%] h-2.5 w-2.5 -translate-x-[20%] -translate-y-[20%] rounded-full bg-white" />
                </div>

                <div className="eye absolute right-10 top-32 h-20 w-20 rounded-full border-4 border-slate-900 bg-white">
                  <div className="eyelid absolute inset-x-0 top-0 h-0 rounded-t-full bg-slate-200" />
                  <div className="eye-pupil absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900" />
                  <div className="absolute left-[50%] top-[50%] h-2.5 w-2.5 -translate-x-[20%] -translate-y-[20%] rounded-full bg-white" />
                </div>

                <div className="absolute top-[235px] h-5 w-5 rounded-full bg-slate-900" />

                <div className="absolute bottom-24 h-14 w-32 rounded-t-full border-t-4 border-slate-900" />

                <div className="absolute -bottom-8 left-1/2 h-10 w-44 -translate-x-1/2 rounded-full bg-slate-900/10 blur-xl" />
              </div>
            </div>
          </section>

          <section className="login-panel rounded-[2rem] border-2 border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-600">
              Restricted Access
            </p>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Prove it.
            </h1>

            <p className="mt-4 text-lg leading-8 text-slate-600">
              Sign in with Google to access the admin panel. This page is protected, mildly judgmental,
              and reserved for users with{' '}
              <code className="rounded-lg bg-slate-100 px-2 py-1 text-base text-slate-800">
                profiles.is_superadmin = true
              </code>
              .
            </p>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <LoginButton />
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        .face-wrapper {
          animation: headTilt 6s ease-in-out infinite;
          transform-origin: center center;
        }

        .eye-pupil {
          animation: judge 3s ease-in-out infinite;
        }

        .eyelid {
          animation: blink 5.5s ease-in-out infinite;
        }

        @keyframes judge {
          0%,
          100% {
            transform: translate(-50%, -60%);
          }
          15% {
            transform: translate(-50%, -56%);
          }
          35% {
            transform: translate(-50%, -42%);
          }
          60% {
            transform: translate(-50%, -48%);
          }
          80% {
            transform: translate(-50%, -58%);
          }
        }

        @keyframes blink {
          0%,
          44%,
          48%,
          100% {
            height: 0;
          }
          46%,
          47% {
            height: 100%;
          }
        }

        @keyframes headTilt {
          0%,
          100% {
            transform: rotate(0deg);
          }
          20% {
            transform: rotate(0deg);
          }
          32% {
            transform: rotate(-2.5deg);
          }
          50% {
            transform: rotate(0.5deg);
          }
          70% {
            transform: rotate(2deg);
          }
          85% {
            transform: rotate(0deg);
          }
        }

        @media (prefers-color-scheme: dark) {
          .login-page {
            background: linear-gradient(180deg, #020617 0%, #0f172a 55%, #111827 100%);
          }

          .login-page p:first-of-type {
            color: #f8fafc !important;
          }

          .login-panel {
            background: rgba(15, 23, 42, 0.92) !important;
            border-color: rgba(148, 163, 184, 0.25) !important;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35) !important;
          }

          .login-panel p,
          .login-panel h1 {
            color: #f8fafc !important;
          }

          .login-panel p.text-slate-600 {
            color: #cbd5e1 !important;
          }

          .login-panel code {
            background: rgba(255, 255, 255, 0.08) !important;
            color: #e2e8f0 !important;
          }

          .speech-bubble {
            background: #111827 !important;
            color: #f8fafc !important;
            border-color: #e2e8f0 !important;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35) !important;
          }

          .speech-tail {
            background: #111827 !important;
            border-color: #e2e8f0 !important;
          }

          .face {
            background: linear-gradient(180deg, #334155 0%, #1e293b 100%) !important;
            border-color: #e2e8f0 !important;
            box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45) !important;
          }

          .eye {
            background: #f8fafc !important;
            border-color: #e2e8f0 !important;
          }

          .eyelid {
            background: #cbd5e1 !important;
          }

          .eyebrow-left,
          .eyebrow-right,
          .eye-pupil,
          .face div.bg-slate-900,
          .face div.border-slate-900 {
            background-color: #e2e8f0 !important;
            border-color: #e2e8f0 !important;
          }

          .face .rounded-t-full {
            border-top-color: #e2e8f0 !important;
          }
        }
      `}</style>
    </main>
  )
}
