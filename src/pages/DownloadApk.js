import React from 'react';
import { Link } from 'react-router-dom';
import { Download, Smartphone, ShieldCheck, ArrowLeft } from 'lucide-react';

const FALLBACK_APK_FILE = '/downloads/civic-services-v1.0.0-debug.apk';
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL?.trim();
const APK_STORAGE_BUCKET = process.env.REACT_APP_APK_STORAGE_BUCKET || 'apk-distribution';
const APK_STORAGE_PATH = 'latest/civic-services-latest.apk';
const SUPABASE_APK_FILE = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/${APK_STORAGE_BUCKET}/${APK_STORAGE_PATH}`
  : '';
const EXTERNAL_APK_URL = process.env.REACT_APP_ANDROID_APK_URL?.trim();
const APK_FILE = EXTERNAL_APK_URL || SUPABASE_APK_FILE || FALLBACK_APK_FILE;
const APK_FILE_LABEL = EXTERNAL_APK_URL
  ? 'Manual external APK URL from environment'
  : SUPABASE_APK_FILE
    ? 'Supabase Storage latest APK (managed in Super Admin dashboard)'
    : 'Bundled static APK file';

export default function DownloadApk() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <section className="rounded-3xl border border-slate-800 bg-gradient-to-b from-emerald-600 to-emerald-800 p-8 shadow-2xl">
            <img
              src="/logov1.png"
              alt="Civic Services logo"
              className="mb-5 h-14 w-14 rounded-xl bg-white p-1"
            />
            <h1 className="text-3xl font-black tracking-tight">Download Civic Services APK</h1>
            <p className="mt-3 text-emerald-100">
              Install the latest Android build directly. Use this package for real-device testing and field demos.
            </p>
            <a
              href={APK_FILE}
              className="mt-8 inline-flex items-center gap-3 rounded-xl bg-white px-6 py-3 font-semibold text-emerald-900 hover:bg-emerald-50"
            >
              <Download className="h-5 w-5" />
              Download APK
            </a>
            <p className="mt-3 text-xs text-emerald-100">Source: {APK_FILE_LABEL}</p>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
            <h2 className="text-xl font-bold">Install Notes</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-3">
                <Smartphone className="mt-0.5 h-4 w-4 text-emerald-300" />
                Enable installation from unknown sources on your Android device.
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                Super Admin can upload latest APK in Admin Dashboard settings; this page auto-uses that URL.
              </li>
            </ul>
            <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950 p-4 text-xs text-slate-400">
              Tip: `REACT_APP_ANDROID_APK_URL` overrides the automatic Supabase APK URL when needed.
              <br />
              Share
              <span className="ml-1 font-semibold text-slate-200">/download-apk</span>
              as your installer URL.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
