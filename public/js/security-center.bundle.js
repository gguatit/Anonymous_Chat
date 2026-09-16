import{a as i}from"./chunks/chunk-VJREBZWY.js";import{c as o}from"./chunks/chunk-5BXH33CP.js";var s={events:[],total:0,page:1,limit:50,category:"",severity:"",search:"",ip:"",stats:null,riskIPs:[],badge:{critical:0,high:0,medium:0}},l=null;function f(t){return t?new Date(t).toLocaleString("ko-KR"):"-"}function h(t){return{low:"sev-low",medium:"sev-medium",high:"sev-high",critical:"sev-critical"}[t]||"sev-low"}function E(t){return{auth:"\uC778\uC99D",endpoint:"\uC5D4\uB4DC\uD3EC\uC778\uD2B8",input:"\uC785\uB825\uAC12",websocket:"\uC6F9\uC18C\uCF13",system:"\uC2DC\uC2A4\uD15C"}[t]||t}function I(){let t=document.getElementById("security-events-body");if(t){if(s.events.length===0){t.innerHTML='<tr><td colspan="7" style="padding:2rem;text-align:center;color:#94a3b8">\uC774\uBCA4\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';return}t.innerHTML=s.events.map(e=>`
        <tr class="event-row" data-id="${i(e.id)}">
            <td>${i(e.id)}</td>
            <td><span class="badge-cat">${i(E(e.category))}</span></td>
            <td><span class="${i(h(e.severity))}">${i(e.severity)}</span></td>
            <td class="mono">${i(e.ip||"-")}</td>
            <td class="mono truncate">${i(e.path||"-")}</td>
            <td>${i((e.details||"").substring(0,80))}</td>
            <td class="mono">${i(f(e.timestamp))}</td>
        </tr>
        <tr id="detail-${i(e.id)}" class="event-detail hidden">
            <td colspan="7">
                <div class="detail-grid">
                    <div><strong>Event Type:</strong> ${i(e.event_type)}</div>
                    <div><strong>Method:</strong> ${i(e.method||"-")}</div>
                    <div><strong>User Agent:</strong> ${i((e.user_agent||"").substring(0,100))}</div>
                    <div><strong>Country:</strong> ${i(e.country||"-")}</div>
                    <div><strong>Session:</strong> ${i(e.session_id||"-")}</div>
                    <div><strong>Score:</strong> ${Number(e.severity_score)||0}</div>
                </div>
            </td>
        </tr>
    `).join("")}}function $(){let t=document.getElementById("security-pagination");if(!t)return;let e=Math.ceil(s.total/s.limit);if(e<=1){t.innerHTML="";return}let c="";for(let a=1;a<=e;a++)c+=`<button class="page-btn ${a===s.page?"active":""}" data-page="${a}">${a}</button>`;t.innerHTML=c}function w(){let t=document.getElementById("security-stats");if(!t||!s.stats)return;let e=s.stats;t.innerHTML=`
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
    `}function k(){let t=document.getElementById("risk-ips-body");if(t){if(s.riskIPs.length===0){t.innerHTML='<tr><td colspan="4" style="padding:1rem;text-align:center;color:#94a3b8">\uC704\uD5D8 IP\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';return}t.innerHTML=s.riskIPs.map(e=>`
        <tr>
            <td class="mono">${i(e.ip)}</td>
            <td>${Number(e.score)||0}</td>
            <td>${Number(e.eventCount)||0}</td>
            <td><button class="btn-sm btn-red" data-block-ip="${i(e.ip)}">\uCC28\uB2E8</button></td>
        </tr>
    `).join("")}}async function d(){try{let t=new URLSearchParams({page:s.page,limit:s.limit.toString()});s.category&&t.set("category",s.category),s.severity&&t.set("severity",s.severity),s.search&&t.set("search",s.search),s.ip&&t.set("ip",s.ip);let e=await o.get(`/api/admin/security/events?${t}`);s.events=e.events||[],s.total=e.total||0,s.page=e.page||1,I(),$()}catch{}}async function p(){try{let t=await o.get("/api/admin/security/stats");s.stats=t,w()}catch{}}async function b(){try{let t=await o.get("/api/admin/security/risk-ips");s.riskIPs=t.riskIPs||[],k()}catch{}}async function L(){try{let t=await o.get("/api/admin/security/badge");s.badge=t,B()}catch{}}function B(){document.querySelectorAll('[data-badge="security"]').forEach(t=>{let e=s.badge.critical+s.badge.high+s.badge.medium;e>0?(t.style.display="inline-flex",t.textContent=e,t.style.background=s.badge.critical>0?"#dc2626":s.badge.high>0?"#ea580c":"#d97706"):t.style.display="none"})}async function P(){try{let t=new URLSearchParams;s.category&&t.set("category",s.category);let c=await(await o.getRaw(`/api/admin/security/events/export?${t}`)).blob(),a=URL.createObjectURL(c),u=document.createElement("a");u.href=a,u.download=`security-events-${Date.now()}.csv`,u.click(),URL.revokeObjectURL(a),l?.showNotification("CSV \uB0B4\uBCF4\uB0B4\uAE30 \uC644\uB8CC","success")}catch{l?.showNotification("CSV \uB0B4\uBCF4\uB0B4\uAE30 \uC2E4\uD328","error")}}async function S(){if(confirm("90\uC77C \uC774\uC0C1 \uB41C \uBCF4\uC548 \uC774\uBCA4\uD2B8\uB97C \uBAA8\uB450 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?"))try{let t=Date.now()-7776e6,e=await o.post("/api/admin/security/events/clear",{before:t});l?.showNotification(`${e?.deleted||0}\uAC1C \uC774\uBCA4\uD2B8 \uC0AD\uC81C\uB428`,"success"),d(),p()}catch{l?.showNotification("\uC774\uBCA4\uD2B8 \uC0AD\uC81C \uC2E4\uD328","error")}}async function m(t){if(confirm(`${t} IP\uB97C 24\uC2DC\uAC04 \uCC28\uB2E8\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`))try{await o.post("/api/admin/security/block-ip",{ip:t}),l?.showNotification(`${t} \uCC28\uB2E8 \uC644\uB8CC`,"success"),b()}catch{l?.showNotification("IP \uCC28\uB2E8 \uC2E4\uD328","error")}}function y(t,e){let c;return function(...a){clearTimeout(c),c=setTimeout(()=>t.apply(this,a),e)}}async function M(t){l=t,document.getElementById("security-refresh-btn")?.addEventListener("click",()=>v(t)),document.getElementById("security-export-btn")?.addEventListener("click",P),document.getElementById("security-clear-btn")?.addEventListener("click",S),document.getElementById("security-block-ip-btn")?.addEventListener("click",()=>{let r=document.getElementById("security-block-ip"),n=r?.value?.trim();n&&(m(n),r&&(r.value=""))});let e=document.getElementById("security-category-filter"),c=document.getElementById("security-severity-filter"),a=document.getElementById("security-search"),u=document.getElementById("security-ip-filter");e?.addEventListener("change",()=>{s.category=e.value,s.page=1,d()}),c?.addEventListener("change",()=>{s.severity=c.value,s.page=1,d()}),a?.addEventListener("input",y(()=>{s.search=a.value,s.page=1,d()},400)),u?.addEventListener("input",y(()=>{s.ip=u.value.trim(),s.page=1,d()},400)),document.getElementById("security-events-body")?.addEventListener("click",r=>{let n=r.target.closest(".event-row");if(!n)return;let g=document.getElementById(`detail-${n.dataset.id}`);g&&g.classList.toggle("hidden")}),document.getElementById("risk-ips-body")?.addEventListener("click",r=>{let n=r.target.closest("[data-block-ip]");n&&m(n.dataset.blockIp)}),document.getElementById("security-pagination")?.addEventListener("click",r=>{let n=r.target.closest(".page-btn");n&&(s.page=parseInt(n.dataset.page),d(),document.getElementById("security-events-table")?.scrollIntoView({behavior:"smooth"}))}),await v(t)}async function v(t){t.updateLastUpdated(),await Promise.allSettled([d(),p(),b(),L()])}export{M as init,v as refresh};
