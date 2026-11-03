export function classifySeverity(c) {
  const text = `${c.problemType || ''} ${c.description || ''}`.toLowerCase();
  if (/danger|fire|shock|exposed wire|flood|injury|critical/.test(text)) return 'Critical';
  if (/not working|failure|unavailable|broken|no water|no power/.test(text)) return 'High';
  if (/slow|weak|frequent|intermittent|maintenance/.test(text)) return 'Medium';
  return 'Low';
}
export const severityRank = { Low:1, Medium:2, High:3, Critical:4 };
