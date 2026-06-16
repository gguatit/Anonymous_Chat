import{a as c}from"./chunk-DUIM5U7S.js";var a=c,d=()=>Date.now();function p(e){return e&&e.length>20?e.substring(0,20)+"...":e||"Unknown"}function i(e){let n=Math.floor(e/1e3),t=Math.floor(n/60),s=Math.floor(t/60);return s>0?`${s}\uC2DC\uAC04 \uC804`:t>0?`${t}\uBD84 \uC804`:`${n}\uCD08 \uC804`}function u(e){let n=(s,r)=>{let o=document.getElementById(s);o&&(o.textContent=(r??0).toLocaleString())};n("stat-active-connections",e.activeConnections),n("stat-total-messages",e.totalMessages),n("stat-total-connections",e.totalConnections),n("stat-errors",e.errors);let t=document.getElementById("server-time");if(t&&(t.textContent=new Date().toLocaleString("ko-KR")),e.uptime){let s=document.getElementById("uptime");s&&(s.textContent=`${Math.floor(e.uptime/36e5)}\uC2DC\uAC04 ${Math.floor(e.uptime%36e5/6e4)}\uBD84`)}}function y(e){let n=document.getElementById("error-logs-list");if(!n)return;if(!e||e.length===0){n.innerHTML='<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">\uCD5C\uADFC \uBC1C\uC0DD\uD55C \uC624\uB958\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';return}let t=document.getElementById("error-log-filter")?.value||"all",s=(document.getElementById("error-log-search")?.value||"").toLowerCase(),r=e;if(t!=="all"&&(r=r.filter(o=>o.type===t)),s&&(r=r.filter(o=>(o.message||"").toLowerCase().includes(s)||(o.location||"").toLowerCase().includes(s))),!r.length){n.innerHTML='<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';return}n.innerHTML=r.map(o=>{let l=new Date(o.timestamp),x={WS_MESSAGE_PARSE:"bg-yellow-900/50 text-yellow-500",CLIENT_ERROR:"bg-orange-900/50 text-orange-500",WS_CONNECTION:"bg-purple-900/50 text-purple-500",SYSTEM_ERROR:"bg-red-900/50 text-red-500"}[o.type]||"bg-gray-700 text-gray-300";return`<tr class="hover:bg-gray-700/30">
            <td class="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap text-xs text-gray-400">${l.toLocaleDateString()}<br>${l.toLocaleTimeString()}</td>
            <td class="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap"><span class="px-2 py-1 rounded text-[10px] font-bold ${x}">${a(o.type)}</span></td>
            <td class="px-2 py-2 md:px-4 md:py-3 text-xs" style="max-width:0"><div class="font-mono text-red-400 truncate w-full" title="${a(o.message)}">${a(o.message)}</div><div class="text-gray-500 text-[10px] mt-1">${a(o.location)}</div></td>
            <td class="px-2 py-2 md:px-4 md:py-3 text-right"><button class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300" onclick="this.nextElementSibling.classList.toggle('hidden')">\uC790\uC138\uD788</button><div class="hidden text-left text-[11px] text-gray-400 mt-1 font-mono whitespace-pre-wrap">${a(o.stackTrace||"N/A")}</div></td>
        </tr>`}).join("")}function f(e){let n=document.getElementById("admin-login-logs");if(n){if(!e||e.length===0){n.innerHTML='<p class="text-sm text-gray-500 text-center py-4">\uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';return}n.innerHTML=e.map(t=>`
        <div class="p-2 bg-gray-700 rounded text-sm">
            <span class="text-gray-300">${a(t.type==="login_success"?"\uB85C\uADF8\uC778":t.type==="logout"?"\uB85C\uADF8\uC544\uC6C3":t.type||"\uAE30\uB85D")}</span>
            ${t.admin?`<span class="text-blue-400 ml-2">${a(t.admin)}</span>`:""}
            <span class="text-gray-500 ml-2">${new Date(t.timestamp).toLocaleString("ko-KR")}</span>
            <span class="text-gray-600 ml-2">${a(t.ip||"-")}</span>
        </div>
    `).join("")}}function v(e){let n=document.getElementById("audit-logs-list");if(n){if(!e||e.length===0){n.innerHTML='<p class="text-sm text-gray-500 text-center py-8">\uAC10\uC0AC \uB85C\uADF8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';return}n.innerHTML=e.map(t=>`
        <div class="p-3 bg-gray-700 rounded flex justify-between items-start">
            <div>
                <span class="px-2 py-0.5 rounded text-xs font-bold bg-blue-900/50 text-blue-400">${a(t.type)}</span>
                <span class="text-xs text-gray-400 ml-2">${a(t.description||t.details||"")}</span>
            </div>
            <div class="text-xs text-gray-500 text-right">
                <div>${new Date(t.timestamp).toLocaleString("ko-KR")}</div>
                <div>${a(t.ip||t.admin_ip||"-")}</div>
            </div>
        </div>
    `).join("")}}function b(e){let n=Array.isArray(e)?e:e?.ips||[],t=document.getElementById("banned-ips-body");if(t){if(!n||n.length===0){t.innerHTML='<tr><td colspan="5" style="padding:1rem;text-align:center;color:#9ca3af">\uCC28\uB2E8\uB41C IP\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';return}t.innerHTML=n.map(s=>{let r=s.remainingSeconds>0?i(s.remainingSeconds*1e3):"-";return`<tr>
            <td class="mono text-sm">${a(s.ip)}</td>
            <td class="text-sm">${r}</td>
            <td class="text-sm hidden md:table-cell">${a(s.reason||"-")}</td>
            <td class="text-sm hidden md:table-cell">${s.bannedAt?new Date(s.bannedAt).toLocaleString("ko-KR"):"-"}</td>
            <td class="text-center"><button class="btn-sm btn-red" data-unban-ip="${a(s.ip)}">\uD574\uC81C</button></td>
        </tr>`}).join(""),t.querySelectorAll("[data-unban-ip]").forEach(s=>{s.addEventListener("click",()=>window._adminUnbanIP?.({ip:s.dataset.unbanIp}))})}}function w(e){let n=document.getElementById("banned-users-body");if(n){if(!e||e.length===0){n.innerHTML='<tr><td colspan="5" style="padding:1rem;text-align:center;color:#9ca3af">\uCC28\uB2E8\uB41C \uC138\uC158\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';return}n.innerHTML=e.map(t=>{let s=t.remainingSeconds>0?i(t.remainingSeconds*1e3):"-",r=t.sessionId||"";return`<tr>
            <td class="mono text-xs">${r.substring(0,20)}${r.length>20?"...":""}</td>
            <td class="mono text-xs">${a(t.ip||"-")}</td>
            <td class="text-sm">${s}</td>
            <td class="text-sm">${a(t.reason||"-")}</td>
            <td class="text-center"><button class="btn-sm btn-red" data-unban-session="${a(r)}">\uD574\uC81C</button></td>
        </tr>`}).join(""),n.querySelectorAll("[data-unban-session]").forEach(t=>{t.addEventListener("click",()=>window._adminUnbanIP?.({sessionId:t.dataset.unbanSession}))})}}function $(e){let n=document.getElementById("active-sessions");if(n){if(!e||e.length===0){n.innerHTML='<p class="text-sm text-gray-500 text-center py-8">\uD65C\uC131 \uC138\uC158\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';return}n.innerHTML=e.map(t=>{let s=t.isOnline,r=s?"bg-green-500":"bg-gray-500",o=t.lastMessageTime>0?i(d()-t.lastMessageTime)+" \uC804 \uD65C\uB3D9":t.lastActivityTime?i(d()-t.lastActivityTime)+" \uC804 \uD65C\uB3D9":"\uD65C\uB3D9 \uC5C6\uC74C";return`<div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer session-row" data-sid="${a(t.sessionId)}">
            <div class="flex items-center gap-3 flex-1">
                <div class="w-2 h-2 ${r} rounded-full ${s?"animate-pulse":""}"></div>
                <div class="flex-1">
                    <p class="text-sm font-mono text-gray-300 break-all">${p(t.sessionId)}${t.nickname?`<span class="text-xs ml-2 text-yellow-300">(${a(t.nickname)})</span>`:""}</p>
                    <p class="text-xs text-gray-500">${a(t.ip||"Unknown")}${t.country?" \xB7 "+a(t.country):""}</p>
                    <p class="text-xs text-gray-400">${o}</p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <div class="text-right"><p class="text-xs text-gray-400">${t.messageCount||0} \uBA54\uC2DC\uC9C0</p><p class="text-xs text-gray-500">\uC811\uC18D: ${i(d()-t.joinTime)}</p></div>
                <button class="kick-user-btn bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded" data-sid="${a(t.sessionId)}" data-ip="${a(t.ip||"")}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 inline" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg> \uD1F4\uC7A5
                </button>
            </div>
        </div>`}).join(""),n.querySelectorAll(".session-row").forEach(t=>{t.addEventListener("click",async()=>{let s=t.dataset.sid;window._showUserDetails&&window._showUserDetails(s)})}),n.querySelectorAll(".kick-user-btn").forEach(t=>{t.addEventListener("click",s=>{s.stopPropagation(),window._adminKickUser&&window._adminKickUser(t.dataset.sid,t.dataset.ip)})})}}function h(e){let n=document.getElementById("recent-messages");if(n){if(!e||e.length===0){n.innerHTML='<p class="text-sm text-gray-500 text-center py-8">\uCD5C\uADFC \uBA54\uC2DC\uC9C0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';return}n.innerHTML=e.reverse().map(t=>{let s=t.sessionId&&String(t.sessionId).startsWith("admin_"),r=s?'<span class="text-xs font-semibold text-yellow-300 bg-yellow-900/20 px-2 py-0.5 rounded">\uAD00\uB9AC\uC790</span>':"";return`<div class="p-3 ${s?"bg-yellow-900/5 border border-yellow-800":"bg-gray-700"} rounded-lg msg-row relative" data-msg-id="${a(t.messageId)}">
            <button class="absolute right-2 opacity-0 msg-delete-btn transition-opacity bg-red-600 hover:bg-red-500 text-white rounded p-1 leading-none" data-delete-msg="${a(t.messageId)}" title="\uBA54\uC2DC\uC9C0 \uC0AD\uC81C">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
            </button>
            <div class="flex items-start justify-between mb-1">
                <div class="flex items-center gap-2"><span class="text-xs font-mono text-gray-400">${p(t.sessionId)}</span>${r}</div>
                <span class="text-xs text-gray-500">${new Date(t.timestamp).toLocaleTimeString("ko-KR")}</span>
            </div>
            <p class="text-sm text-gray-200 break-words whitespace-pre-wrap">${a(t.content||"")}</p>
            ${t.editedAt?'<span class="text-xs text-yellow-500">(\uC218\uC815\uB428)</span>':""}
        </div>`}).join(""),n.querySelectorAll("[data-delete-msg]").forEach(t=>{t.addEventListener("click",s=>{s.stopPropagation();let r=t.dataset.deleteMsg,o=t.closest("[data-msg-id]");window._adminDeleteMessage&&window._adminDeleteMessage(r,o)})})}}function L(e){let n=document.getElementById("announcement-list");if(n){if(!e||e.length===0){n.innerHTML='<p class="text-sm text-gray-500 text-center py-8">\uB4F1\uB85D\uB41C \uACF5\uC9C0\uC0AC\uD56D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';return}n.innerHTML=e.map(t=>{let s=new Date(t.timestamp).toLocaleString("ko-KR"),r=t.isEmergency?'<span class="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded-full ml-1">\uAE34\uAE09</span>':"",o=a(t.content).replace(/\n/g,"<br>").replace(/(https?:\/\/[^\s<>"']+)/g,'<a href="$1" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300 underline break-all">$1</a>');return`<div class="bg-gray-700 rounded p-3 flex justify-between items-start gap-4 ${t.isEmergency?"border border-red-700/50":""}">
            <div class="flex-1"><div class="text-xs text-gray-400 mb-1">${s}${r}</div><div class="text-sm text-gray-200">${o}</div></div>
        </div>`}).join("")}}function E(e){let n=document.getElementById("channels-list");if(n){if(!e||e.length===0){n.innerHTML='<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">\uD65C\uC131 \uCC44\uB110\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';return}n.innerHTML=e.map(t=>{let s=new Date(t.createdAt).toLocaleString("ko-KR");return`<tr class="hover:bg-gray-700/50 transition-colors">
            <td class="px-2 py-2 md:px-4 md:py-3 font-medium text-emerald-300">${a(t.name)}</td>
            <td class="px-2 py-2 md:px-4 md:py-3 text-xs text-gray-400">${a(t.createdBy||"-")}</td>
            <td class="px-2 py-2 md:px-4 md:py-3 text-xs text-gray-400">${s}</td>
            <td class="px-2 py-2 md:px-4 md:py-3 text-sm">${t.connections??"-"}</td>
            <td class="px-2 py-2 md:px-4 md:py-3 text-sm">${t.messageCount??"-"}</td>
            <td class="px-2 py-2 md:px-4 md:py-3 text-right whitespace-nowrap" style="vertical-align:middle">
                <button class="view-channel-btn text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded mr-1" data-slug="${a(t.slug)}" data-name="${a(t.name)}">\uC0C1\uC138</button>
                <button class="delete-channel-btn text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded" data-slug="${a(t.slug)}" data-name="${a(t.name)}">\uC0AD\uC81C</button>
            </td>
        </tr>`}).join(""),n.querySelectorAll(".view-channel-btn").forEach(t=>{t.addEventListener("click",()=>window._viewChannelDetail&&window._viewChannelDetail(t.dataset.slug))}),n.querySelectorAll(".delete-channel-btn").forEach(t=>{t.addEventListener("click",()=>window._deleteChannel&&window._deleteChannel(t.dataset.slug,t.dataset.name))})}}function M(e){let n=document.getElementById("channel-detail-title"),t=document.getElementById("channel-detail-content"),s=document.getElementById("channel-detail-modal");!n||!t||!s||(n.textContent=e.name||"\uCC44\uB110 \uC0C1\uC138 \uC815\uBCF4",t.innerHTML=`
        <div class="grid grid-cols-2 gap-3 text-sm">
            <div><span class="text-gray-400">\uC2AC\uB7EC\uADF8:</span> <span class="font-mono">${a(e.slug)}</span></div>
            <div><span class="text-gray-400">\uC0DD\uC131\uC790:</span> ${a(e.createdBy||"-")}</div>
            <div><span class="text-gray-400">\uC0DD\uC131\uC77C:</span> ${new Date(e.createdAt).toLocaleString("ko-KR")}</div>
            <div><span class="text-gray-400">\uC811\uC18D\uC790:</span> ${e.connections??"-"}</div>
            <div><span class="text-gray-400">\uBA54\uC2DC\uC9C0:</span> ${e.messageCount??"-"}</div>
            <div><span class="text-gray-400">\uC0C1\uD0DC:</span> ${e.status||"active"}</div>
        </div>
    `,s.classList.add("open"))}function I(e){return!e||e.length===0?"No error logs":e.map(n=>`[${new Date(n.timestamp).toISOString()}] ${n.type}
  Message: ${n.message||"N/A"}
  Location: ${n.location||"N/A"}
  Context: ${n.context||"N/A"}
`).join(`
`)}export{u as a,y as b,f as c,v as d,b as e,w as f,$ as g,h,L as i,E as j,M as k,I as l};
