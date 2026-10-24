// The mark is a miniature of the unified calendar: stays from each platform lined up without overlapping
export default function Logo({ light = false }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="30" height="26" viewBox="0 0 30 26" aria-hidden>
        <rect x="0" y="1" width="17" height="5" rx="2.5" fill="#D9555B" />
        <rect x="19" y="1" width="11" height="5" rx="2.5" fill="#2A5BA8" />
        <rect x="6" y="10.5" width="20" height="5" rx="2.5" fill="#6B4BB4" />
        <rect x="0" y="20" width="9" height="5" rx="2.5" fill={light ? '#fff' : '#1F5C45'} />
        <rect x="11" y="20" width="14" height="5" rx="2.5" fill="#C8902E" />
      </svg>
      <span className={`text-xl font-bold ${light ? 'text-white' : 'text-ink'}`}>مُضيف</span>
    </span>
  );
}
