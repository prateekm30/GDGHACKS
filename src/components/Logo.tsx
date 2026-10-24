// A house with two doors: this one or that one.
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={className}>
      <rect width="32" height="32" rx="8" fill="var(--color-brand)" />
      <path d="M6 15.5 16 7l10 8.5V25a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" fill="#fff" />
      <path d="M11 26v-6h4v6M17 26v-6h4v6" fill="var(--color-accent)" />
    </svg>
  )
}
