import { classifySeverity } from './severity.js';
export const categories=['Wi-Fi','Hostel','Classroom','Laboratory'];
export const departments={'Wi-Fi':'IT Department',Hostel:'Hostel Management',Classroom:'Facility Management',Laboratory:'Lab Administration'};
export const enriched = c => ({...c,severity:c.severity||classifySeverity(c)});
export function departmentStats(records, category) {
  const rows=records.filter(c=>c.category===category).map(enriched), resolved=rows.filter(c=>c.status==='Resolved');
  const resolutionTimes=resolved.map(c=>Math.max(0,((c.updatedAt||c.submittedAt)-c.submittedAt)/3600000));
  return {total:rows.length,pending:rows.length-resolved.length,resolved:resolved.length,high:rows.filter(c=>['High','Critical'].includes(c.severity)).length,avgResolution:resolutionTimes.length?resolutionTimes.reduce((a,b)=>a+b,0)/resolutionTimes.length:null,rows};
}
export function problemCounts(records, category) { const counts={}; records.filter(c=>c.category===category).forEach(c=>counts[c.problemType||'Other']=(counts[c.problemType||'Other']||0)+1); return Object.entries(counts).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count); }
export function timeSeries(records, category) { const map=new Map(); records.filter(c=>c.category===category).forEach(c=>{const key=new Date(c.submittedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'});map.set(key,(map.get(key)||0)+1);});return [...map].map(([date,complaints])=>({date,complaints})); }
export function statusCounts(records, category) { return ['Raised','In Progress','Resolved'].map(status=>({name:status,value:records.filter(c=>c.category===category&&c.status===status).length})); }
export function severityCounts(records, category) { return ['Low','Medium','High','Critical'].map(name=>({name,value:records.filter(c=>c.category===category&&(c.severity||classifySeverity(c))===name).length})); }
