(() => {
  'use strict';
  const STORAGE_KEY = 'campuscare.complaints.v1';
  const COUNTER_KEY = 'campuscare.nextId.v1';
  const weights = { 'Wi-Fi': 2, Hostel: 2, Classroom: 1, Laboratory: 3 };
  const departments = { 'Wi-Fi': 'IT Department', Hostel: 'Hostel Management', Classroom: 'Facility Management', Laboratory: 'Lab Administration' };
  const categories = Object.keys(weights);
  const statuses = ['Raised', 'In Progress', 'Resolved'];
  const categoryColors = { 'Wi-Fi': '#5875e8', Hostel: '#a27be2', Classroom: '#e49b46', Laboratory: '#36a786' };
  const now = Date.now();
  const samples = [
    { id: 'C01', category: 'Wi-Fi', description: 'Wi-Fi connectivity is unavailable in the library study area.', submittedAt: now - 48 * 3600000, status: 'Raised' },
    { id: 'C02', category: 'Hostel', description: 'The hot water supply is not working on the second floor.', submittedAt: now - 8 * 3600000, status: 'In Progress' },
    { id: 'C03', category: 'Classroom', description: 'The projector in Room 204 is not displaying the lecture slides.', submittedAt: now - 72 * 3600000, status: 'Raised' },
    { id: 'C04', category: 'Laboratory', description: 'A faulty bench power outlet in the electronics lab.', submittedAt: now - 24 * 3600000, status: 'Resolved' }
  ];
  const safeParse = value => { try { return JSON.parse(value); } catch { return null; } };
  function validComplaint(c) { return c && typeof c.id === 'string' && categories.includes(c.category) && typeof c.description === 'string' && Number.isFinite(Number(c.submittedAt)) && statuses.includes(c.status); }
  function loadComplaints() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) { localStorage.setItem(STORAGE_KEY, JSON.stringify(samples)); localStorage.setItem(COUNTER_KEY, '5'); return samples.map(x => ({ ...x })); }
    const data = safeParse(raw);
    return Array.isArray(data) ? data.filter(validComplaint) : [];
  }
  const apiMode = location.protocol.startsWith('http:') && location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  let complaints = apiMode ? [] : loadComplaints();
  let query = '';
  let categoryFilter = '';
  let statusFilter = '';
  let categoryChart = null;
  let resolutionChart = null;
  async function apiRequest(path, options = {}) {
    const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Backend error (${response.status})`);
    return data;
  }
  async function syncFromApi() {
    if (!apiMode) return;
    const data = await apiRequest('/complaints');
    complaints = Array.isArray(data.complaints) ? data.complaints : [];
    renderAll();
  }
  function saveComplaints() { localStorage.setItem(STORAGE_KEY, JSON.stringify(complaints)); }
  function generateUniqueId() {
    const used = new Set(complaints.map(c => c.id.toUpperCase()));
    let next = Math.max(1, Number(localStorage.getItem(COUNTER_KEY)) || 1);
    let id;
    do { id = `C${String(next++).padStart(3, '0')}`; } while (used.has(id.toUpperCase()));
    localStorage.setItem(COUNTER_KEY, String(next)); return id;
  }
  const isResolved = c => c.status === 'Resolved';
  const ageHours = (c, at = Date.now()) => Math.max(0, (at - Number(c.submittedAt)) / 3600000);
  const ageLabel = c => { const h = Math.floor(ageHours(c)); const d = Math.floor(h / 24); return d ? `${d}d ${h % 24}h` : `${h}h`; };
  const urgencyScore = c => (weights[c.category] || 0) + Math.floor(ageHours(c) / 24);
  function overdueLevel(c) { if (isResolved(c)) return null; const h = ageHours(c); return h < 24 ? 'Normal' : h <= 48 ? 'Overdue' : 'Critical'; }
  const departmentFor = c => departments[c.category] || 'Unassigned';
  const unresolved = () => complaints.filter(c => !isResolved(c));
  function prioritySorted() { return unresolved().sort((a,b) => urgencyScore(b)-urgencyScore(a) || Number(b.submittedAt)-Number(a.submittedAt) || idNumber(a.id)-idNumber(b.id)); }
  function idNumber(id) { const match = id.match(/\d+/); return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER; }
  function filteredComplaints() { const q=query.trim().toLowerCase(); return complaints.filter(c => (!q || c.id.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)) && (!categoryFilter || c.category===categoryFilter) && (!statusFilter || c.status===statusFilter)).sort((a,b)=>Number(b.submittedAt)-Number(a.submittedAt)); }
  function statusClass(s) { return s==='Raised'?'status-raised':s==='In Progress'?'status-progress':'status-resolved'; }
  function statusBadge(s) { return `<span class="badge ${statusClass(s)}">${escapeHtml(s)}</span>`; }
  function levelBadge(c) { const level=overdueLevel(c); return level ? `<span class="badge level-${level.toLowerCase()}">${level}</span>` : '<span class="age-sub">—</span>'; }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function dateLabel(ts) { const d=new Date(Number(ts)); return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' · '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}); }
  function shortDate(ts) { return new Date(Number(ts)).toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
  function stats() { const u=unresolved(); return { total:complaints.length,pending:u.length,resolved:complaints.filter(isResolved).length,critical:u.filter(c=>ageHours(c)>48).length,progress:complaints.filter(c=>c.status==='In Progress').length }; }
  function renderStats() {
    const s=stats(); const cards=[['Total complaints',s.total,'All reports received','▤','#edf1ff','#506ee3'],['Pending complaints',s.pending,'Awaiting resolution','◷','#fff3df','#bc7b21'],['Resolved',s.resolved,'Successfully closed','✓','#e7f6ef','#168b68'],['Critical',s.critical,'Unresolved · over 48 hours','⚑','#fff0ef','#d45055'],['In progress',s.progress,'Being worked on','↗','#f1eefe','#8066cc']];
    document.getElementById('statsGrid').innerHTML=cards.map(c=>`<article class="stat-card"><div class="stat-top"><span class="stat-label">${c[0]}</span><span class="stat-icon" style="background:${c[4]};color:${c[5]}">${c[3]}</span></div><div class="stat-value">${c[1]}</div><div class="stat-foot">${c[2]}</div></article>`).join('');
    document.getElementById('navCount').textContent=s.total;
  }
  function queueMarkup(list, full=false) {
    if (!list.length) return `<div class="queue-empty"><b>All clear for now</b><span>No unresolved complaints in the queue.</span></div>`;
    if (!full) return `<div class="queue-list">${list.slice(0,3).map((c,i)=>`<div class="queue-item"><span class="queue-rank">${i+1}</span><div class="queue-main"><div class="queue-id">${escapeHtml(c.id)} <span class="category-cell"><i class="cat-dot" style="background:${categoryColors[c.category]}"></i>${escapeHtml(c.category)}</span> ${levelBadge(c)}</div><div class="queue-desc">${escapeHtml(c.description)}</div></div><div class="queue-score"><b>${urgencyScore(c)}</b><small>score · ${ageLabel(c)}</small></div></div>`).join('')}</div>`;
    return list.slice(0,3).map((c,i)=>`<article class="priority-card ${i===0?'first':''}"><div class="priority-card-rank"><span>${String(i+1).padStart(2,'0')}<small>RANK</small></span></div><div class="priority-card-info"><div class="priority-card-top"><b>${escapeHtml(c.id)}</b><span class="category-cell"><i class="cat-dot" style="background:${categoryColors[c.category]}"></i>${escapeHtml(c.category)}</span>${statusBadge(c.status)}${levelBadge(c)}</div><p class="priority-card-desc">${escapeHtml(c.description)}</p><div class="priority-meta"><span>Age <b>${ageLabel(c)}</b></span><span>Department <b>${escapeHtml(departmentFor(c))}</b></span><span>Submitted <b>${dateLabel(c.submittedAt)}</b></span></div></div><div class="priority-score"><strong>${urgencyScore(c)}</strong><small>URGENCY</small></div></article>`).join('');
  }
  function renderBreakdown(targetId, compact=false) {
    const counts=categories.map(cat=>[cat,complaints.filter(c=>c.category===cat).length]); const max=Math.max(1,...counts.map(x=>x[1]));
    const el=document.getElementById(targetId); if(!complaints.length){el.innerHTML='<div class="queue-empty"><b>No complaints yet</b><span>Category insights will appear here.</span></div>';return;}
    el.innerHTML=`<div class="${compact?'breakdown-list':'chart-content'}">${counts.map(([cat,n])=>`<div class="${compact?'breakdown-row':'chart-bar-row'}"><span>${cat}</span><div class="bar-track"><div class="bar-fill" style="width:${n/max*100}%;background:${categoryColors[cat]}"></div></div><b class="${compact?'breakdown-count':''}">${n}</b></div>`).join('')}</div>${compact?'':`<div class="chart-legend">${categories.map(c=>`<span><i class="legend-dot" style="background:${categoryColors[c]}"></i>${c}</span>`).join('')}</div>`}`;
  }
  function renderTableRows(rows, recent=false) {
    const tbody=document.getElementById(recent?'recentBody':'complaintBody');
    if(!rows.length){tbody.innerHTML=recent?'':'<tr><td class="empty-cell" colspan="8">No complaints match your search or filters.</td></tr>';return;}
    tbody.innerHTML=rows.map(c=>`<tr><td><span class="id-cell">${escapeHtml(c.id)}</span></td><td><span class="category-cell"><i class="cat-dot" style="background:${categoryColors[c.category]}"></i>${escapeHtml(c.category)}</span></td>${recent?'':`<td class="desc-cell" title="${escapeHtml(c.description)}">${escapeHtml(c.description)}</td>`}<td>${dateLabel(c.submittedAt)}</td><td><span class="age-main">${ageLabel(c)}</span>${levelBadge(c)}</td><td><span class="department">${escapeHtml(departmentFor(c))}</span></td><td>${statusBadge(c.status)}</td><td>${isResolved(c)?'<span class="detail-btn">Closed</span>':`<select class="action-select" data-status-id="${escapeHtml(c.id)}" aria-label="Update status for ${escapeHtml(c.id)}"><option value="">Update…</option>${statuses.slice(statuses.indexOf(c.status)+1).map(s=>`<option>${s}</option>`).join('')}</select>`} <button class="detail-btn" data-detail="${escapeHtml(c.id)}">Details</button></td></tr>`).join('');
  }
  function renderComplaints() { const rows=filteredComplaints(); renderTableRows(rows); document.getElementById('resultCount').textContent=`${rows.length} of ${complaints.length}`; }
  function renderAnalytics() {
    const most=categories.map(cat=>[cat,complaints.filter(c=>c.category===cat).length]).sort((a,b)=>b[1]-a[1]); const top=complaints.length&&most[0][1]>0?most[0][0]:'—'; const s=stats();
    document.getElementById('analyticsKpis').innerHTML=`<div class="analytics-kpi"><small>Total complaints</small><b>${s.total}</b><span>Across all categories</span></div><div class="analytics-kpi"><small>Most reported</small><b>${escapeHtml(top)}</b><span>${top==='—'?'No reports yet':`${most[0][1]} report${most[0][1]===1?'':'s'}`}</span></div><div class="analytics-kpi"><small>Resolution rate</small><b>${s.total?Math.round(s.resolved/s.total*100):0}%</b><span>${s.resolved} resolved · ${s.pending} pending</span></div>`;
    renderBreakdown('analyticsChart');
    document.getElementById('resolutionChart').innerHTML=s.total?`<div class="donut-wrap"><div class="donut" style="background:conic-gradient(#5070e8 0 ${s.resolved/s.total*100}%,#e9edf4 ${s.resolved/s.total*100}% 100%)"><div class="donut-label"><b>${s.total}</b><small>TOTAL</small></div></div><div class="donut-legend"><div><i class="legend-dot" style="background:#5070e8"></i>Resolved<b>${s.resolved}</b></div><div><i class="legend-dot" style="background:#e9edf4"></i>Pending<b>${s.pending}</b></div></div></div>`:'<div class="queue-empty"><b>No data yet</b><span>Resolution insights appear after complaints are submitted.</span></div>';
  }
  function renderAll() {
    renderStats(); renderTableRows(complaints.slice().sort((a,b)=>Number(b.submittedAt)-Number(a.submittedAt)).slice(0,5),true); renderComplaints();
    const sorted=prioritySorted(); document.getElementById('dashboardQueue').innerHTML=queueMarkup(sorted); document.getElementById('fullQueue').innerHTML=queueMarkup(sorted,true);
    renderBreakdown('dashboardBreakdown',true); renderAnalytics();
  }
  async function registerComplaint(category, description) {
    if(!categories.includes(category)) return {error:'Choose a valid complaint category.'};
    const clean=description.trim(); if(!clean) return {error:'Please enter a description before submitting.'};
    if (apiMode) {
      try { const record=await apiRequest('/complaints',{method:'POST',body:JSON.stringify({category,description:clean})}); complaints.push(record); renderAll(); return {record}; }
      catch(error) { return {error:error.message}; }
    }
    const record={id:generateUniqueId(),category,description:clean,submittedAt:Date.now(),status:'Raised'};
    complaints.push(record); saveComplaints(); renderAll(); return {record};
  }
  async function updateStatus(id, next) {
    const item=complaints.find(c=>c.id===id); if(!item) return {error:'Complaint could not be found.'};
    const currentIndex=statuses.indexOf(item.status), nextIndex=statuses.indexOf(next);
    if(nextIndex!==currentIndex+1) return {error:'Complaints can only move from Raised to In Progress to Resolved.'};
    if (apiMode) {
      try { const updated=await apiRequest(`/complaints/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:next})}); Object.assign(item,updated); renderAll(); return {item}; }
      catch(error) { return {error:error.message}; }
    }
    item.status=next; item.updatedAt=Date.now(); saveComplaints(); renderAll(); return {item};
  }
  function toast(title, message, error=false) {
    const region=document.getElementById('toastRegion'), el=document.createElement('div'); el.className=`toast${error?' error':''}`; el.innerHTML=`<span class="toast-icon">${error?'!':'✓'}</span><div><b>${escapeHtml(title)}</b><p>${escapeHtml(message)}</p></div><button class="toast-dismiss" aria-label="Dismiss notification">×</button>`;
    region.append(el); const remove=()=>el.remove(); el.querySelector('button').addEventListener('click',remove); setTimeout(remove,5000);
  }
  function navigate(view) {
    if(!document.getElementById(`view-${view}`)) view='dashboard';
    document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===`view-${view}`));
    document.querySelectorAll('.nav-link[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
    const names={dashboard:'Dashboard',complaints:'All complaints',submit:'Submit complaint',priority:'Priority queue',analytics:'Analytics',settings:'Settings'};
    document.getElementById('pageCrumb').textContent=names[view]; history.replaceState(null,'',`#${view}`); document.getElementById('sidebar').classList.remove('open'); window.scrollTo(0,0);
  }
  function openDetails(id) {
    const c=complaints.find(x=>x.id===id); if(!c)return;
    document.getElementById('modalContent').innerHTML=`<div class="eyebrow">COMPLAINT DETAILS</div><h2 id="modalTitle">${escapeHtml(c.id)} <span class="category-cell"><i class="cat-dot" style="background:${categoryColors[c.category]}"></i>${escapeHtml(c.category)}</span></h2><div class="modal-details"><div><small>STATUS</small>${statusBadge(c.status)}</div><div><small>PRIORITY</small><span>${isResolved(c)?'Resolved':`${urgencyScore(c)} urgency · ${overdueLevel(c)}`}</span></div><div><small>SUBMITTED</small><span>${dateLabel(c.submittedAt)}</span></div><div><small>AGE</small><span>${ageLabel(c)}</span></div><div><small>RECOMMENDED DEPARTMENT</small><b>${escapeHtml(departmentFor(c))}</b></div><div class="modal-desc"><small>DESCRIPTION</small><span>${escapeHtml(c.description)}</span></div></div><div class="modal-actions"><button class="button secondary" id="detailClose">Close</button>${!isResolved(c)?`<select class="action-select" id="detailStatus"><option value="">Update status…</option>${statuses.slice(statuses.indexOf(c.status)+1).map(s=>`<option>${s}</option>`).join('')}</select>`:''}</div>`;
    document.getElementById('modalBackdrop').hidden=false; document.getElementById('modalClose').focus(); document.getElementById('detailClose').onclick=closeModal;
    const select=document.getElementById('detailStatus'); if(select)select.onchange=async()=>{if(select.value){const next=select.value;const result=await updateStatus(id,next);closeModal();if(result.error)toast('Could not update',result.error,true);else toast('Status updated',`${id} is now ${next}.`);}};
  }
  function closeModal(){document.getElementById('modalBackdrop').hidden=true;}
  document.querySelectorAll('[data-view]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();navigate(a.dataset.view);}));
  document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.goto)));
  document.getElementById('menuBtn').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
  document.getElementById('today').textContent=new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  document.getElementById('globalSearch').addEventListener('input',e=>{query=e.target.value;document.getElementById('listSearch').value=e.target.value;renderComplaints();if(query)navigate('complaints');});
  document.getElementById('listSearch').addEventListener('input',e=>{query=e.target.value;document.getElementById('globalSearch').value=e.target.value;renderComplaints();});
  document.getElementById('categoryFilter').addEventListener('change',e=>{categoryFilter=e.target.value;renderComplaints();});
  document.getElementById('statusFilter').addEventListener('change',e=>{statusFilter=e.target.value;renderComplaints();});
  document.getElementById('descriptionInput').addEventListener('input',e=>document.getElementById('charCount').textContent=`${e.target.value.length} / 1000`);
  document.getElementById('complaintForm').addEventListener('submit',async e=>{e.preventDefault();const result=await registerComplaint(document.getElementById('categoryInput').value,document.getElementById('descriptionInput').value);if(result.error){toast('Check the form',result.error,true);return;}e.currentTarget.reset();document.getElementById('charCount').textContent='0 / 1000';navigate('complaints');toast('Complaint submitted',`Your complaint ID is ${result.record.id}.`);});
  document.addEventListener('change',async e=>{const select=e.target.closest('[data-status-id]');if(!select||!select.value)return;const id=select.dataset.statusId, next=select.value;select.value='';const result=await updateStatus(id,next);if(result.error)toast('Could not update',result.error,true);else toast('Status updated',`${id} is now ${next}.`);});
  document.addEventListener('click',e=>{const detail=e.target.closest('[data-detail]');if(detail)openDetails(detail.dataset.detail);});
  document.getElementById('modalClose').addEventListener('click',closeModal); document.getElementById('modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();document.getElementById('sidebar').classList.remove('open');}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();navigate('complaints');document.getElementById('globalSearch').focus();}});
  document.getElementById('notificationBtn').addEventListener('click',()=>{const urgent=unresolved().filter(c=>ageHours(c)>=24).length;toast(urgent?`${urgent} complaint${urgent===1?'':'s'} need attention`:'You’re all caught up',urgent?'Review the priority queue for overdue reports.':'No overdue complaints right now.');});
  document.getElementById('resetBtn').addEventListener('click',()=>{document.getElementById('modalContent').innerHTML='<div class="eyebrow">CLEAR LOCAL DATA</div><h2 id="modalTitle">Reset complaint data?</h2><p class="confirm-copy">This permanently deletes all complaint records stored in this browser. Your dashboard will be empty afterwards.</p><div class="confirm-actions"><button class="button secondary" id="cancelReset">Cancel</button><button class="button danger" id="confirmReset">Delete all complaints</button></div>';document.getElementById('modalBackdrop').hidden=false;document.getElementById('modalClose').focus();document.getElementById('cancelReset').onclick=closeModal;document.getElementById('confirmReset').onclick=async()=>{if(apiMode){try{await apiRequest('/complaints',{method:'DELETE'});}catch(error){closeModal();toast('Could not reset',error.message,true);return;}}else{localStorage.removeItem(STORAGE_KEY);localStorage.setItem(STORAGE_KEY,'[]');localStorage.setItem(COUNTER_KEY,String(Math.max(1,Number(localStorage.getItem(COUNTER_KEY))||1)));}complaints=[];renderAll();closeModal();toast('Complaint data cleared','The dashboard is now empty.');};});
  renderAll(); if(apiMode)syncFromApi().catch(error=>toast('Backend unavailable',`${error.message} Start backend/server.py and reload.`,true)); const initial=location.hash.slice(1); if(initial&&document.getElementById(`view-${initial}`))navigate(initial);
  // Keep age and overdue badges current without reloading persisted complaint data.
  setInterval(renderAll,60000);
})();
