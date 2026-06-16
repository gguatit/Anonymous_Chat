import{a as c}from"./chunks/chunk-QGR4GHRQ.js";var e={events:[],total:0,page:1,limit:50,category:"",severity:"",search:"",ip:"",stats:null,riskIPs:[],badge:{critical:0,high:0,medium:0}},o=null;function p(t){return t?new Date(t).toLocaleString("ko-KR"):"-"}function h(t){return{low:"sev-low",medium:"sev-medium",high:"sev-high",critical:"sev-critical"}[t]||"sev-low"}function f(t){return{auth:"\uC778\uC99D",endpoint:"\uC5D4\uB4DC\uD3EC\uC778\uD2B8",input:"\uC785\uB825\uAC12",websocket:"\uC6F9\uC18C\uCF13",system:"\uC2DC\uC2A4\uD15C"}[t]||t}function b(){let t=document.getElementById("security-events-body");if(t){if(e.events.length===0){t.innerHTML='<tr><td colspan="7" style="padding:2rem;text-align:center;color:#94a3b8">\uC774\uBCA4\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';return}t.innerHTML=e.events.map(s=>`
        <tr class="event-row" data-id="${s.id}">
            <td>${s.id}</td>
            <td><span class="badge-cat">${f(s.category)}</span></td>
            <td><span class="${h(s.severity)}">${s.severity}</span></td>
            <td class="mono">${s.ip||"-"}</td>
            <td class="mono truncate">${s.path||"-"}</td>
            <td>${(s.details||"").substring(0,80)}</td>
            <td class="mono">${p(s.timestamp)}</td>
        </tr>
        <tr id="detail-${s.id}" class="event-detail hidden">
            <td colspan="7">
                <div class="detail-grid">
                    <div><strong>Event Type:</strong> ${s.event_type}</div>
                    <div><strong>Method:</strong> ${s.method||"-"}</div>
                    <div><strong>User Agent:</strong> ${(s.user_agent||"").substring(0,100)}</div>
                    <div><strong>Country:</strong> ${s.country||"-"}</div>
                    <div><strong>Session:</strong> ${s.session_id||"-"}</div>
                    <div><strong>Score:</strong> ${s.severity_score||0}</div>
                </div>
            </td>
        </tr>
    `).join("")}}function w(){let t=document.getElementById("security-pagination");if(!t)return;let s=Math.ceil(e.total/e.limit);if(s<=1){t.innerHTML="";return}let a="";for(let i=1;i<=s;i++)a+=`<button class="page-btn ${i===e.page?"active":""}" data-page="${i}">${i}</button>`;t.innerHTML=a}function $(){let t=document.getElementById("security-stats");if(!t||!e.stats)return;let s=e.stats;t.innerHTML=`
        <div class="sec-stat">
            <div class="sec-stat-val">${s.last24h}</div>
            <div class="sec-stat-label">24h \uC774\uBCA4\uD2B8</div>
        </div>
        <div class="sec-stat sec-stat-critical">
            <div class="sec-stat-val">${e.badge.critical}</div>
            <div class="sec-stat-label">Critical</div>
        </div>
        <div class="sec-stat sec-stat-high">
            <div class="sec-stat-val">${e.badge.high}</div>
            <div class="sec-stat-label">High</div>
        </div>
        <div class="sec-stat sec-stat-medium">
            <div class="sec-stat-val">${e.badge.medium}</div>
            <div class="sec-stat-label">Medium</div>
        </div>
    `}function E(){let t=document.getElementById("risk-ips-body");if(t){if(e.riskIPs.length===0){t.innerHTML='<tr><td colspan="4" style="padding:1rem;text-align:center;color:#94a3b8">\uC704\uD5D8 IP\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';return}t.innerHTML=e.riskIPs.map(s=>`
        <tr>
            <td class="mono">${s.ip}</td>
            <td>${Math.round(s.score)}</td>
            <td>${s.eventCount}</td>
            <td><button class="btn-sm btn-red" data-block-ip="${s.ip}">\uCC28\uB2E8</button></td>
        </tr>
    `).join("")}}async function r(){try{let t=new URLSearchParams({page:e.page,limit:e.limit});e.category&&t.set("category",e.category),e.severity&&t.set("severity",e.severity),e.search&&t.set("search",e.search),e.ip&&t.set("ip",e.ip);let a=await(await c.get(`/api/admin/security/events?${t}`)).json();e.events=a.events||[],e.total=a.total||0,e.page=a.page||1,b(),w()}catch{}}async function v(){try{let t=await c.get("/api/admin/security/stats");e.stats=await t.json(),$()}catch{}}async function m(){try{let s=await(await c.get("/api/admin/security/risk-ips")).json();e.riskIPs=s.riskIPs||[],E()}catch{}}async function I(){try{let t=await c.get("/api/admin/security/badge");e.badge=await t.json(),L()}catch{}}function L(){document.querySelectorAll('[data-badge="security"]').forEach(t=>{let s=e.badge.critical+e.badge.high+e.badge.medium;s>0?(t.style.display="inline-flex",t.textContent=s,t.style.background=e.badge.critical>0?"#dc2626":e.badge.high>0?"#ea580c":"#d97706"):t.style.display="none"})}async function k(){try{let t=new URLSearchParams;e.category&&t.set("category",e.category);let a=await(await c.get(`/api/admin/security/events/export?${t}`)).blob(),i=URL.createObjectURL(a),d=document.createElement("a");d.href=i,d.download=`security-events-${Date.now()}.csv`,d.click(),URL.revokeObjectURL(i),o?.showNotification("CSV \uB0B4\uBCF4\uB0B4\uAE30 \uC644\uB8CC","success")}catch{o?.showNotification("CSV \uB0B4\uBCF4\uB0B4\uAE30 \uC2E4\uD328","error")}}async function B(){if(confirm("90\uC77C \uC774\uC0C1 \uB41C \uBCF4\uC548 \uC774\uBCA4\uD2B8\uB97C \uBAA8\uB450 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?"))try{let s=await(await c.post("/api/admin/security/events/clear")).json();o?.showNotification(`${s.deleted||0}\uAC1C \uC774\uBCA4\uD2B8 \uC0AD\uC81C\uB428`,"success"),r(),v()}catch{o?.showNotification("\uC774\uBCA4\uD2B8 \uC0AD\uC81C \uC2E4\uD328","error")}}async function P(t){if(confirm(`${t} IP\uB97C 24\uC2DC\uAC04 \uCC28\uB2E8\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`))try{await c.post("/api/admin/security/block-ip",{ip:t}),o?.showNotification(`${t} \uCC28\uB2E8 \uC644\uB8CC`,"success"),m()}catch{o?.showNotification("IP \uCC28\uB2E8 \uC2E4\uD328","error")}}function g(t,s){let a;return function(...i){clearTimeout(a),a=setTimeout(()=>t.apply(this,i),s)}}async function _(t){o=t,document.getElementById("security-refresh-btn")?.addEventListener("click",()=>y(t)),document.getElementById("security-export-btn")?.addEventListener("click",k),document.getElementById("security-clear-btn")?.addEventListener("click",B);let s=document.getElementById("security-category-filter"),a=document.getElementById("security-severity-filter"),i=document.getElementById("security-search"),d=document.getElementById("security-ip-filter");s?.addEventListener("change",()=>{e.category=s.value,e.page=1,r()}),a?.addEventListener("change",()=>{e.severity=a.value,e.page=1,r()}),i?.addEventListener("input",g(()=>{e.search=i.value,e.page=1,r()},400)),d?.addEventListener("input",g(()=>{e.ip=d.value.trim(),e.page=1,r()},400)),document.getElementById("security-events-body")?.addEventListener("click",l=>{let n=l.target.closest(".event-row");if(!n)return;let u=document.getElementById(`detail-${n.dataset.id}`);u&&u.classList.toggle("hidden")}),document.getElementById("risk-ips-body")?.addEventListener("click",l=>{let n=l.target.closest("[data-block-ip]");n&&P(n.dataset.blockIp)}),document.getElementById("security-pagination")?.addEventListener("click",l=>{let n=l.target.closest(".page-btn");n&&(e.page=parseInt(n.dataset.page),r(),document.getElementById("security-events-table")?.scrollIntoView({behavior:"smooth"}))}),await y(t)}async function y(t){t.updateLastUpdated(),await Promise.allSettled([r(),v(),m(),I()])}export{_ as init,y as refresh};
