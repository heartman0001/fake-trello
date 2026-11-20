import clsx from 'clsx';

const sizeClasses = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-20 w-20 text-2xl',
  xl: 'h-28 w-28 text-4xl',
} as const;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function UserAvatar({
  name,
  avatarUrl,
  size = 'md',
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof sizeClasses;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-semibold uppercase text-white ring-2 ring-white',
        sizeClasses[size],
        className,
      )}
      aria-hidden={avatarUrl ? undefined : true}
    >
      {avatarUrl ? (
        // Uploaded avatars are already compressed data URLs, so Next Image
        // optimisation would add no value here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name ? `${name}'s profile photo` : 'Profile photo'}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}
