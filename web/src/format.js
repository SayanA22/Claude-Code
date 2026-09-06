export function relativeTime(isoString) {
  if (!isoString) return "never";
  const seconds = (Date.now() - Date.parse(isoString)) / 1000;
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function diffSize(additions, deletions) {
  const total = additions + deletions;
  if (total < 20) return "xs";
  if (total < 100) return "s";
  if (total < 400) return "m";
  if (total < 1000) return "l";
  return "xl";
}
