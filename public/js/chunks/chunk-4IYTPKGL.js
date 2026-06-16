import{a as d}from"./chunk-DUIM5U7S.js";var f='a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';function g(t){if(!t)return function(){};let s=Array.from(t.querySelectorAll(f));if(s.length===0)return function(){};let e=s[0],a=s[s.length-1];e.focus();function r(i){i.key==="Tab"&&(i.shiftKey&&document.activeElement===e?(i.preventDefault(),a.focus()):!i.shiftKey&&document.activeElement===a&&(i.preventDefault(),e.focus()))}return t.addEventListener("keydown",r),function(){t.removeEventListener("keydown",r)}}var h={updateMetrics(t){if(this.lastMetrics=t,document.getElementById("stat-active-connections").textContent=t.activeConnections?.toLocaleString()||"0",document.getElementById("stat-total-messages").textContent=t.totalMessages?.toLocaleString()||"0",document.getElementById("stat-total-connections").textContent=t.totalConnections?.toLocaleString()||"0",document.getElementById("stat-errors").textContent=t.errors?.toLocaleString()||"0",document.getElementById("server-time").textContent=new Date().toLocaleString("ko-KR"),t.uptime){let s=Math.floor(t.uptime/36e5),e=Math.floor(t.uptime%36e5/6e4);document.getElementById("uptime").textContent=`${s}\uC2DC\uAC04 ${e}\uBD84`}t.errorLogs&&this.renderErrorLogs(t.errorLogs)},renderErrorLogs(t){let s=document.getElementById("error-logs-list");if(!s)return;this._errorLogs=t||[];let e=document.getElementById("error-log-filter"),a=document.getElementById("error-log-search"),r=e?.value||"all",i=(a?.value||"").toLowerCase(),o=this._errorLogs;if(r!=="all"&&(o=o.filter(n=>n.type===r)),i&&(o=o.filter(n=>n.message&&n.message.toLowerCase().includes(i)||n.location&&n.location.toLowerCase().includes(i)||n.type&&n.type.toLowerCase().includes(i))),!o||o.length===0){s.innerHTML='<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">\uCD5C\uADFC \uBC1C\uC0DD\uD55C \uC624\uB958\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';return}let m=Array.from(s.querySelectorAll('tr[id^="error-detail-"]:not(.hidden)')).map(n=>n.getAttribute("data-log-id"));s.innerHTML=o.map((n,u)=>{let c=new Date(n.timestamp),l="bg-gray-700 text-gray-300";n.type==="WS_MESSAGE_PARSE"?l="bg-yellow-900/50 text-yellow-500 border border-yellow-700":n.type==="CLIENT_ERROR"?l="bg-orange-900/50 text-orange-500 border border-orange-700":n.type==="WS_CONNECTION"?l="bg-purple-900/50 text-purple-500 border border-purple-700":n.type==="SYSTEM_ERROR"&&(l="bg-red-900/50 text-red-500 border border-red-700");let x=`log-${n.timestamp}-${n.type}`,p=`error-detail-${u}`,y=m.includes(x);return`
            <tr class="hover:bg-gray-700/30 transition-colors">
                <td class="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap text-xs text-gray-400">
                    ${c.toLocaleDateString()}<br>${c.toLocaleTimeString()}
                </td>
                <td class="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap">
                    <span class="px-2 py-1 rounded text-[10px] font-bold ${l}">${n.type}</span>
                </td>
                <td class="px-2 py-2 md:px-4 md:py-3 text-xs" style="max-width: 0;">
                    <div class="font-mono text-red-400 truncate w-full" title="${this.escapeHtml(n.message)}">${this.escapeHtml(n.message)}</div>
                    <div class="text-gray-500 text-[10px] mt-1 truncate w-full" title="${this.escapeHtml(n.location)}">${this.escapeHtml(n.location)}</div>
                </td>
                <td class="px-2 py-2 md:px-4 md:py-3 text-right">
                    <button onclick="document.getElementById('${p}').classList.toggle('hidden')" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 transition-colors">
                        \uC790\uC138\uD788
                    </button>
                </td>
            </tr>
            <tr id="${p}" data-log-id="${x}" class="${y?"":"hidden"} bg-gray-900/50 border-t border-gray-800">
                <td colspan="4" class="px-4 py-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                        <div class="min-w-0 flex flex-col">
                            <h4 class="text-xs font-bold text-gray-400 mb-2 border-b border-gray-700 pb-1 shrink-0">\uD658\uACBD \uC815\uBCF4</h4>
                            <div class="overflow-y-auto max-h-48 pr-1 min-h-[4rem]">
                                <ul class="text-[11px] text-gray-300 space-y-1 font-mono break-all">
                                    <li><strong class="text-gray-400">IP / \uC9C0\uC5ED:</strong> ${this.escapeHtml(n.environment?.ip||"N/A")} (${this.escapeHtml(n.environment?.country||"Unknown")})</li>
                                    <li><strong class="text-gray-400">User-Agent:</strong> <span>${this.escapeHtml(n.environment?.userAgent||"N/A")}</span></li>
                                    <li><strong class="text-gray-400">Context:</strong> ${this.escapeHtml(n.context||"N/A")}</li>
                                    ${n.environment?.url?`<li><strong class="text-gray-400">URL:</strong> <a href="${this.escapeHtml(n.environment.url)}" target="_blank" class="text-cyan-400 hover:underline">${this.escapeHtml(n.environment.url)}</a></li>`:""}
                                </ul>
                            </div>
                        </div>
                        <div class="min-w-0 flex flex-col">
                            <h4 class="text-xs font-bold text-gray-400 mb-2 border-b border-gray-700 pb-1 shrink-0">Stack Trace</h4>
                            <div class="bg-black p-2 rounded flex-1 min-h-[8rem] max-h-48 overflow-y-auto overflow-x-hidden text-[10px] font-mono text-gray-400 whitespace-pre-wrap break-all">${this.escapeHtml(n.stackTrace)}</div>
                        </div>
                    </div>
                </td>
            </tr>
            `}).join("")},updateActiveSessions(t){let s=document.getElementById("active-sessions");if(!t||t.length===0){s.innerHTML='<p class="text-sm text-gray-500 text-center py-8">\uD65C\uC131 \uC138\uC158\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';return}s.innerHTML=t.map(e=>{let a=e.isOnline,r=a?"bg-green-500":"bg-gray-500",i=e.lastMessageTime>0?this.formatDuration(Date.now()-e.lastMessageTime)+" \uC804 \uD65C\uB3D9":e.lastActivityTime?this.formatDuration(Date.now()-e.lastActivityTime)+" \uC804 \uD65C\uB3D9":"\uD65C\uB3D9 \uC5C6\uC74C",o=e.userAgent?e.userAgent.substring(0,40)+(e.userAgent.length>40?"...":""):"";return`
                <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer session-row" data-session-id="${e.sessionId}">
                    <div class="flex items-center gap-3 flex-1">
                        <div class="w-2 h-2 ${r} rounded-full ${a?"animate-pulse":""}"></div>
                        <div class="flex-1">
                            <p class="text-sm font-mono text-gray-300 break-all">
                                ${this.truncateId(e.sessionId)}
                                ${e.nickname?`<span class="text-xs ml-2 text-yellow-300">(${this.escapeHtml(e.nickname)})</span>`:""}
                            </p>
                            <p class="text-xs text-gray-500 break-all">${e.ip||"Unknown IP"}${e.country?` \xB7 ${this.escapeHtml(e.country)}`:""}</p>
                            <p class="text-xs text-gray-400">${i}</p>
                            ${o?`<p class="text-xs text-gray-500 truncate">${this.escapeHtml(o)}</p>`:""}
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-right">
                            <p class="text-xs text-gray-400">${e.messageCount||0} \uBA54\uC2DC\uC9C0</p>
                            <p class="text-xs text-gray-500">\uC811\uC18D: ${this.formatDuration(Date.now()-e.joinTime)}</p>
                        </div>
                        <button class="kick-user-btn bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded" 
                                data-session-id="${e.sessionId}"
                                data-user-ip="${e.ip||"Unknown"}"
                                title="\uC0AC\uC6A9\uC790 \uAC15\uC81C\uD1F4\uC7A5"
                                onclick="event.stopPropagation()">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 inline" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                            </svg>
                            \uD1F4\uC7A5
                        </button>
                    </div>
                </div>
            `}).join(""),document.querySelectorAll(".session-row").forEach(e=>{e.addEventListener("click",async a=>{let r=a.currentTarget.dataset.sessionId;await this.showUserDetails(r)})}),document.querySelectorAll(".kick-user-btn").forEach(e=>{e.addEventListener("click",async a=>{let r=a.currentTarget.dataset.sessionId,i=a.currentTarget.dataset.userIp,o=this.createBanModal(r,i);document.body.appendChild(o),g(o)})})},updateRecentMessages(t){let s=document.getElementById("recent-messages");if(!t||t.length===0){s.innerHTML='<p class="text-sm text-gray-500 text-center py-8">\uCD5C\uADFC \uBA54\uC2DC\uC9C0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';return}s.innerHTML=t.slice(-50).reverse().map(e=>{let a=e.file?(()=>{let u=this.escapeHtml(e.file.filename||"\uD30C\uC77C"),c=e.file.filesize!=null?this.formatFileSize(e.file.filesize):"",l=e.file.filetype||"",x=e.file.url||"#";if(!this.isValidUrl(x))return'<div class="text-red-400 text-xs mt-2">Invalid file URL</div>';let p=this.sanitizeUrl(x);return l.startsWith("image/")?`
                        <div class="mt-2">
                            <a href="${p}" target="_blank" rel="noopener noreferrer">
                                <img src="${p}" alt="${u}" class="w-full max-h-48 object-contain rounded border border-gray-600" />
                            </a>
                            <div class="mt-1 text-xs text-gray-400">${u} ${c?"\xB7 "+c:""}</div>
                        </div>
                    `:`
                    <div class="mt-2 text-xs text-gray-300">
                        <a href="${p}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${u}</a>
                        ${c?`<span class="text-gray-400"> \xB7 ${c}</span>`:""}
                        ${l?`<span class="text-gray-400"> \xB7 ${this.escapeHtml(l)}</span>`:""}
                    </div>
                `})():"",r=e.sessionId&&String(e.sessionId).startsWith("admin_"),i=r?`
                <span class="inline-block text-xs font-semibold text-yellow-300 bg-yellow-900/20 px-2 py-0.5 rounded">\uAD00\uB9AC\uC790</span>
            `:"",n=`
                <div class="mt-2 flex gap-2">
                    ${r?`
                        <button class="admin-edit-msg-btn text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded" data-message-id="${e.messageId}" data-content="${this.escapeHtml(e.content||"")}">
                            \uC218\uC815
                        </button>
                    `:""}
                    ${!0?`
                        <button class="admin-delete-msg-btn text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded" data-message-id="${e.messageId}">
                            \uC0AD\uC81C
                        </button>
                    `:""}
                </div>
            `;return`
                <div class="p-3 ${r?"bg-yellow-900/5 border border-yellow-800":"bg-gray-700"} rounded-lg" data-message-id="${e.messageId}">
                    <div class="flex items-start justify-between mb-1">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-mono text-gray-400">${this.truncateId(e.sessionId)}</span>
                            ${i}
                        </div>
                        <span class="text-xs text-gray-500">${new Date(e.timestamp).toLocaleTimeString("ko-KR")}</span>
                    </div>
                    <p class="message-content text-sm text-gray-200 break-words whitespace-pre-wrap">${this.escapeHtml(e.content||"")}</p>
                    ${e.editedAt?'<span class="text-xs text-yellow-500">(\uC218\uC815\uB428)</span>':""}
                    ${a}
                    ${n}
                </div>
            `}).join(""),this.attachMessageEventListeners()},attachMessageEventListeners(){document.querySelectorAll(".admin-edit-msg-btn").forEach(t=>{t.addEventListener("click",async s=>{let e=s.target.dataset.messageId,a=s.target.dataset.content,r=prompt("\uBA54\uC2DC\uC9C0\uB97C \uC218\uC815\uD558\uC138\uC694:",a);r!==null&&r.trim()!==a.trim()&&await this.editAdminMessage(e,r.trim())})}),document.querySelectorAll(".admin-delete-msg-btn").forEach(t=>{t.addEventListener("click",async s=>{let e=s.target.dataset.messageId;confirm(`\uC774 \uBA54\uC2DC\uC9C0\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?

\uC0AD\uC81C\uB41C \uBA54\uC2DC\uC9C0\uB294 \uBCF5\uAD6C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.
\uCCA8\uBD80\uB41C \uD30C\uC77C\uB3C4 \uD568\uAED8 \uC0AD\uC81C\uB429\uB2C8\uB2E4.`)&&await this.deleteMessage(e)})})},updateAnnouncementsList(t){let s=document.getElementById("announcement-list");if(s){if(!t||t.length===0){s.innerHTML='<p class="text-sm text-gray-500 text-center py-8">\uB4F1\uB85D\uB41C \uACF5\uC9C0\uC0AC\uD56D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';return}s.innerHTML=t.map(e=>{let a=new Date(e.timestamp).toLocaleString("ko-KR"),o=this.escapeHtml(e.content).replace(/(https?:\/\/[^\s<>"']+)/g,'<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline break-all">$1</a>').replace(/\n/g,"<br>"),m=e.isEmergency?'<span class="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded-full font-medium ml-1">\uAE34\uAE09</span>':"";return`
                <div class="bg-gray-700 rounded p-3 flex justify-between items-start gap-4 ${e.isEmergency?"border border-red-700/50":""}">
                    <div class="flex-1">
                        <div class="text-xs text-gray-400 mb-1">${a}${m}</div>
                        <div class="text-sm text-gray-200">${o}</div>
                    </div>
                    <div class="flex flex-col gap-2">
                        <button onclick="window.adminDashboard.editAnnouncement(${e.timestamp})" class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap">\uC218\uC815</button>
                        ${e.isEmergency?'<button onclick="window.adminDashboard.demoteAnnouncement('+e.timestamp+')" class="bg-yellow-600 hover:bg-yellow-700 text-white text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap">\uC77C\uBC18 \uC804\uD658</button>':""}
                        <button onclick="window.adminDashboard.deleteAnnouncement(${e.timestamp})" class="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap">\uC0AD\uC81C</button>
                    </div>
                </div>
            `}).join("")}},renderChannels(t){let s=document.getElementById("channels-list");if(s){if(!t.length){s.innerHTML='<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">\uD65C\uC131 \uCC44\uB110\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';return}s.innerHTML=t.map(e=>{let a=new Date(e.createdAt).toLocaleString("ko-KR");return`
                <tr class="hover:bg-gray-700/50 transition-colors">
                    <td class="px-2 py-2 md:px-4 md:py-3 font-medium text-emerald-300">${d(e.name)}</td>
                    <td class="px-2 py-2 md:px-4 md:py-3 text-xs text-gray-400">${d(e.createdBy||"-")}</td>
                    <td class="px-2 py-2 md:px-4 md:py-3 text-xs text-gray-400">${a}</td>
                    <td class="px-2 py-2 md:px-4 md:py-3"><span class="channel-users" data-slug="${d(e.slug)}">-</span></td>
                    <td class="px-2 py-2 md:px-4 md:py-3"><span class="channel-messages" data-slug="${d(e.slug)}">-</span></td>
                    <td class="px-2 py-2 md:px-4 md:py-3 text-right">
                        <button class="view-channel-btn text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded mr-1" data-slug="${d(e.slug)}" data-name="${d(e.name)}">\uC0C1\uC138</button>
                        <button class="delete-channel-btn text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded" data-slug="${d(e.slug)}" data-name="${d(e.name)}">\uC0AD\uC81C</button>
                    </td>
                </tr>
            `}).join(""),s.querySelectorAll(".view-channel-btn").forEach(e=>{e.addEventListener("click",()=>this.viewChannelDetail(e.dataset.slug,e.dataset.name))}),s.querySelectorAll(".delete-channel-btn").forEach(e=>{e.addEventListener("click",()=>this.deleteChannel(e.dataset.slug,e.dataset.name))}),t.forEach(e=>this.loadChannelStats(e.slug))}}},$=h;export{$ as a};
