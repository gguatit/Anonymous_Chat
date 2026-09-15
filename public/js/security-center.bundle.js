import{a}from"./chunks/chunk-VJREBZWY.js";import{a as r}from"./chunks/chunk-QGR4GHRQ.js";var s={events:[],total:0,page:1,limit:50,category:"",severity:"",search:"",ip:"",stats:null,riskIPs:[],badge:{critical:0,high:0,medium:0}},d=null;function b(t){return t?new Date(t).toLocaleString("ko-KR"):"-"}function f(t){return{low:"sev-low",medium:"sev-medium",high:"sev-high",critical:"sev-critical"}[t]||"sev-low"}function h(t){return{auth:"\uC778\uC99D",endpoint:"\uC5D4\uB4DC\uD3EC\uC778\uD2B8",input:"\uC785\uB825\uAC12",websocket:"\uC6F9\uC18C\uCF13",system:"\uC2DC\uC2A4\uD15C"}[t]||t}function $(){let t=document.getElementById("security-events-body");if(t){if(s.events.length===0){t.innerHTML='<tr><td colspan="7" style="padding:2rem;text-align:center;color:#94a3b8">\uC774\uBCA4\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';return}t.innerHTML=s.events.map(e=>`
        <tr class="event-row" data-id="${a(e.id)}">
            <td>${a(e.id)}</td>
            <td><span class="badge-cat">${a(h(e.category))}</span></td>
            <td><span class="${a(f(e.severity))}">${a(e.severity)}</span></td>
            <td class="mono">${a(e.ip||"-")}</td>
            <td class="mono truncate">${a(e.path||"-")}</td>
            <td>${a((e.details||"").substring(0,80))}</td>
            <td class="mono">${a(b(e.timestamp))}</td>
        </tr>
        <tr id="detail-${a(e.id)}" class="event-detail hidden">
            <td colspan="7">
                <div class="detail-grid">
                    <div><strong>Event Type:</strong> ${a(e.event_type)}</div>
                    <div><strong>Method:</strong> ${a(e.method||"-")}</div>
                    <div><strong>User Agent:</strong> ${a((e.user_agent||"").substring(0,100))}</div>
                    <div><strong>Country:</strong> ${a(e.country||"-")}</div>
                    <div><strong>Session:</strong> ${a(e.session_id||"-")}</div>
                    <div><strong>Score:</strong> ${Number(e.severity_score)||0}</div>
                </div>
            </td>
        </tr>
    `).join("")}}function E(){let t=document.getElementById("security-pagination");if(!t)return;let e=Math.ceil(s.total/s.limit);if(e<=1){t.innerHTML="";return}let n="";for(let i=1;i<=e;i++)n+=`<button class="page-btn ${i===s.page?"active":""}" data-page="${i}">${i}</button>`;t.innerHTML=n}function I(){let t=document.getElementById("security-stats");if(!t||!s.stats)return;let e=s.stats;t.innerHTML=`
        <div class="sec-stat">
            <div class="sec-stat-val">${e.last24h}</div>
            <div class="sec-stat-label">24h \uC774\uBCA4\uD2B8</div>
        </div>
        <div class="sec-stat sec-stat-critical">
            <div class="sec-stat-val">${s.badge.critical}</div>
            <div class="sec-stat-label">Critical</div>
        </div>
        <div class="sec-stat sec-stat-high">
            <div class="sec-stat-val">${s.badge.high}</div>
            <div class="sec-stat-label">High</div>
        </div>
        <div class="sec-stat sec-stat-medium">
            <div class="sec-stat-val">${s.badge.medium}</div>
            <div class="sec-stat-label">Medium</div>
        </div>
    `}function w(){let t=document.getElementById("risk-ips-body");if(t){if(s.riskIPs.length===0){t.innerHTML='<tr><td colspan="4" style="padding:1rem;text-align:center;color:#94a3b8">\uC704\uD5D8 IP\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';return}t.innerHTML=s.riskIPs.map(e=>`
        <tr>
            <td class="mono">${a(e.ip)}</td>
            <td>${Number(e.score)||0}</td>
            <td>${Number(e.eventCount)||0}</td>
            <td><button class="btn-sm btn-red" data-block-ip="${a(e.ip)}">\uCC28\uB2E8</button></td>
        </tr>
    `).join("")}}async function o(){try{let t=new URLSearchParams({page:s.page,limit:s.limit.toString()});s.category&&t.set("category",s.category),s.severity&&t.set("severity",s.severity),s.search&&t.set("search",s.search),s.ip&&t.set("ip",s.ip);let e=await r.get(`/api/admin/security/events?${t}`);s.events=e.events||[],s.total=e.total||0,s.page=e.page||1,$(),E()}catch{}}async function v(){try{let t=await r.get("/api/admin/security/stats");s.stats=t,I()}catch{}}async function p(){try{let t=await r.get("/api/admin/security/risk-ips");s.riskIPs=t.riskIPs||[],w()}catch{}}async function L(){try{let t=await r.get("/api/admin/security/badge");s.badge=t,k()}catch{}}function k(){document.querySelectorAll('[data-badge="security"]').forEach(t=>{let e=s.badge.critical+s.badge.high+s.badge.medium;e>0?(t.style.display="inline-flex",t.textContent=e,t.style.background=s.badge.critical>0?"#dc2626":s.badge.high>0?"#ea580c":"#d97706"):t.style.display="none"})}async function B(){try{let t=new URLSearchParams;s.category&&t.set("category",s.category);let n=await(await r.getRaw(`/api/admin/security/events/export?${t}`)).blob(),i=URL.createObjectURL(n),l=document.createElement("a");l.href=i,l.download=`security-events-${Date.now()}.csv`,l.click(),URL.revokeObjectURL(i),d?.showNotification("CSV \uB0B4\uBCF4\uB0B4\uAE30 \uC644\uB8CC","success")}catch{d?.showNotification("CSV \uB0B4\uBCF4\uB0B4\uAE30 \uC2E4\uD328","error")}}async function P(){if(confirm("90\uC77C \uC774\uC0C1 \uB41C \uBCF4\uC548 \uC774\uBCA4\uD2B8\uB97C \uBAA8\uB450 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?"))try{let t=Date.now()-7776e6,e=await r.post("/api/admin/security/events/clear",{before:t});d?.showNotification(`${e?.deleted||0}\uAC1C \uC774\uBCA4\uD2B8 \uC0AD\uC81C\uB428`,"success"),o(),v()}catch{d?.showNotification("\uC774\uBCA4\uD2B8 \uC0AD\uC81C \uC2E4\uD328","error")}}async function S(t){if(confirm(`${t} IP\uB97C 24\uC2DC\uAC04 \uCC28\uB2E8\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`))try{await r.post("/api/admin/security/block-ip",{ip:t}),d?.showNotification(`${t} \uCC28\uB2E8 \uC644\uB8CC`,"success"),p()}catch{d?.showNotification("IP \uCC28\uB2E8 \uC2E4\uD328","error")}}function y(t,e){let n;return function(...i){clearTimeout(n),n=setTimeout(()=>t.apply(this,i),e)}}async function M(t){d=t,document.getElementById("security-refresh-btn")?.addEventListener("click",()=>m(t)),document.getElementById("security-export-btn")?.addEventListener("click",B),document.getElementById("security-clear-btn")?.addEventListener("click",P);let e=document.getElementById("security-category-filter"),n=document.getElementById("security-severity-filter"),i=document.getElementById("security-search"),l=document.getElementById("security-ip-filter");e?.addEventListener("change",()=>{s.category=e.value,s.page=1,o()}),n?.addEventListener("change",()=>{s.severity=n.value,s.page=1,o()}),i?.addEventListener("input",y(()=>{s.search=i.value,s.page=1,o()},400)),l?.addEventListener("input",y(()=>{s.ip=l.value.trim(),s.page=1,o()},400)),document.getElementById("security-events-body")?.addEventListener("click",u=>{let c=u.target.closest(".event-row");if(!c)return;let g=document.getElementById(`detail-${c.dataset.id}`);g&&g.classList.toggle("hidden")}),document.getElementById("risk-ips-body")?.addEventListener("click",u=>{let c=u.target.closest("[data-block-ip]");c&&S(c.dataset.blockIp)}),document.getElementById("security-pagination")?.addEventListener("click",u=>{let c=u.target.closest(".page-btn");c&&(s.page=parseInt(c.dataset.page),o(),document.getElementById("security-events-table")?.scrollIntoView({behavior:"smooth"}))}),await m(t)}async function m(t){t.updateLastUpdated(),await Promise.allSettled([o(),v(),p(),L()])}export{M as init,m as refresh};
