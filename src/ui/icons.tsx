import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", "aria-hidden": true } as const;

export const Logo = (p: P) => (
  <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true" {...p}>
    <rect x="1" y="1" width="62" height="62" rx="14" fill="#0b1220" stroke="var(--line)" strokeWidth="2" />
    <path d="M32 10 50 17v14c0 11-7.6 19.6-18 23-10.4-3.4-18-12-18-23V17z" fill="none" stroke="#7c9cff" strokeWidth="4" strokeLinejoin="round" />
    <path d="M19 33h7l3-7 5 14 3-7h8" fill="none" stroke="#4ade80" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const ScreenIcon = (p: P) => (<svg {...base} {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>);
export const FileIcon = (p: P) => (<svg {...base} {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M10 12l5 3-5 3z" /></svg>);
export const CameraIcon = (p: P) => (<svg {...base} {...p}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></svg>);
export const ShieldIcon = (p: P) => (<svg {...base} {...p}><path d="M12 3 20 6v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6z" /><path d="m9 12 2 2 4-4" /></svg>);
export const HeartIcon = (p: P) => (<svg {...base} {...p}><path d="M3 12h4l2-5 4 10 2-5h6" /></svg>);
export const EyeIcon = (p: P) => (<svg {...base} {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>);
export const LayersIcon = (p: P) => (<svg {...base} {...p}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></svg>);
export const TurnIcon = (p: P) => (<svg {...base} {...p}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>);
export const WaveIcon = (p: P) => (<svg {...base} {...p}><path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" /></svg>);
export const LockIcon = (p: P) => (<svg {...base} {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>);
export const GithubIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.4-1.3.1-2.7 0 0 .9-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z" />
  </svg>
);
export const SunMoonIcon = (p: P) => (<svg {...base} {...p}><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" /></svg>);
export const PauseIcon = (p: P) => (<svg {...base} {...p}><path d="M9 5v14M15 5v14" /></svg>);
export const PlayIcon = (p: P) => (<svg {...base} {...p}><path d="m7 5 12 7-12 7z" /></svg>);
export const StopIcon = (p: P) => (<svg {...base} {...p}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>);
export const DownloadIcon = (p: P) => (<svg {...base} {...p}><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" /></svg>);
export const CopyIcon = (p: P) => (<svg {...base} {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>);
export const SettingsIcon = (p: P) => (<svg {...base} {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>);
export const ArrowIcon = (p: P) => (<svg {...base} {...p}><path d="M5 12h14m-5-5 5 5-5 5" /></svg>);
export const CheckIcon = (p: P) => (<svg {...base} {...p}><path d="m5 12 5 5 9-10" /></svg>);
