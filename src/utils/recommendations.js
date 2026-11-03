export function recommendations(records, category) {
  const rows=records.filter(c=>c.category===category), grouped={}; rows.forEach(c=>{const k=c.problemType||'Other';grouped[k]=(grouped[k]||[]).concat(c);});
  return Object.entries(grouped).filter(([,items])=>items.length>=2).map(([problem,items])=>({title:problem==='Slow internet'?'Inspect network bandwidth':problem==='Water supply'?'Assign maintenance staff':`Review recurring ${problem.toLowerCase()} reports`,reason:`${items.length} complaints report this issue in ${category}.`,count:items.length,location:mostCommon(items.map(c=>c.location).filter(Boolean))}));
}
export const mostCommon=items=>{const m={};items.forEach(x=>m[x]=(m[x]||0)+1);return Object.entries(m).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';};
