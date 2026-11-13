import source from '../assets/dhaakon-logo.svg?raw';

/**
 * The dhaakon wordmark, drawn from the same file dhaakon.com serves
 * (assets/dhaakon-logo.svg). It is inlined rather than loaded as an image so
 * it takes the surrounding text colour.
 */
const viewBox = source.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 557.75 262.33';
const outline = source.match(/<path[^>]*\sd="([^"]+)"/)?.[1] ?? '';

export function BrandLogo({
  className,
  title,
}: {
  className?: string;
  /** Names the image. Omit when a parent link or heading already does. */
  title?: string;
}) {
  return (
    <svg
      className={className}
      viewBox={viewBox}
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d={outline} />
    </svg>
  );
}
