export function scoreColor(score: number) {
  if (score >= 8) return "bg-green-100 text-green-800";
  if (score >= 5) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}
