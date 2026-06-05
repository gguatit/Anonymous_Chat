// public/js/api-client.js
var ApiClient = {
  _token: null,
  setToken(token) {
    this._token = token;
  },
  getToken() {
    return this._token;
  },
  headers(extra = {}) {
    const h = { ...extra };
    if (this._token) {
      h["Authorization"] = `Bearer ${this._token}`;
    }
    return h;
  },
  async request(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: this.headers(options.headers || {})
    });
    return res;
  },
  async get(url) {
    const res = await this.request(url);
    if (!res.ok) {
      throw new Error(`GET ${url} failed: ${res.status}`);
    }
    return res.json();
  },
  async getRaw(url) {
    const res = await this.request(url);
    return res;
  },
  async post(url, body) {
    const res = await this.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : void 0
    });
    return res.json().catch(() => null);
  },
  async postRaw(url, body) {
    const res = await this.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : void 0
    });
    return res;
  },
  async put(url, body) {
    const res = await this.request(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : void 0
    });
    return res.json().catch(() => null);
  },
  async del(url, body) {
    const res = await this.request(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : void 0
    });
    return res.json().catch(() => null);
  }
};
var api_client_default = ApiClient;

// public/js/utils.js
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text || "");
  return div.innerHTML;
}
function isValidUrl(url) {
  try {
    const urlWithProtocol = url.match(/^https?:\/\//) ? url : "https://" + url;
    const parsed = new URL(urlWithProtocol);
    if (!url.match(/^https?:\/\//)) {
      const domain = parsed.hostname;
      if (!domain || !domain.includes(".") || domain.split(".").pop().length < 2) {
        return false;
      }
    }
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_e) {
    return false;
  }
}
function sanitizeUrl(url) {
  if (!isValidUrl(url)) return "#";
  const safeUrl = url.match(/^https?:\/\//) ? url : "https://" + url;
  return safeUrl.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2);
  return `${size} ${sizes[i]}`;
}

// public/js/admin-utils.js
var FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
function trapFocus(modalEl) {
  if (!modalEl) return function cleanup() {
  };
  const focusable = Array.from(modalEl.querySelectorAll(FOCUSABLE));
  if (focusable.length === 0) return function cleanup() {
  };
  const firstEl = focusable[0];
  const lastEl = focusable[focusable.length - 1];
  firstEl.focus();
  function handler(e) {
    if (e.key !== "Tab") return;
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  }
  modalEl.addEventListener("keydown", handler);
  return function cleanup() {
    modalEl.removeEventListener("keydown", handler);
  };
}
function showModal(modalEl, closeSelector, previousActiveEl) {
  if (!modalEl) return function cleanup2() {
    return function cleanup3() {
    };
  };
  modalEl.classList.remove("hidden");
  const cleanup = trapFocus(modalEl);
  const triggers = closeSelector ? modalEl.querySelectorAll(closeSelector) : [];
  function hideHandler() {
    modalEl.classList.add("hidden");
    cleanup();
    if (previousActiveEl && typeof previousActiveEl.focus === "function") {
      previousActiveEl.focus();
    }
    document.removeEventListener("keydown", escHandler);
    triggers.forEach((btn) => btn.removeEventListener("click", hideHandler));
  }
  function escHandler(e) {
    if (e.key === "Escape") hideHandler();
  }
  function clickHandler(e) {
    if (e.target === modalEl) hideHandler();
  }
  document.addEventListener("keydown", escHandler);
  modalEl.addEventListener("click", clickHandler);
  triggers.forEach((btn) => btn.addEventListener("click", hideHandler));
  return hideHandler;
}
function hideModal(modalEl) {
  if (!modalEl) return;
  const hidden = document.createEvent("Event");
  hidden.initEvent("modal:hide", true, true);
  modalEl.dispatchEvent(hidden);
  modalEl.classList.add("hidden");
}

// public/js/admin-data.js
var dataMethods = {
  async exportCsv() {
    if (!this.sessionToken) {
      alert("\uAD00\uB9AC\uC790 \uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      return;
    }
    try {
      const [sessionsResp, messagesResp] = await Promise.all([
        api_client_default.getRaw("/api/admin/sessions"),
        api_client_default.getRaw("/api/admin/messages")
      ]);
      if (!sessionsResp.ok || !messagesResp.ok) {
        alert("\uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uAD8C\uD55C\uC744 \uD655\uC778\uD558\uC138\uC694.");
        return;
      }
      const sessions = await sessionsResp.json();
      const messages = await messagesResp.json();
      const usersMap = /* @__PURE__ */ new Map();
      for (const s of sessions) {
        usersMap.set(s.sessionId, s);
      }
      const rows = [];
      const headers = [
        "user_session_id",
        "user_ip",
        "user_join_time",
        "user_message_count",
        "user_last_message_time",
        "message_id",
        "message_timestamp",
        "message_content",
        "message_edited_at",
        "file_url",
        "file_name",
        "file_size",
        "file_type"
      ];
      for (const msg of messages) {
        const user = usersMap.get(msg.sessionId) || {};
        rows.push([
          user.sessionId || msg.sessionId || "",
          user.ip || "",
          user.joinTime ? new Date(user.joinTime).toISOString() : "",
          user.messageCount != null ? user.messageCount : "",
          user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : "",
          msg.messageId || "",
          msg.timestamp ? new Date(msg.timestamp).toISOString() : "",
          msg.content || "",
          msg.editedAt ? new Date(msg.editedAt).toISOString() : "",
          msg.file?.url || "",
          msg.file?.filename || "",
          msg.file?.filesize != null ? String(msg.file.filesize) : "",
          msg.file?.filetype || ""
        ]);
      }
      for (const [sessionId, user] of usersMap.entries()) {
        const hasMessage = messages.some((m) => m.sessionId === sessionId);
        if (!hasMessage) {
          rows.push([
            user.sessionId || sessionId,
            user.ip || "",
            user.joinTime ? new Date(user.joinTime).toISOString() : "",
            user.messageCount != null ? user.messageCount : "",
            user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
          ]);
        }
      }
      const escape = (value) => {
        if (value == null) return "";
        const str = String(value);
        return '"' + str.replace(/"/g, '""') + '"';
      };
      const csvContent = [headers.map((h) => escape(h)).join(",")].concat(rows.map((r) => r.map((cell) => escape(cell)).join(","))).join("\n");
      const bom = "\uFEFF";
      const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `anonymous_chat_export_${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export CSV error:", error);
      alert("CSV \uB0B4\uBCF4\uB0B4\uAE30 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uCF58\uC194\uC744 \uD655\uC778\uD558\uC138\uC694.");
    }
  },
  async sendAdminBroadcast() {
    if (!this.sessionToken) {
      alert("\uAD00\uB9AC\uC790 \uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      return;
    }
    const raw = this.adminMessageInput?.value || "";
    const content = raw.trim();
    if (!content) {
      alert("\uBA54\uC2DC\uC9C0\uB97C \uC785\uB825\uD558\uC138\uC694.");
      return;
    }
    if (raw.length > 7500) {
      alert("\uBA54\uC2DC\uC9C0\uB294 \uCD5C\uB300 7500\uC790\uAE4C\uC9C0 \uAC00\uB2A5\uD569\uB2C8\uB2E4.");
      return;
    }
    try {
      const response = await api_client_default.postRaw("/api/admin/broadcast", { content: raw });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        console.error("Broadcast failed", err);
        alert("\uBA54\uC2DC\uC9C0 \uC804\uC1A1\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
        return;
      }
      if (this.adminMessageInput) this.adminMessageInput.value = "";
      this.refreshData();
    } catch (error) {
      console.error("sendAdminBroadcast error:", error);
      alert("\uBA54\uC2DC\uC9C0 \uC804\uC1A1 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    }
  },
  async sendAdminAnnounce() {
    if (!this.sessionToken) {
      alert("\uAD00\uB9AC\uC790 \uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      return;
    }
    const raw = this.adminAnnounceInput?.value || "";
    const content = raw.trim();
    if (!content) {
      alert("\uACF5\uC9C0 \uB0B4\uC6A9\uC744 \uC785\uB825\uD558\uC138\uC694.");
      return;
    }
    if (raw.length > 7500) {
      alert("\uACF5\uC9C0\uC0AC\uD56D\uC740 \uCD5C\uB300 7500\uC790\uAE4C\uC9C0 \uAC00\uB2A5\uD569\uB2C8\uB2E4.");
      return;
    }
    const isEmergency = this.emergencyCheckbox?.checked || false;
    if (isEmergency) {
      const confirmed = await new Promise((resolve) => {
        const modal = document.createElement("div");
        modal.className = "fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50";
        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 border border-red-500/30">
                <div class="flex items-center gap-2 mb-3">
                    <span class="text-2xl">\u{1F6A8}</span>
                    <h3 class="text-lg font-bold text-red-400">\uAE34\uAE09 \uACF5\uC9C0 \uD655\uC778</h3>
                </div>
                <p class="text-sm text-gray-300 mb-1">\uC815\uB9D0 <span class="text-red-400 font-semibold">\uAE34\uAE09 \uACF5\uC9C0</span>\uB85C \uBC1C\uC1A1\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?</p>
                <p class="text-xs text-gray-500 mb-4">\uAE34\uAE09 \uACF5\uC9C0\uB294 \uBAA8\uB4E0 \uC0AC\uC6A9\uC790\uB97C \uACF5\uC9C0 \uD398\uC774\uC9C0\uB85C \uAC15\uC81C \uC774\uB3D9\uC2DC\uD0B5\uB2C8\uB2E4.</p>
                <div class="text-xs text-gray-600 bg-gray-900 rounded p-2 mb-4 max-h-24 overflow-y-auto">${this.escapeHtml(content.substring(0, 200))}${content.length > 200 ? "..." : ""}</div>
                <div class="flex gap-3 justify-end">
                    <button class="cancel-btn bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm">\uCDE8\uC18C</button>
                    <button class="confirm-btn bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">\uAE34\uAE09 \uBC1C\uC1A1</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.querySelector(".cancel-btn").onclick = () => {
          modal.remove();
          resolve(false);
        };
        modal.querySelector(".confirm-btn").onclick = () => {
          modal.remove();
          resolve(true);
        };
        modal.addEventListener("click", (e) => {
          if (e.target === modal) {
            modal.remove();
            resolve(false);
          }
        });
      });
      if (!confirmed) return;
    }
    const body = { content: raw, isEmergency };
    if (isEmergency) {
      const duration = parseInt(this.emergencyDuration?.value || "0");
      if (duration > 0) {
        body.emergencyUntil = Date.now() + duration;
      }
    }
    const isScheduled = this.scheduleCheckbox?.checked || false;
    if (isScheduled && this.scheduleDatetime?.value) {
      body.scheduleAt = new Date(this.scheduleDatetime.value).getTime();
      if (body.scheduleAt <= Date.now()) {
        alert("\uC608\uC57D \uC2DC\uAC04\uC740 \uD604\uC7AC\uBCF4\uB2E4 \uC774\uD6C4\uC5EC\uC57C \uD569\uB2C8\uB2E4.");
        return;
      }
    }
    const expiryDuration = parseInt(this.announceExpirySelect?.value || "0");
    if (expiryDuration > 0) {
      body.expiresAt = Date.now() + expiryDuration;
    }
    try {
      const response = await fetch("/api/admin/announce", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.sessionToken}`
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        console.error("Announce failed", err);
        alert("\uACF5\uC9C0 \uC804\uC1A1\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
        return;
      }
      const result = await response.json();
      if (result.sessionsNotified !== void 0) {
        alert(`\uACF5\uC9C0\uAC00 ${result.sessionsNotified}\uBA85\uC758 \uC0AC\uC6A9\uC790\uC5D0\uAC8C \uC804\uC1A1\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`);
      } else {
        alert("\uACF5\uC9C0\uAC00 \uC804\uC1A1\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
      }
      if (this.adminAnnounceInput) this.adminAnnounceInput.value = "";
      if (this.emergencyCheckbox) this.emergencyCheckbox.checked = false;
      if (this.emergencyDuration) this.emergencyDuration.classList.add("hidden");
      this.refreshData();
    } catch (error) {
      console.error("sendAdminAnnounce error:", error);
      alert("\uACF5\uC9C0 \uC804\uC1A1 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    }
  },
  async deleteAllMessages() {
    if (!this.sessionToken) {
      alert("\uAD00\uB9AC\uC790 \uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      return;
    }
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
    modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
                <h3 class="text-xl font-bold text-red-400 mb-3">\u26A0\uFE0F \uBAA8\uB4E0 \uBA54\uC2DC\uC9C0 \uC0AD\uC81C</h3>
                <p class="text-sm text-gray-300 mb-4">\uC815\uB9D0\uB85C \uBAA8\uB4E0 \uBA54\uC2DC\uC9C0\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?</p>
                <div class="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
                    <p class="text-xs text-red-300 font-medium">\uC774 \uC791\uC5C5\uC740 \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.</p>
                    <p class="text-xs text-red-400 mt-1">\uC0AD\uC81C\uB41C \uBA54\uC2DC\uC9C0\uB294 \uBCF5\uAD6C\uD560 \uC218 \uC5C6\uC73C\uBA70, \uCCA8\uBD80\uB41C \uD30C\uC77C\uB3C4 \uD568\uAED8 \uC0AD\uC81C\uB429\uB2C8\uB2E4.</p>
                </div>
                <p class="text-sm text-gray-300 mb-2">\uACC4\uC18D\uD558\uB824\uBA74 \uC544\uB798 \uBB38\uAD6C\uB97C \uC785\uB825\uD558\uC138\uC694:</p>
                <div class="flex items-center gap-2 mb-4">
                    <code class="flex-1 bg-gray-900 text-gray-100 px-3 py-2 rounded text-sm font-mono select-all">DELETE_ALL_MESSAGES</code>
                    <button class="copy-confirm-text-btn bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded text-sm transition-colors" title="\uBCF5\uC0AC">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                    </button>
                </div>
                <input id="delete-all-confirm-input" type="text" placeholder="\uC704 \uBB38\uAD6C\uB97C \uC785\uB825\uD558\uC138\uC694" class="w-full bg-gray-900 text-gray-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-500 border border-gray-600 mb-4" autocomplete="off" maxlength="30">
                <div id="delete-all-confirm-error" class="hidden text-red-400 text-xs mb-3">\uBB38\uAD6C\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</div>
                <div class="flex gap-3">
                    <button id="delete-all-cancel-btn" class="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 rounded-lg transition-colors">\uCDE8\uC18C</button>
                    <button id="delete-all-confirm-btn" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>\uC0AD\uC81C</button>
                </div>
            </div>
        `;
    document.body.appendChild(modal);
    trapFocus(modal);
    const input = modal.querySelector("#delete-all-confirm-input");
    const confirmBtn = modal.querySelector("#delete-all-confirm-btn");
    const cancelBtn = modal.querySelector("#delete-all-cancel-btn");
    const errorEl = modal.querySelector("#delete-all-confirm-error");
    const copyBtn = modal.querySelector(".copy-confirm-text-btn");
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText("DELETE_ALL_MESSAGES");
        const original = copyBtn.innerHTML;
        copyBtn.innerHTML = '<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
        setTimeout(() => copyBtn.innerHTML = original, 1500);
      } catch (_e) {
        const ta = document.createElement("textarea");
        ta.value = "DELETE_ALL_MESSAGES";
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    });
    input.addEventListener("input", () => {
      const matched = input.value === "DELETE_ALL_MESSAGES";
      confirmBtn.disabled = !matched;
      errorEl.classList.add("hidden");
      if (matched) {
        input.classList.remove("focus:ring-red-500", "border-red-500");
        input.classList.add("focus:ring-green-500", "border-green-500");
      } else {
        input.classList.remove("focus:ring-green-500", "border-green-500");
        input.classList.add("focus:ring-red-500", "border-red-500");
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !confirmBtn.disabled) confirmBtn.click();
      if (e.key === "Escape") modal.remove();
    });
    const closeModal = () => modal.remove();
    cancelBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
    confirmBtn.addEventListener("click", async () => {
      if (input.value !== "DELETE_ALL_MESSAGES") {
        errorEl.classList.remove("hidden");
        return;
      }
      try {
        const response = await fetch("/api/admin/delete-all-messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.sessionToken}`
          },
          body: JSON.stringify({ confirmation: "DELETE_ALL_MESSAGES" })
        });
        if (!response.ok) {
          const err = await response.json().catch(() => null);
          console.error("Delete all messages failed", err);
          alert("\uBAA8\uB4E0 \uBA54\uC2DC\uC9C0 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uCF58\uC194\uC744 \uD655\uC778\uD558\uC138\uC694.");
          return;
        }
        const result = await response.json();
        modal.remove();
        alert(`\u2713 \uBAA8\uB4E0 \uBA54\uC2DC\uC9C0\uAC00 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4. (${result.deletedCount}\uAC1C)`);
        this.refreshData();
      } catch (error) {
        console.error("deleteAllMessages error:", error);
        modal.remove();
        alert("\uBAA8\uB4E0 \uBA54\uC2DC\uC9C0 \uC0AD\uC81C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
      }
    });
    setTimeout(() => input.focus(), 100);
  },
  async exportFilteredCsv() {
    if (!this.sessionToken) {
      alert("\uAD00\uB9AC\uC790 \uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      return;
    }
    const filterOptions = prompt(
      "\uB0B4\uBCF4\uB0B4\uAE30 \uC635\uC158\uC744 \uC120\uD0DD\uD558\uC138\uC694:\n1: \uC804\uCCB4 \uB370\uC774\uD130\n2: \uD65C\uC131 \uC138\uC158\uB9CC\n3: \uC624\uB298 \uBA54\uC2DC\uC9C0\uB9CC\n4: \uCD5C\uADFC 1\uC2DC\uAC04\n5: \uCD5C\uADFC 24\uC2DC\uAC04",
      "1"
    );
    if (!filterOptions) return;
    try {
      const [sessionsResp, messagesResp] = await Promise.all([
        api_client_default.getRaw("/api/admin/sessions"),
        api_client_default.getRaw("/api/admin/messages")
      ]);
      if (!sessionsResp.ok || !messagesResp.ok) {
        alert("\uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
        return;
      }
      let sessions = await sessionsResp.json();
      let messages = await messagesResp.json();
      const now = Date.now();
      const oneHour = 60 * 60 * 1e3;
      const oneDay = 24 * oneHour;
      const todayStart = (/* @__PURE__ */ new Date()).setHours(0, 0, 0, 0);
      switch (filterOptions) {
        case "2": {
          const activeSessions = new Set(sessions.map((s) => s.sessionId));
          messages = messages.filter((m) => activeSessions.has(m.sessionId));
          break;
        }
        case "3":
          messages = messages.filter((m) => m.timestamp >= todayStart);
          break;
        case "4":
          messages = messages.filter((m) => now - m.timestamp < oneHour);
          sessions = sessions.filter((s) => now - s.joinTime < oneHour);
          break;
        case "5":
          messages = messages.filter((m) => now - m.timestamp < oneDay);
          sessions = sessions.filter((s) => now - s.joinTime < oneDay);
          break;
        default:
          break;
      }
      const usersMap = /* @__PURE__ */ new Map();
      for (const s of sessions) {
        usersMap.set(s.sessionId, s);
      }
      const rows = [];
      const headers = [
        "user_session_id",
        "user_ip",
        "user_join_time",
        "user_message_count",
        "user_last_message_time",
        "message_id",
        "message_timestamp",
        "message_content",
        "message_edited_at",
        "file_url",
        "file_name",
        "file_size",
        "file_type"
      ];
      for (const msg of messages) {
        const user = usersMap.get(msg.sessionId) || {};
        rows.push([
          user.sessionId || msg.sessionId || "",
          user.ip || "",
          user.joinTime ? new Date(user.joinTime).toISOString() : "",
          user.messageCount != null ? user.messageCount : "",
          user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : "",
          msg.messageId || "",
          msg.timestamp ? new Date(msg.timestamp).toISOString() : "",
          msg.content || "",
          msg.editedAt ? new Date(msg.editedAt).toISOString() : "",
          msg.file?.url || "",
          msg.file?.filename || "",
          msg.file?.filesize != null ? String(msg.file.filesize) : "",
          msg.file?.filetype || ""
        ]);
      }
      for (const [sessionId, user] of usersMap.entries()) {
        const hasMessage = messages.some((m) => m.sessionId === sessionId);
        if (!hasMessage) {
          rows.push([
            user.sessionId || sessionId,
            user.ip || "",
            user.joinTime ? new Date(user.joinTime).toISOString() : "",
            user.messageCount != null ? user.messageCount : "",
            user.lastMessageTime ? new Date(user.lastMessageTime).toISOString() : "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
          ]);
        }
      }
      const escape = (value) => {
        if (value == null) return "";
        const str = String(value);
        return '"' + str.replace(/"/g, '""') + '"';
      };
      const csvContent = [headers.map((h) => escape(h)).join(",")].concat(rows.map((r) => r.map((cell) => escape(cell)).join(","))).join("\n");
      const bom = "\uFEFF";
      const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const filterName = ["all", "active", "today", "1hour", "24hours"][parseInt(filterOptions) - 1] || "filtered";
      const a = document.createElement("a");
      a.href = url;
      a.download = `anonymous_chat_${filterName}_${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export filtered CSV error:", error);
      alert("CSV \uB0B4\uBCF4\uB0B4\uAE30 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    }
  },
  async editAdminMessage(messageId, newContent) {
    if (!this.sessionToken) {
      alert("\uAD00\uB9AC\uC790 \uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      return;
    }
    if (!newContent) {
      alert("\uBA54\uC2DC\uC9C0 \uB0B4\uC6A9\uC774 \uBE44\uC5B4\uC788\uC2B5\uB2C8\uB2E4.");
      return;
    }
    try {
      const response = await fetch("/api/admin/edit-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.sessionToken}`
        },
        body: JSON.stringify({ messageId, newContent })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        console.error("Edit failed", err);
        alert("\uBA54\uC2DC\uC9C0 \uC218\uC815\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
        return;
      }
      this.refreshData();
    } catch (error) {
      console.error("editAdminMessage error:", error);
      alert("\uBA54\uC2DC\uC9C0 \uC218\uC815 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    }
  },
  async deleteMessage(messageId) {
    if (!this.sessionToken) {
      alert("\uAD00\uB9AC\uC790 \uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      return;
    }
    try {
      const response = await fetch("/api/admin/delete-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.sessionToken}`
        },
        body: JSON.stringify({ messageId })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        console.error("Delete failed", err);
        alert("\uBA54\uC2DC\uC9C0 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
        return;
      }
      await response.json();
      this.refreshData();
    } catch (error) {
      console.error("deleteMessage error:", error);
      alert("\uBA54\uC2DC\uC9C0 \uC0AD\uC81C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    }
  },
  async kickUser(sessionId, banDuration = 0) {
    if (!this.sessionToken) {
      alert("\uAD00\uB9AC\uC790 \uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      return;
    }
    try {
      const response = await fetch("/api/admin/kick-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.sessionToken}`
        },
        body: JSON.stringify({ sessionId, banDuration })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        console.error("Kick user failed", err);
        alert("\uC0AC\uC6A9\uC790 \uAC15\uC81C\uD1F4\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
        return;
      }
      const result = await response.json();
      if (result.banned) {
        const minutes = Math.floor(banDuration / 60);
        const seconds = banDuration % 60;
        const timeStr = minutes > 0 ? `${minutes}\uBD84 ${seconds}\uCD08` : `${seconds}\uCD08`;
        if (result.sharedIP) {
          alert(`\uC0AC\uC6A9\uC790\uAC00 \uAC15\uC81C\uD1F4\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.

\u26A0\uFE0F \uACF5\uC720 IP \uAC10\uC9C0: \uC138\uC158\uB9CC ${timeStr}\uAC04 \uCC28\uB2E8\uB428
(\uAC19\uC740 IP\uC758 \uB2E4\uB978 \uC0AC\uC6A9\uC790\uB294 \uC601\uD5A5 \uC5C6\uC74C)`);
        } else {
          alert(`\uC0AC\uC6A9\uC790\uAC00 \uAC15\uC81C\uD1F4\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.
IP ${result.ip}\uAC00 ${timeStr}\uAC04 \uCC28\uB2E8\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`);
        }
      } else {
        alert("\uC0AC\uC6A9\uC790\uAC00 \uAC15\uC81C\uD1F4\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
      }
      this.refreshData();
    } catch (error) {
      console.error("kickUser error:", error);
      alert("\uC0AC\uC6A9\uC790 \uAC15\uC81C\uD1F4\uC7A5 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    }
  },
  async loadBannedIPs() {
    try {
      const response = await fetch("/api/admin/banned-ips", {
        headers: { "Authorization": `Bearer ${this.sessionToken}` }
      });
      if (!response.ok) {
        throw new Error("Failed to load banned IPs");
      }
      const bannedList = await response.json();
      const tbody = document.getElementById("banned-ips-body");
      if (!tbody) return;
      if (!bannedList || bannedList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-3 md:px-4 py-8 text-center text-gray-500">\uCC28\uB2E8\uB41C IP\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';
        return;
      }
      tbody.innerHTML = bannedList.map((ban) => `
                <tr class="border-t border-gray-700 md:border-0">
                    <td data-label="IP \uC8FC\uC18C" class="px-3 md:px-4 py-3 font-mono text-sm break-all">${ban.ip}</td>
                    <td data-label="\uB0A8\uC740 \uC2DC\uAC04" class="px-3 md:px-4 py-3 text-sm">${this.formatDuration(ban.remainingSeconds * 1e3)}</td>
                    <td data-label="\uC0AC\uC720" class="px-3 md:px-4 py-3 text-sm hidden md:table-cell">${ban.reason || "No reason"}</td>
                    <td data-label="\uCC28\uB2E8 \uC2DC\uAC01" class="px-3 md:px-4 py-3 text-sm hidden md:table-cell">${new Date(ban.bannedAt).toLocaleString("ko-KR")}</td>
                    <td data-label="\uC791\uC5C5" class="px-3 md:px-4 py-3 text-center">
                        <button class="unban-ip-btn bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded" data-ip="${ban.ip}">
                            \uCC28\uB2E8 \uD574\uC81C
                        </button>
                    </td>
                </tr>
            `).join("");
      document.querySelectorAll(".unban-ip-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const ip = e.currentTarget.dataset.ip;
          await this.unbanIP(ip);
        });
      });
    } catch (error) {
      console.error("Load banned IPs error:", error);
    }
  },
  async unbanIP(ip) {
    if (!confirm(`IP ${ip}\uC758 \uCC28\uB2E8\uC744 \uD574\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`)) {
      return;
    }
    try {
      const response = await fetch("/api/admin/unban-ip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.sessionToken}`
        },
        body: JSON.stringify({ ip })
      });
      if (!response.ok) {
        throw new Error("Failed to unban IP");
      }
      alert(`IP ${ip}\uC758 \uCC28\uB2E8\uC774 \uD574\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`);
      await this.loadBannedIPs();
    } catch (error) {
      console.error("Unban IP error:", error);
      alert("IP \uCC28\uB2E8 \uD574\uC81C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    }
  },
  async showUserDetails(sessionId) {
    try {
      const response = await fetch(`/api/admin/user-details?sessionId=${encodeURIComponent(sessionId)}`, {
        headers: { "Authorization": `Bearer ${this.sessionToken}` }
      });
      if (!response.ok) {
        throw new Error("Failed to load user details");
      }
      const userDetails = await response.json();
      const modal = document.getElementById("user-details-modal");
      const content = document.getElementById("user-details-content");
      if (!modal || !content) return;
      content.innerHTML = `
                <div class="space-y-4">
                    <div class="bg-gray-700 rounded-lg p-4">
                        <h3 class="text-sm font-semibold text-gray-400 mb-2">\uAE30\uBCF8 \uC815\uBCF4</h3>
                        <div class="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p class="text-gray-500">\uC138\uC158 ID</p>
                                <p class="text-gray-200 font-mono break-all">${userDetails.sessionId || "N/A"}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">\uB2C9\uB124\uC784</p>
                                <p class="text-gray-200">${userDetails.metadata?.nickname ? this.escapeHtml(userDetails.metadata.nickname) : "\uC775\uBA85"}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">IP \uC8FC\uC18C</p>
                                <p class="text-gray-200 font-mono break-all">${userDetails.metadata?.ip || "N/A"}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">\uAD6D\uAC00</p>
                                <p class="text-gray-200">${userDetails.metadata?.environment?.country || "N/A"}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">User-Agent</p>
                                <p class="text-gray-200 text-xs break-all">${this.escapeHtml(userDetails.metadata?.environment?.userAgent || "N/A")}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">\uC811\uC18D \uC2DC\uAC01</p>
                                <p class="text-gray-200">${userDetails.metadata?.joinTime ? new Date(userDetails.metadata.joinTime).toLocaleString("ko-KR") : "N/A"}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">\uC0C1\uD0DC</p>
                                <p class="text-gray-200">${userDetails.isOnline ? '<span class="text-green-400">\uC628\uB77C\uC778</span>' : '<span class="text-gray-400">\uC624\uD504\uB77C\uC778</span>'}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">\uBA54\uC2DC\uC9C0 \uC218</p>
                                <p class="text-gray-200">${userDetails.messageCount || 0}</p>
                            </div>
                            <div>
                                <p class="text-gray-500">\uB9C8\uC9C0\uB9C9 \uD65C\uB3D9</p>
                                <p class="text-gray-200">${userDetails.lastMessage ? new Date(userDetails.lastMessage).toLocaleString("ko-KR") : "N/A"}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-gray-700 rounded-lg p-4">
                        <h3 class="text-sm font-semibold text-gray-400 mb-2">\uBA54\uC2DC\uC9C0 \uAE30\uB85D (\uCD5C\uADFC ${Math.min(userDetails.messages?.length || 0, 50)}\uAC1C)</h3>
                        <div class="space-y-2 max-h-96 overflow-y-auto">
                            ${userDetails.messages && userDetails.messages.length > 0 ? userDetails.messages.slice(0, 50).map((msg) => `
                                    <div class="bg-gray-800 rounded p-3 text-sm">
                                        <div class="flex justify-between items-start mb-1">
                                            <span class="text-xs text-gray-500">${new Date(msg.timestamp).toLocaleString("ko-KR")}</span>
                                            ${msg.editedAt ? '<span class="text-xs text-yellow-400">(\uC218\uC815\uB428)</span>' : ""}
                                        </div>
                                        <p class="text-gray-200 break-all whitespace-pre-wrap">${this.escapeHtml(msg.content)}</p>
                                        ${msg.file ? `<p class="text-xs text-blue-400 mt-1 break-all">\uD30C\uC77C: ${msg.file.filename}</p>` : ""}
                                    </div>
                                `).join("") : '<p class="text-gray-500 text-center py-4">\uBA54\uC2DC\uC9C0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>'}
                        </div>
                    </div>
                </div>
            `;
      modal.classList.remove("hidden");
      showModal(modal, "#close-user-modal", document.activeElement);
    } catch (error) {
      console.error("Show user details error:", error);
      alert("\uC0AC\uC6A9\uC790 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    }
  },
  async loadAnnouncements() {
    try {
      const response = await fetch("/api/announcements");
      if (!response.ok) {
        throw new Error("Failed to load announcements");
      }
      const announcements = await response.json();
      this.lastAnnouncements = announcements;
      this.updateAnnouncementsList(announcements);
    } catch (error) {
      console.error("Announcements load error:", error);
      const container = document.getElementById("announcement-list");
      if (container) {
        container.innerHTML = '<p class="text-sm text-red-500 text-center py-8">\uACF5\uC9C0\uC0AC\uD56D\uC744 \uBD88\uB7EC\uC624\uB294 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.</p>';
      }
    }
  },
  async editAnnouncement(timestamp) {
    const item = this.lastAnnouncements?.find((a) => a.timestamp === timestamp);
    if (!item) return;
    const isEmergency = item.isEmergency || false;
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50";
    modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-2xl p-6 max-w-lg w-full mx-4 border border-gray-700">
                <h3 class="text-lg font-bold text-gray-100 mb-4">\uACF5\uC9C0\uC0AC\uD56D \uC218\uC815</h3>
                <textarea id="edit-announce-input" rows="5" class="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none resize-none mb-3">${item.content}</textarea>
                <label class="flex items-center gap-1.5 text-sm text-gray-300 mb-4 cursor-pointer">
                    <input type="checkbox" id="edit-emergency-checkbox" class="rounded bg-gray-700 border-gray-600 text-red-500 focus:ring-red-500" ${isEmergency ? "checked" : ""}>
                    \uAE34\uAE09\uACF5\uC9C0
                </label>
                <div class="flex justify-end gap-2">
                    <button id="cancel-edit-btn" class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors">\uCDE8\uC18C</button>
                    <button id="save-edit-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors">\uC800\uC7A5</button>
                </div>
            </div>
        `;
    document.body.appendChild(modal);
    modal.querySelector("#cancel-edit-btn").addEventListener("click", () => modal.remove());
    modal.querySelector("#save-edit-btn").addEventListener("click", async () => {
      const newContent = modal.querySelector("#edit-announce-input").value.trim();
      if (!newContent) {
        this.showNotification("\uB0B4\uC6A9\uC744 \uC785\uB825\uD558\uC138\uC694.", "error");
        return;
      }
      const newEmergency = modal.querySelector("#edit-emergency-checkbox").checked;
      modal.remove();
      try {
        const body = { timestamp, content: newContent, isEmergency: newEmergency };
        if (newEmergency && item.emergencyUntil) {
          body.emergencyUntil = item.emergencyUntil;
        }
        const response = await fetch("/api/admin/announce", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.sessionToken}`
          },
          body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error("Failed to edit announcement");
        this.showNotification("\uACF5\uC9C0\uC0AC\uD56D\uC774 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", "success");
        this.refreshData();
      } catch (_error) {
        this.showNotification("\uACF5\uC9C0\uC0AC\uD56D \uC218\uC815\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
      }
    });
  },
  async deleteAnnouncement(timestamp) {
    if (!confirm("\uC815\uB9D0 \uC774 \uACF5\uC9C0\uC0AC\uD56D\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) return;
    try {
      const response = await fetch("/api/admin/announce", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.sessionToken}`
        },
        body: JSON.stringify({ timestamp })
      });
      if (!response.ok) throw new Error("Failed to delete announcement");
      this.showNotification("\uACF5\uC9C0\uC0AC\uD56D\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", "success");
      this.refreshData();
    } catch (_error) {
      this.showNotification("\uACF5\uC9C0\uC0AC\uD56D \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  },
  async demoteAnnouncement(timestamp) {
    if (!this.sessionToken) {
      alert("\uAD00\uB9AC\uC790 \uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      return;
    }
    if (!confirm("\uAE34\uAE09 \uACF5\uC9C0\uB97C \uC77C\uBC18 \uACF5\uC9C0\uB85C \uC804\uD658\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?\n\n\uC804\uD658 \uC2DC \uC0AC\uC6A9\uC790\uC5D0\uAC8C \uAE34\uAE09 \uD574\uC81C \uC54C\uB9BC\uC774 \uC804\uC1A1\uB429\uB2C8\uB2E4.")) return;
    try {
      const response = await fetch("/api/admin/announce", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.sessionToken}`
        },
        body: JSON.stringify({ timestamp, isEmergency: false, emergencyUntil: null })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        console.error("Demote announce failed", err);
        alert("\uACF5\uC9C0 \uC804\uD658\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
        return;
      }
      alert("\uAE34\uAE09 \uACF5\uC9C0\uAC00 \uC77C\uBC18 \uACF5\uC9C0\uB85C \uC804\uD658\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
      this.refreshData();
    } catch (error) {
      console.error("demoteAnnouncement error:", error);
      alert("\uACF5\uC9C0 \uC804\uD658 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    }
  },
  async loadAuditLogs() {
    try {
      const response = await fetch("/api/admin/audit-logs", {
        headers: { "Authorization": `Bearer ${this.sessionToken}` }
      });
      if (!response.ok) {
        throw new Error("Failed to load audit logs");
      }
      const logs = await response.json();
      const container = document.getElementById("audit-logs-list");
      const filterSelect = document.getElementById("audit-log-filter");
      if (!container) return;
      const selectedFilter = filterSelect?.value || "all";
      const filteredLogs = selectedFilter === "all" ? logs : logs.filter((log) => {
        if (selectedFilter === "delete_message") {
          return log.action === "delete_message" || log.action === "admin_delete_message";
        }
        return log.action === selectedFilter;
      });
      if (!filteredLogs || filteredLogs.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">\uAC10\uC0AC \uB85C\uADF8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
        return;
      }
      container.innerHTML = filteredLogs.map((log) => {
        const actionText = {
          "kick_user": "\uC720\uC800 \uAC15\uD1F4",
          "edit_message": "\uBA54\uC2DC\uC9C0 \uC218\uC815",
          "delete_message": "\uBA54\uC2DC\uC9C0 \uC0AD\uC81C",
          "admin_delete_message": "\uBA54\uC2DC\uC9C0 \uC0AD\uC81C",
          "admin_delete_all_messages": "\uC804\uCCB4 \uBA54\uC2DC\uC9C0 \uC0AD\uC81C",
          "send_announcement": "\uACF5\uC9C0 \uC804\uC1A1",
          "edit_announcement": "\uACF5\uC9C0\uC0AC\uD56D \uC218\uC815",
          "delete_announcement": "\uACF5\uC9C0\uC0AC\uD56D \uC0AD\uC81C",
          "UNBAN_IP": "IP \uCC28\uB2E8 \uD574\uC81C"
        }[log.action] || log.action;
        const actionColor = {
          "kick_user": "text-red-400",
          "edit_message": "text-yellow-400",
          "delete_message": "text-orange-400",
          "admin_delete_message": "text-orange-400",
          "admin_delete_all_messages": "text-red-500",
          "send_announcement": "text-blue-400",
          "edit_announcement": "text-blue-400",
          "delete_announcement": "text-red-400",
          "UNBAN_IP": "text-green-400"
        }[log.action] || "text-gray-400";
        return `
                    <div class="bg-gray-700 rounded-lg p-3">
                        <div class="flex justify-between items-start mb-1">
                            <span class="text-sm font-medium ${actionColor}">${actionText}</span>
                            <span class="text-xs text-gray-500">${new Date(log.timestamp).toLocaleString("ko-KR")}</span>
                        </div>
                        <p class="text-sm text-gray-300 break-all">${log.details}</p>
                        ${log.metadata ? `<p class="text-xs text-gray-500 mt-1 break-all overflow-x-auto">${JSON.stringify(log.metadata)}</p>` : ""}
                    </div>
                `;
      }).join("");
    } catch (error) {
      console.error("Load audit logs error:", error);
    }
  },
  async clearAuditLogs() {
    const confirmed = confirm("\uBAA8\uB4E0 \uAC10\uC0AC \uB85C\uADF8\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?\n\uC774 \uC791\uC5C5\uC740 \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    if (!confirmed) return;
    try {
      const response = await fetch("/api/admin/delete-audit-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.sessionToken}`
        }
      });
      if (!response.ok) throw new Error("Failed to delete audit logs");
      this.showNotification("\uAC10\uC0AC \uB85C\uADF8\uAC00 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", "success");
      this.loadAuditLogs();
    } catch (error) {
      console.error("Clear audit logs error:", error);
      this.showNotification("\uAC10\uC0AC \uB85C\uADF8 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  },
  async loadAdminLogs() {
    try {
      const response = await fetch("/api/admin/logs", {
        headers: { "Authorization": `Bearer ${this.sessionToken}` }
      });
      if (!response.ok) {
        throw new Error("Failed to load admin logs");
      }
      const data = await response.json();
      const logs = (data.logs || []).filter(
        (log) => ["login_success", "login_failed", "login_blocked", "logout"].includes(log.type)
      );
      const container = document.getElementById("admin-login-logs");
      if (!container) return;
      if (logs.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">\uAD00\uB9AC\uC790 \uB85C\uADF8\uC778 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
        return;
      }
      container.innerHTML = logs.map((log) => {
        const typeBadge = {
          "login_success": "bg-green-900/50 text-green-400 border border-green-700",
          "login_failed": "bg-red-900/50 text-red-400 border border-red-700",
          "login_blocked": "bg-orange-900/50 text-orange-400 border border-orange-700",
          "logout": "bg-gray-700 text-gray-300 border border-gray-600"
        }[log.type] || "bg-gray-700 text-gray-300";
        const typeText = {
          "login_success": "\uB85C\uADF8\uC778 \uC131\uACF5",
          "login_failed": "\uB85C\uADF8\uC778 \uC2E4\uD328",
          "login_blocked": "\uB85C\uADF8\uC778 \uCC28\uB2E8",
          "logout": "\uB85C\uADF8\uC544\uC6C3"
        }[log.type] || log.type;
        return `
                    <div class="bg-gray-700 rounded-lg p-3">
                        <div class="flex justify-between items-start mb-1">
                            <span class="text-sm font-medium"><span class="px-2 py-0.5 rounded text-xs font-bold ${typeBadge}">${typeText}</span></span>
                            <span class="text-xs text-gray-500">${new Date(log.timestamp).toLocaleString("ko-KR")}</span>
                        </div>
                        <p class="text-sm text-gray-300 break-all">IP: ${this.escapeHtml(log.ip || "N/A")}</p>
                        ${log.details ? `<p class="text-xs text-gray-400 mt-1">${this.escapeHtml(log.details)}</p>` : ""}
                    </div>
                `;
      }).join("");
    } catch (error) {
      console.error("Load admin logs error:", error);
    }
  },
  async deleteAdminLogs() {
    if (!this.sessionToken) {
      alert("\uAD00\uB9AC\uC790 \uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      return;
    }
    if (!confirm("\uBAA8\uB4E0 \uAD00\uB9AC\uC790 \uB85C\uADF8\uC778 \uAE30\uB85D\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?\n\uC774 \uC791\uC5C5\uC740 \uB418\uB3CC\uB9B4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.")) {
      return;
    }
    try {
      const response = await fetch("/api/admin/delete-logs", {
        method: "POST",
        headers: { "Authorization": `Bearer ${this.sessionToken}` }
      });
      if (!response.ok) throw new Error("Failed to delete admin logs");
      const result = await response.json();
      this.showNotification(`\uB85C\uADF8\uC778 \uAE30\uB85D ${result.deletedCount}\uAC74\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, "success");
      this.loadAdminLogs();
    } catch (error) {
      console.error("Delete admin logs error:", error);
      this.showNotification("\uB85C\uADF8\uC778 \uAE30\uB85D \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  },
  downloadErrorLogs() {
    if (!this.lastMetrics || !this.lastMetrics.errorLogs || this.lastMetrics.errorLogs.length === 0) {
      this.showNotification("\uB2E4\uC6B4\uB85C\uB4DC\uD560 \uC624\uB958 \uB85C\uADF8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const fileName = `error_logs_${timestamp}.json`;
    const jsonStr = JSON.stringify(this.lastMetrics.errorLogs, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  },
  async deleteErrorLogs() {
    if (!this.lastMetrics || !this.lastMetrics.errorLogs || this.lastMetrics.errorLogs.length === 0) {
      this.showNotification("\uC0AD\uC81C\uD560 \uC624\uB958 \uB85C\uADF8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
      return;
    }
    if (!confirm("\uACBD\uACE0: \uBAA8\uB4E0 \uC624\uB958 \uB85C\uADF8 \uB370\uC774\uD130\uAC00 \uC11C\uBC84\uC5D0\uC11C \uC601\uAD6C\uC801\uC73C\uB85C \uC0AD\uC81C\uB429\uB2C8\uB2E4. \uACC4\uC18D\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) {
      return;
    }
    try {
      const response = await fetch("/api/admin/delete-error-logs", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.sessionToken}`
        }
      });
      if (!response.ok) {
        throw new Error("Failed to delete error logs");
      }
      this.showNotification("\uBAA8\uB4E0 \uC624\uB958 \uB85C\uADF8\uAC00 \uC131\uACF5\uC801\uC73C\uB85C \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", "success");
      this.refreshData();
    } catch (error) {
      console.error("Error deleting logs:", error);
      this.showNotification("\uC624\uB958 \uB85C\uADF8 \uC0AD\uC81C \uC911 \uBB38\uC81C\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  },
  async exportAuditLogCsv() {
    if (!this.sessionToken) {
      alert("\uAD00\uB9AC\uC790 \uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      return;
    }
    try {
      const response = await fetch("/api/admin/audit-logs", {
        headers: { "Authorization": `Bearer ${this.sessionToken}` }
      });
      if (!response.ok) {
        throw new Error("Failed to load audit logs");
      }
      const logs = await response.json();
      const filterSelect = document.getElementById("audit-log-filter");
      const selectedFilter = filterSelect?.value || "all";
      let filteredLogs = logs;
      if (selectedFilter !== "all") {
        filteredLogs = logs.filter((log) => {
          if (selectedFilter === "delete_message") {
            return log.action === "delete_message" || log.action === "admin_delete_message";
          }
          return log.action === selectedFilter;
        });
      }
      if (!filteredLogs || filteredLogs.length === 0) {
        this.showNotification("\uB0B4\uBCF4\uB0BC \uAC10\uC0AC \uB85C\uADF8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.", "error");
        return;
      }
      const headers = ["timestamp", "action", "details", "metadata"];
      const escape = (value) => {
        if (value == null) return "";
        const str = String(value);
        return '"' + str.replace(/"/g, '""') + '"';
      };
      const rows = filteredLogs.map((log) => [
        new Date(log.timestamp).toISOString(),
        log.action,
        log.details || "",
        log.metadata ? JSON.stringify(log.metadata) : ""
      ]);
      const csvContent = [headers.map((h) => escape(h)).join(",")].concat(rows.map((r) => r.map((cell) => escape(cell)).join(","))).join("\n");
      const bom = "\uFEFF";
      const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_logs_${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export audit CSV error:", error);
      this.showNotification("CSV \uB0B4\uBCF4\uB0B4\uAE30 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  },
  async loadChannels() {
    try {
      const resp = await fetch("/api/admin/channels", {
        headers: { "Authorization": `Bearer ${this.sessionToken}` }
      });
      if (!resp.ok) throw new Error("Failed to load channels");
      const data = await resp.json();
      this.renderChannels(data.channels || []);
    } catch (error) {
      console.error("loadChannels error:", error);
      const tbody = document.getElementById("channels-list");
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-red-400">\uCC44\uB110 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.</td></tr>';
    }
  },
  async loadChannelStats(slug) {
    try {
      const resp = await fetch(`/api/admin/channel-details?slug=${encodeURIComponent(slug)}`, {
        headers: { "Authorization": `Bearer ${this.sessionToken}` }
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const usersEl = document.querySelector(`.channel-users[data-slug="${CSS.escape(slug)}"]`);
      const msgsEl = document.querySelector(`.channel-messages[data-slug="${CSS.escape(slug)}"]`);
      if (usersEl) usersEl.textContent = data.activeConnections ?? "-";
      if (msgsEl) msgsEl.textContent = data.totalMessages ?? "-";
    } catch (e) {
      console.warn("loadChannelStats error:", e);
    }
  },
  async viewChannelDetail(slug, name) {
    try {
      const resp = await fetch(`/api/admin/channel-details?slug=${encodeURIComponent(slug)}`, {
        headers: { "Authorization": `Bearer ${this.sessionToken}` }
      });
      if (!resp.ok) throw new Error("Failed to load channel details");
      const data = await resp.json();
      const title = document.getElementById("channel-detail-title");
      const content = document.getElementById("channel-detail-content");
      if (title) title.textContent = `\uCC44\uB110 \uC0C1\uC138: ${escapeHtml(name)}`;
      const sessions = data.sessions || [];
      const messages = data.messages || [];
      content.innerHTML = `
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div class="bg-gray-700/50 rounded-lg p-3">
                        <div class="text-xs text-gray-400">\uC811\uC18D\uC790</div>
                        <div class="text-xl font-bold text-white">${data.activeConnections || 0}</div>
                    </div>
                    <div class="bg-gray-700/50 rounded-lg p-3">
                        <div class="text-xs text-gray-400">\uCD1D \uBA54\uC2DC\uC9C0</div>
                        <div class="text-xl font-bold text-white">${data.totalMessages || 0}</div>
                    </div>
                    <div class="bg-gray-700/50 rounded-lg p-3">
                        <div class="text-xs text-gray-400">\uCD1D \uC5F0\uACB0</div>
                        <div class="text-xl font-bold text-white">${data.totalConnections || 0}</div>
                    </div>
                    <div class="bg-gray-700/50 rounded-lg p-3">
                        <div class="text-xs text-gray-400">\uC624\uB958</div>
                        <div class="text-xl font-bold text-white">${data.errors || 0}</div>
                    </div>
                </div>
                <div>
                    <h4 class="text-sm font-semibold text-gray-200 mb-2">\uC811\uC18D \uC911\uC778 \uC0AC\uC6A9\uC790 (${sessions.filter((s) => s.isOnline).length})</h4>
                    <div class="overflow-x-auto">
                        <table class="w-full text-xs text-left">
                            <thead class="text-gray-400 bg-gray-700/50"><tr><th class="px-2 py-1">\uB2C9\uB124\uC784</th><th class="px-2 py-1">IP</th><th class="px-2 py-1">\uAD6D\uAC00</th><th class="px-2 py-1">\uBA54\uC2DC\uC9C0</th><th class="px-2 py-1">\uC0C1\uD0DC</th></tr></thead>
                            <tbody class="divide-y divide-gray-700">
                                ${sessions.length ? sessions.map((s) => `
                                    <tr class="${s.isOnline ? "text-gray-200" : "text-gray-500"}">
                                        <td class="px-2 py-1">${escapeHtml(s.nickname)}</td>
                                        <td class="px-2 py-1 font-mono">${escapeHtml(s.ip)}</td>
                                        <td class="px-2 py-1">${escapeHtml(s.country)}</td>
                                        <td class="px-2 py-1">${s.messageCount || 0}</td>
                                        <td class="px-2 py-1">${s.isOnline ? '<span class="text-green-400">\uC628\uB77C\uC778</span>' : '<span class="text-gray-500">\uC624\uD504\uB77C\uC778</span>'}</td>
                                    </tr>
                                `).join("") : '<tr><td colspan="5" class="px-2 py-4 text-center text-gray-500">\uC0AC\uC6A9\uC790 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div>
                    <h4 class="text-sm font-semibold text-gray-200 mb-2">\uCD5C\uADFC \uBA54\uC2DC\uC9C0 (${messages.length})</h4>
                    <div class="space-y-1 max-h-64 overflow-y-auto bg-gray-900/50 rounded-lg p-2">
                        ${messages.length ? messages.map((m) => `
                            <div class="text-xs text-gray-300 border-b border-gray-700/50 pb-1">
                                <span class="text-gray-500">[${new Date(m.timestamp).toLocaleTimeString("ko-KR")}]</span>
                                <span class="text-emerald-400">${escapeHtml(m.nickname || "\uC775\uBA85")}</span>:
                                <span>${escapeHtml(m.content?.substring(0, 100) || "(\uD30C\uC77C)")}${m.content?.length > 100 ? "..." : ""}</span>
                            </div>
                        `).join("") : '<div class="text-xs text-gray-500 text-center py-4">\uBA54\uC2DC\uC9C0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</div>'}
                    </div>
                </div>
            `;
      const channelDetailModal = document.getElementById("channel-detail-modal");
      channelDetailModal?.classList.remove("hidden");
      if (channelDetailModal) this._channelModalHide = showModal(channelDetailModal, "#close-channel-detail", document.activeElement);
    } catch (error) {
      console.error("viewChannelDetail error:", error);
      this.showNotification("\uCC44\uB110 \uC0C1\uC138 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  },
  hideChannelDetail() {
    const modal = document.getElementById("channel-detail-modal");
    if (this._channelModalHide) {
      this._channelModalHide();
      this._channelModalHide = null;
    }
    modal?.classList.add("hidden");
  },
  async deleteChannel(slug, name) {
    if (!confirm(`\uCC44\uB110 "${name}"\uC744(\uB97C) \uAC15\uC81C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?
\uBAA8\uB4E0 \uBA54\uC2DC\uC9C0\uC640 \uC0AC\uC6A9\uC790 \uB370\uC774\uD130\uAC00 \uC601\uAD6C \uC0AD\uC81C\uB429\uB2C8\uB2E4.`)) return;
    try {
      const resp = await fetch("/api/admin/channel-delete", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.sessionToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ slug })
      });
      if (!resp.ok) throw new Error("Failed to delete channel");
      this.showNotification(`\uCC44\uB110 "${name}"\uC774(\uAC00) \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, "success");
      this.loadChannels();
    } catch (error) {
      console.error("deleteChannel error:", error);
      this.showNotification("\uCC44\uB110 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
    }
  },
  createBanModal(sessionId, userIp) {
    const sessionRows = document.querySelectorAll(".session-row");
    let sameIpCount = 0;
    sessionRows.forEach((row) => {
      const btn = row.querySelector(".kick-user-btn");
      if (btn && btn.dataset.userIp === userIp) {
        sameIpCount++;
      }
    });
    const isSharedIP = sameIpCount > 1;
    const sharedIpWarning = isSharedIP ? `
            <div class="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                <p class="text-yellow-400 text-sm font-semibold">\u26A0\uFE0F \uACF5\uC720 IP \uAC10\uC9C0 (${sameIpCount}\uBA85 \uC811\uC18D \uC911)</p>
                <p class="text-yellow-500 text-xs mt-1">\uAC19\uC740 IP\uB97C \uC0AC\uC6A9\uD558\uB294 \uB2E4\uB978 \uC0AC\uC6A9\uC790\uAC00 \uC788\uC2B5\uB2C8\uB2E4. \uCC28\uB2E8 \uC2DC \uD574\uB2F9 \uC138\uC158\uB9CC \uCC28\uB2E8\uB418\uBA70, \uAC19\uC740 IP\uC758 \uB2E4\uB978 \uC0AC\uC6A9\uC790\uB294 \uC601\uD5A5\uC744 \uBC1B\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.</p>
            </div>
        ` : "";
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
    modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
                <h3 class="text-xl font-bold text-gray-100 mb-4">\uC0AC\uC6A9\uC790 \uAC15\uC81C\uD1F4\uC7A5</h3>
                <div class="mb-4 text-sm text-gray-400">
                    <p>\uC138\uC158 ID: <span class="text-gray-200">${this.truncateId(sessionId)}</span></p>
                    <p>IP \uC8FC\uC18C: <span class="text-gray-200">${userIp}</span></p>
                </div>
                ${sharedIpWarning}
                <p class="text-sm text-gray-300 mb-4">\uCC28\uB2E8 \uC2DC\uAC04\uC744 \uC120\uD0DD\uD558\uC138\uC694:</p>
                <div class="grid grid-cols-2 gap-3 mb-6">
                    <button class="ban-option-btn bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-3 px-4 rounded-lg transition-colors" data-duration="0">
                        \uC989\uC2DC \uD1F4\uC7A5
                        <span class="block text-xs opacity-80">\uC7AC\uC811\uC18D \uAC00\uB2A5</span>
                    </button>
                    <button class="ban-option-btn bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-4 rounded-lg transition-colors" data-duration="30">
                        30\uCD08 \uCC28\uB2E8
                        <span class="block text-xs opacity-80">${isSharedIP ? "\uC138\uC158\uB9CC \uCC28\uB2E8" : "\uC784\uC2DC \uCC28\uB2E8"}</span>
                    </button>
                    <button class="ban-option-btn bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors" data-duration="300">
                        5\uBD84 \uCC28\uB2E8
                        <span class="block text-xs opacity-80">${isSharedIP ? "\uC138\uC158\uB9CC \uCC28\uB2E8" : "\uB2E8\uAE30 \uCC28\uB2E8"}</span>
                    </button>
                    <button class="ban-option-btn bg-red-700 hover:bg-red-800 text-white font-medium py-3 px-4 rounded-lg transition-colors" data-duration="600">
                        10\uBD84 \uCC28\uB2E8
                        <span class="block text-xs opacity-80">${isSharedIP ? "\uC138\uC158\uB9CC \uCC28\uB2E8" : "\uC7A5\uAE30 \uCC28\uB2E8"}</span>
                    </button>
                </div>
                <button class="cancel-btn w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-2 rounded-lg transition-colors">
                    \uCDE8\uC18C
                </button>
            </div>
        `;
    modal.querySelectorAll(".ban-option-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const banDuration = parseInt(btn.dataset.duration);
        modal.remove();
        await this.kickUser(sessionId, banDuration);
      });
    });
    modal.querySelector(".cancel-btn").addEventListener("click", () => {
      modal.remove();
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    return modal;
  },
  filterAnnouncements(query) {
    if (!this.lastAnnouncements) return;
    if (!query) {
      this.updateAnnouncementsList(this.lastAnnouncements);
      return;
    }
    const filtered = this.lastAnnouncements.filter((acc) => {
      const content = acc.content.toLowerCase();
      const timeStr = new Date(acc.timestamp).toLocaleString("ko-KR").toLowerCase();
      return content.includes(query) || timeStr.includes(query);
    });
    this.updateAnnouncementsList(filtered);
  }
};
var admin_data_default = dataMethods;

// public/js/admin-render.js
var FOCUSABLE2 = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
function trapFocus2(modalEl) {
  if (!modalEl) return function cleanup() {
  };
  const focusable = Array.from(modalEl.querySelectorAll(FOCUSABLE2));
  if (focusable.length === 0) return function cleanup() {
  };
  const firstEl = focusable[0];
  const lastEl = focusable[focusable.length - 1];
  firstEl.focus();
  function handler(e) {
    if (e.key !== "Tab") return;
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  }
  modalEl.addEventListener("keydown", handler);
  return function cleanup() {
    modalEl.removeEventListener("keydown", handler);
  };
}
var renderMethods = {
  updateMetrics(metrics) {
    this.lastMetrics = metrics;
    document.getElementById("stat-active-connections").textContent = metrics.activeConnections?.toLocaleString() || "0";
    document.getElementById("stat-total-messages").textContent = metrics.totalMessages?.toLocaleString() || "0";
    document.getElementById("stat-total-connections").textContent = metrics.totalConnections?.toLocaleString() || "0";
    document.getElementById("stat-errors").textContent = metrics.errors?.toLocaleString() || "0";
    document.getElementById("server-time").textContent = (/* @__PURE__ */ new Date()).toLocaleString("ko-KR");
    if (metrics.uptime) {
      const hours = Math.floor(metrics.uptime / 36e5);
      const minutes = Math.floor(metrics.uptime % 36e5 / 6e4);
      document.getElementById("uptime").textContent = `${hours}\uC2DC\uAC04 ${minutes}\uBD84`;
    }
    if (metrics.errorLogs) {
      this.renderErrorLogs(metrics.errorLogs);
    }
  },
  renderErrorLogs(logs) {
    const container = document.getElementById("error-logs-list");
    if (!container) return;
    this._errorLogs = logs || [];
    const filterSelect = document.getElementById("error-log-filter");
    const searchInput = document.getElementById("error-log-search");
    const filterType = filterSelect?.value || "all";
    const searchText = (searchInput?.value || "").toLowerCase();
    let filteredLogs = this._errorLogs;
    if (filterType !== "all") {
      filteredLogs = filteredLogs.filter((log) => log.type === filterType);
    }
    if (searchText) {
      filteredLogs = filteredLogs.filter(
        (log) => log.message && log.message.toLowerCase().includes(searchText) || log.location && log.location.toLowerCase().includes(searchText) || log.type && log.type.toLowerCase().includes(searchText)
      );
    }
    if (!filteredLogs || filteredLogs.length === 0) {
      container.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">\uCD5C\uADFC \uBC1C\uC0DD\uD55C \uC624\uB958\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';
      return;
    }
    const currentOpened = Array.from(container.querySelectorAll('tr[id^="error-detail-"]:not(.hidden)')).map((el) => el.getAttribute("data-log-id"));
    container.innerHTML = filteredLogs.map((log, index) => {
      const date = new Date(log.timestamp);
      let badgeClass = "bg-gray-700 text-gray-300";
      if (log.type === "WS_MESSAGE_PARSE") badgeClass = "bg-yellow-900/50 text-yellow-500 border border-yellow-700";
      else if (log.type === "CLIENT_ERROR") badgeClass = "bg-orange-900/50 text-orange-500 border border-orange-700";
      else if (log.type === "WS_CONNECTION") badgeClass = "bg-purple-900/50 text-purple-500 border border-purple-700";
      else if (log.type === "SYSTEM_ERROR") badgeClass = "bg-red-900/50 text-red-500 border border-red-700";
      const uniqueLogId = `log-${log.timestamp}-${log.type}`;
      const detailsId = `error-detail-${index}`;
      const isOpened = currentOpened.includes(uniqueLogId);
      return `
            <tr class="hover:bg-gray-700/30 transition-colors">
                <td class="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap text-xs text-gray-400">
                    ${date.toLocaleDateString()}<br>${date.toLocaleTimeString()}
                </td>
                <td class="px-2 py-2 md:px-4 md:py-3 whitespace-nowrap">
                    <span class="px-2 py-1 rounded text-[10px] font-bold ${badgeClass}">${log.type}</span>
                </td>
                <td class="px-2 py-2 md:px-4 md:py-3 text-xs" style="max-width: 0;">
                    <div class="font-mono text-red-400 truncate w-full" title="${this.escapeHtml(log.message)}">${this.escapeHtml(log.message)}</div>
                    <div class="text-gray-500 text-[10px] mt-1 truncate w-full" title="${this.escapeHtml(log.location)}">${this.escapeHtml(log.location)}</div>
                </td>
                <td class="px-2 py-2 md:px-4 md:py-3 text-right">
                    <button onclick="document.getElementById('${detailsId}').classList.toggle('hidden')" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300 transition-colors">
                        \uC790\uC138\uD788
                    </button>
                </td>
            </tr>
            <tr id="${detailsId}" data-log-id="${uniqueLogId}" class="${isOpened ? "" : "hidden"} bg-gray-900/50 border-t border-gray-800">
                <td colspan="4" class="px-4 py-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                        <div class="min-w-0 flex flex-col">
                            <h4 class="text-xs font-bold text-gray-400 mb-2 border-b border-gray-700 pb-1 shrink-0">\uD658\uACBD \uC815\uBCF4</h4>
                            <div class="overflow-y-auto max-h-48 pr-1 min-h-[4rem]">
                                <ul class="text-[11px] text-gray-300 space-y-1 font-mono break-all">
                                    <li><strong class="text-gray-400">IP / \uC9C0\uC5ED:</strong> ${this.escapeHtml(log.environment?.ip || "N/A")} (${this.escapeHtml(log.environment?.country || "Unknown")})</li>
                                    <li><strong class="text-gray-400">User-Agent:</strong> <span>${this.escapeHtml(log.environment?.userAgent || "N/A")}</span></li>
                                    <li><strong class="text-gray-400">Context:</strong> ${this.escapeHtml(log.context || "N/A")}</li>
                                    ${log.environment?.url ? `<li><strong class="text-gray-400">URL:</strong> <a href="${this.escapeHtml(log.environment.url)}" target="_blank" class="text-cyan-400 hover:underline">${this.escapeHtml(log.environment.url)}</a></li>` : ""}
                                </ul>
                            </div>
                        </div>
                        <div class="min-w-0 flex flex-col">
                            <h4 class="text-xs font-bold text-gray-400 mb-2 border-b border-gray-700 pb-1 shrink-0">Stack Trace</h4>
                            <div class="bg-black p-2 rounded flex-1 min-h-[8rem] max-h-48 overflow-y-auto overflow-x-hidden text-[10px] font-mono text-gray-400 whitespace-pre-wrap break-all">${this.escapeHtml(log.stackTrace)}</div>
                        </div>
                    </div>
                </td>
            </tr>
            `;
    }).join("");
  },
  updateActiveSessions(sessions) {
    const container = document.getElementById("active-sessions");
    if (!sessions || sessions.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">\uD65C\uC131 \uC138\uC158\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
      return;
    }
    container.innerHTML = sessions.map((session) => {
      const isOnline = session.isOnline;
      const statusColor = isOnline ? "bg-green-500" : "bg-gray-500";
      const lastActiveText = session.lastMessageTime > 0 ? this.formatDuration(Date.now() - session.lastMessageTime) + " \uC804 \uD65C\uB3D9" : session.lastActivityTime ? this.formatDuration(Date.now() - session.lastActivityTime) + " \uC804 \uD65C\uB3D9" : "\uD65C\uB3D9 \uC5C6\uC74C";
      const userAgent = session.userAgent ? session.userAgent.substring(0, 40) + (session.userAgent.length > 40 ? "..." : "") : "";
      return `
                <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer session-row" data-session-id="${session.sessionId}">
                    <div class="flex items-center gap-3 flex-1">
                        <div class="w-2 h-2 ${statusColor} rounded-full ${isOnline ? "animate-pulse" : ""}"></div>
                        <div class="flex-1">
                            <p class="text-sm font-mono text-gray-300 break-all">
                                ${this.truncateId(session.sessionId)}
                                ${session.nickname ? `<span class="text-xs ml-2 text-yellow-300">(${this.escapeHtml(session.nickname)})</span>` : ""}
                            </p>
                            <p class="text-xs text-gray-500 break-all">${session.ip || "Unknown IP"}${session.country ? ` \xB7 ${this.escapeHtml(session.country)}` : ""}</p>
                            <p class="text-xs text-gray-400">${lastActiveText}</p>
                            ${userAgent ? `<p class="text-xs text-gray-500 truncate">${this.escapeHtml(userAgent)}</p>` : ""}
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-right">
                            <p class="text-xs text-gray-400">${session.messageCount || 0} \uBA54\uC2DC\uC9C0</p>
                            <p class="text-xs text-gray-500">\uC811\uC18D: ${this.formatDuration(Date.now() - session.joinTime)}</p>
                        </div>
                        <button class="kick-user-btn bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded" 
                                data-session-id="${session.sessionId}"
                                data-user-ip="${session.ip || "Unknown"}"
                                title="\uC0AC\uC6A9\uC790 \uAC15\uC81C\uD1F4\uC7A5"
                                onclick="event.stopPropagation()">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 inline" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                            </svg>
                            \uD1F4\uC7A5
                        </button>
                    </div>
                </div>
            `;
    }).join("");
    document.querySelectorAll(".session-row").forEach((row) => {
      row.addEventListener("click", async (e) => {
        const sessionId = e.currentTarget.dataset.sessionId;
        await this.showUserDetails(sessionId);
      });
    });
    document.querySelectorAll(".kick-user-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const sessionId = e.currentTarget.dataset.sessionId;
        const userIp = e.currentTarget.dataset.userIp;
        const modal = this.createBanModal(sessionId, userIp);
        document.body.appendChild(modal);
        trapFocus2(modal);
      });
    });
  },
  updateRecentMessages(messages) {
    const container = document.getElementById("recent-messages");
    if (!messages || messages.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">\uCD5C\uADFC \uBA54\uC2DC\uC9C0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
      return;
    }
    container.innerHTML = messages.slice(-50).reverse().map((msg) => {
      const fileHtml = msg.file ? (() => {
        const filename = this.escapeHtml(msg.file.filename || "\uD30C\uC77C");
        const filesize = msg.file.filesize != null ? this.formatFileSize(msg.file.filesize) : "";
        const filetype = msg.file.filetype || "";
        const url = msg.file.url || "#";
        if (!this.isValidUrl(url)) {
          return '<div class="text-red-400 text-xs mt-2">Invalid file URL</div>';
        }
        const safeUrl = this.sanitizeUrl(url);
        if (filetype.startsWith("image/")) {
          return `
                        <div class="mt-2">
                            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">
                                <img src="${safeUrl}" alt="${filename}" class="w-full max-h-48 object-contain rounded border border-gray-600" />
                            </a>
                            <div class="mt-1 text-xs text-gray-400">${filename} ${filesize ? "\xB7 " + filesize : ""}</div>
                        </div>
                    `;
        }
        return `
                    <div class="mt-2 text-xs text-gray-300">
                        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${filename}</a>
                        ${filesize ? `<span class="text-gray-400"> \xB7 ${filesize}</span>` : ""}
                        ${filetype ? `<span class="text-gray-400"> \xB7 ${this.escapeHtml(filetype)}</span>` : ""}
                    </div>
                `;
      })() : "";
      const isAdminMsg = msg.sessionId && String(msg.sessionId).startsWith("admin_");
      const adminBadge = isAdminMsg ? `
                <span class="inline-block text-xs font-semibold text-yellow-300 bg-yellow-900/20 px-2 py-0.5 rounded">\uAD00\uB9AC\uC790</span>
            ` : "";
      const canEdit = isAdminMsg;
      const canDelete = true;
      const editButtons = `
                <div class="mt-2 flex gap-2">
                    ${canEdit ? `
                        <button class="admin-edit-msg-btn text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded" data-message-id="${msg.messageId}" data-content="${this.escapeHtml(msg.content || "")}">
                            \uC218\uC815
                        </button>
                    ` : ""}
                    ${canDelete ? `
                        <button class="admin-delete-msg-btn text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded" data-message-id="${msg.messageId}">
                            \uC0AD\uC81C
                        </button>
                    ` : ""}
                </div>
            `;
      return `
                <div class="p-3 ${isAdminMsg ? "bg-yellow-900/5 border border-yellow-800" : "bg-gray-700"} rounded-lg" data-message-id="${msg.messageId}">
                    <div class="flex items-start justify-between mb-1">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-mono text-gray-400">${this.truncateId(msg.sessionId)}</span>
                            ${adminBadge}
                        </div>
                        <span class="text-xs text-gray-500">${new Date(msg.timestamp).toLocaleTimeString("ko-KR")}</span>
                    </div>
                    <p class="message-content text-sm text-gray-200 break-words whitespace-pre-wrap">${this.escapeHtml(msg.content || "")}</p>
                    ${msg.editedAt ? '<span class="text-xs text-yellow-500">(\uC218\uC815\uB428)</span>' : ""}
                    ${fileHtml}
                    ${editButtons}
                </div>
            `;
    }).join("");
    this.attachMessageEventListeners();
  },
  attachMessageEventListeners() {
    document.querySelectorAll(".admin-edit-msg-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const messageId = e.target.dataset.messageId;
        const currentContent = e.target.dataset.content;
        const newContent = prompt("\uBA54\uC2DC\uC9C0\uB97C \uC218\uC815\uD558\uC138\uC694:", currentContent);
        if (newContent !== null && newContent.trim() !== currentContent.trim()) {
          await this.editAdminMessage(messageId, newContent.trim());
        }
      });
    });
    document.querySelectorAll(".admin-delete-msg-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const messageId = e.target.dataset.messageId;
        if (confirm("\uC774 \uBA54\uC2DC\uC9C0\uB97C \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?\n\n\uC0AD\uC81C\uB41C \uBA54\uC2DC\uC9C0\uB294 \uBCF5\uAD6C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.\n\uCCA8\uBD80\uB41C \uD30C\uC77C\uB3C4 \uD568\uAED8 \uC0AD\uC81C\uB429\uB2C8\uB2E4.")) {
          await this.deleteMessage(messageId);
        }
      });
    });
  },
  updateAnnouncementsList(announcements) {
    const container = document.getElementById("announcement-list");
    if (!container) return;
    if (!announcements || announcements.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">\uB4F1\uB85D\uB41C \uACF5\uC9C0\uC0AC\uD56D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>';
      return;
    }
    container.innerHTML = announcements.map((acc) => {
      const timeStr = new Date(acc.timestamp).toLocaleString("ko-KR");
      const escaped = this.escapeHtml(acc.content);
      const withLinks = escaped.replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline break-all">$1</a>');
      const content = withLinks.replace(/\n/g, "<br>");
      const emergencyBadge = acc.isEmergency ? '<span class="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded-full font-medium ml-1">\uAE34\uAE09</span>' : "";
      return `
                <div class="bg-gray-700 rounded p-3 flex justify-between items-start gap-4 ${acc.isEmergency ? "border border-red-700/50" : ""}">
                    <div class="flex-1">
                        <div class="text-xs text-gray-400 mb-1">${timeStr}${emergencyBadge}</div>
                        <div class="text-sm text-gray-200">${content}</div>
                    </div>
                    <div class="flex flex-col gap-2">
                        <button onclick="window.adminDashboard.editAnnouncement(${acc.timestamp})" class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap">\uC218\uC815</button>
                        ${acc.isEmergency ? '<button onclick="window.adminDashboard.demoteAnnouncement(' + acc.timestamp + ')" class="bg-yellow-600 hover:bg-yellow-700 text-white text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap">\uC77C\uBC18 \uC804\uD658</button>' : ""}
                        <button onclick="window.adminDashboard.deleteAnnouncement(${acc.timestamp})" class="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded transition-colors whitespace-nowrap">\uC0AD\uC81C</button>
                    </div>
                </div>
            `;
    }).join("");
  },
  renderChannels(channels) {
    const tbody = document.getElementById("channels-list");
    if (!tbody) return;
    if (!channels.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">\uD65C\uC131 \uCC44\uB110\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</td></tr>';
      return;
    }
    tbody.innerHTML = channels.map((ch) => {
      const date = new Date(ch.createdAt).toLocaleString("ko-KR");
      return `
                <tr class="hover:bg-gray-700/50 transition-colors">
                    <td class="px-2 py-2 md:px-4 md:py-3 font-medium text-emerald-300">${escapeHtml(ch.name)}</td>
                    <td class="px-2 py-2 md:px-4 md:py-3 text-xs text-gray-400">${escapeHtml(ch.createdBy || "-")}</td>
                    <td class="px-2 py-2 md:px-4 md:py-3 text-xs text-gray-400">${date}</td>
                    <td class="px-2 py-2 md:px-4 md:py-3"><span class="channel-users" data-slug="${escapeHtml(ch.slug)}">-</span></td>
                    <td class="px-2 py-2 md:px-4 md:py-3"><span class="channel-messages" data-slug="${escapeHtml(ch.slug)}">-</span></td>
                    <td class="px-2 py-2 md:px-4 md:py-3 text-right">
                        <button class="view-channel-btn text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded mr-1" data-slug="${escapeHtml(ch.slug)}" data-name="${escapeHtml(ch.name)}">\uC0C1\uC138</button>
                        <button class="delete-channel-btn text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded" data-slug="${escapeHtml(ch.slug)}" data-name="${escapeHtml(ch.name)}">\uC0AD\uC81C</button>
                    </td>
                </tr>
            `;
    }).join("");
    tbody.querySelectorAll(".view-channel-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.viewChannelDetail(btn.dataset.slug, btn.dataset.name));
    });
    tbody.querySelectorAll(".delete-channel-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.deleteChannel(btn.dataset.slug, btn.dataset.name));
    });
    channels.forEach((ch) => this.loadChannelStats(ch.slug));
  }
};
var admin_render_default = renderMethods;

// public/js/admin.js
var AdminDashboard = class {
  constructor() {
    this.loginScreen = document.getElementById("login-screen");
    this.adminDashboard = document.getElementById("admin-dashboard");
    this.loginForm = document.getElementById("login-form");
    this.loginError = document.getElementById("login-error");
    this.logoutBtn = document.getElementById("logout-btn");
    this.refreshBtn = document.getElementById("refresh-btn");
    this.sessionToken = localStorage.getItem("admin_token");
    if (this.sessionToken) {
      api_client_default.setToken(this.sessionToken);
    }
    this.refreshInterval = null;
    this.autoRefreshInterval = null;
    this.initializeEventListeners();
    this.checkAuthentication();
  }
  initializeEventListeners() {
    this.loginForm.addEventListener("submit", (e) => this.handleLogin(e));
    this.logoutBtn?.addEventListener("click", () => this.handleLogout());
    this.refreshBtn?.addEventListener("click", () => this.refreshData());
    this.exportCsvBtn = document.getElementById("export-csv-btn");
    this.exportCsvBtn?.addEventListener("click", () => this.exportCsv());
    const downloadErrorsBtn = document.getElementById("download-errors-btn");
    downloadErrorsBtn?.addEventListener("click", () => this.downloadErrorLogs());
    const deleteErrorsBtn = document.getElementById("delete-errors-btn");
    deleteErrorsBtn?.addEventListener("click", () => this.deleteErrorLogs());
    document.getElementById("refresh-channels-btn")?.addEventListener("click", () => this.loadChannels());
    document.getElementById("close-channel-detail")?.addEventListener("click", () => this.hideChannelDetail());
    try {
      const mobileMenuBtn = document.getElementById("mobile-menu-btn");
      const mobileMenu = document.getElementById("mobile-menu");
      const closeMobileMenu = document.getElementById("close-mobile-menu");
      const mobileMenuPanel = mobileMenu?.querySelector(".mobile-menu");
      mobileMenuBtn?.addEventListener("click", () => {
        mobileMenu?.classList.remove("hidden");
        setTimeout(() => mobileMenuPanel?.classList.add("active"), 10);
      });
      closeMobileMenu?.addEventListener("click", () => {
        mobileMenuPanel?.classList.remove("active");
        setTimeout(() => mobileMenu?.classList.add("hidden"), 300);
      });
      mobileMenu?.addEventListener("click", (e) => {
        if (e.target === mobileMenu) {
          mobileMenuPanel?.classList.remove("active");
          setTimeout(() => mobileMenu?.classList.add("hidden"), 300);
        }
      });
      const autoRefreshToggle = document.getElementById("auto-refresh-toggle");
      const mobileAutoRefresh = document.getElementById("mobile-auto-refresh");
      const autoRefreshInterval = document.getElementById("auto-refresh-interval");
      const mobileRefreshInterval = document.getElementById("mobile-refresh-interval");
      mobileAutoRefresh?.addEventListener("change", (e) => {
        if (autoRefreshToggle) autoRefreshToggle.checked = e.target.checked;
        if (e.target.checked) {
          this.startAutoRefresh();
        } else {
          this.stopAutoRefresh();
        }
      });
      mobileRefreshInterval?.addEventListener("change", (e) => {
        if (autoRefreshInterval) autoRefreshInterval.value = e.target.value;
        if (this.autoRefreshInterval) {
          this.stopAutoRefresh();
          this.startAutoRefresh();
        }
      });
      const mobileExportCsv = document.getElementById("mobile-export-csv");
      mobileExportCsv?.addEventListener("click", () => {
        this.exportCsv();
        mobileMenuPanel?.classList.remove("active");
        setTimeout(() => mobileMenu?.classList.add("hidden"), 300);
      });
    } catch (_error) {
    }
    this.adminSendBtn = document.getElementById("admin-send-btn");
    this.adminAnnounceBtn = document.getElementById("admin-announce-btn");
    this.adminMessageInput = document.getElementById("admin-message-input");
    this.adminAnnounceInput = document.getElementById("admin-announce-input");
    this.emergencyCheckbox = document.getElementById("emergency-checkbox");
    this.emergencyDuration = document.getElementById("emergency-duration");
    this.adminSendBtn?.addEventListener("click", () => this.sendAdminBroadcast());
    this.adminAnnounceBtn?.addEventListener("click", () => this.sendAdminAnnounce());
    this.emergencyCheckbox?.addEventListener("change", () => {
      this.emergencyDuration.classList.toggle("hidden", !this.emergencyCheckbox.checked);
    });
    if (this.adminAnnounceInput) {
      const counter = document.getElementById("announce-char-count");
      this.adminAnnounceInput.addEventListener("input", () => {
        const len = this.adminAnnounceInput.value.length;
        if (counter) {
          counter.textContent = `${len} / 7500`;
          counter.className = len > 7e3 ? "text-xs text-red-400" : len > 6e3 ? "text-xs text-yellow-400" : "text-xs text-gray-500";
        }
      });
    }
    const previewBtn = document.getElementById("announce-preview-btn");
    const previewDiv = document.getElementById("announce-preview");
    const previewContent = document.getElementById("announce-preview-content");
    if (previewBtn && this.adminAnnounceInput) {
      previewBtn.addEventListener("click", () => {
        if (previewDiv.classList.contains("hidden")) {
          const text = this.adminAnnounceInput.value.trim();
          previewContent.innerHTML = text ? this.escapeHtml(text).replace(/\n/g, "<br>") : '<span class="text-gray-500">\uB0B4\uC6A9\uC744 \uC785\uB825\uD558\uC138\uC694</span>';
          previewDiv.classList.remove("hidden");
          previewBtn.textContent = "\uBBF8\uB9AC\uBCF4\uAE30 \uB2EB\uAE30";
        } else {
          previewDiv.classList.add("hidden");
          previewBtn.textContent = "\uBBF8\uB9AC\uBCF4\uAE30";
        }
      });
    }
    this.deleteAllMessagesBtn = document.getElementById("delete-all-messages-btn");
    this.deleteAllMessagesBtn?.addEventListener("click", () => this.deleteAllMessages());
    if (this.adminMessageInput) {
      this.adminMessageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendAdminBroadcast();
        }
      });
    }
    this.exportFilteredCsvBtn = document.getElementById("export-filtered-csv-btn");
    this.exportFilteredCsvBtn?.addEventListener("click", () => this.exportFilteredCsv());
    const _autoRefreshToggle = document.getElementById("auto-refresh-toggle");
    const autoRefreshIntervalSelect = document.getElementById("auto-refresh-interval");
    if (_autoRefreshToggle) {
      _autoRefreshToggle.addEventListener("change", (e) => {
        if (e.target.checked) {
          const interval = parseInt(autoRefreshIntervalSelect.value) * 1e3;
          this.startAutoRefresh(interval);
        } else {
          this.stopAutoRefresh();
        }
      });
    }
    if (autoRefreshIntervalSelect) {
      autoRefreshIntervalSelect.addEventListener("change", (e) => {
        if (_autoRefreshToggle && _autoRefreshToggle.checked) {
          this.stopAutoRefresh();
          const interval = parseInt(e.target.value) * 1e3;
          this.startAutoRefresh(interval);
        }
      });
    }
    const auditLogFilter = document.getElementById("audit-log-filter");
    if (auditLogFilter) {
      auditLogFilter.addEventListener("change", () => this.loadAuditLogs());
    }
    const exportAuditCsvBtn = document.getElementById("export-audit-csv-btn");
    if (exportAuditCsvBtn) {
      exportAuditCsvBtn.addEventListener("click", () => this.exportAuditLogCsv());
    }
    const clearAuditBtn = document.getElementById("clear-audit-logs-btn");
    if (clearAuditBtn) {
      clearAuditBtn.addEventListener("click", () => this.clearAuditLogs());
    }
    const deleteAdminLogsBtn = document.getElementById("delete-admin-logs-btn");
    if (deleteAdminLogsBtn) {
      deleteAdminLogsBtn.addEventListener("click", () => this.deleteAdminLogs());
    }
    const errorLogFilter = document.getElementById("error-log-filter");
    const errorLogSearch = document.getElementById("error-log-search");
    if (errorLogFilter) {
      errorLogFilter.addEventListener("change", () => {
        if (this._errorLogs) this.renderErrorLogs(this._errorLogs);
      });
    }
    if (errorLogSearch) {
      errorLogSearch.addEventListener("input", () => {
        if (this._errorLogs) this.renderErrorLogs(this._errorLogs);
      });
    }
    const userDetailsModal = document.getElementById("user-details-modal");
    if (userDetailsModal) {
      userDetailsModal.addEventListener("click", (e) => {
        if (e.target === userDetailsModal) hideModal(userDetailsModal);
      });
    }
    const announceSearch = document.getElementById("announce-search");
    if (announceSearch) {
      let searchTimer = null;
      announceSearch.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          const query = announceSearch.value.trim().toLowerCase();
          this.filterAnnouncements(query);
        }, 300);
      });
    }
    this.scheduleCheckbox = document.getElementById("schedule-checkbox");
    this.scheduleDatetime = document.getElementById("schedule-datetime");
    if (this.scheduleCheckbox && this.scheduleDatetime) {
      this.scheduleCheckbox.addEventListener("change", () => {
        this.scheduleDatetime.classList.toggle("hidden", !this.scheduleCheckbox.checked);
        if (this.scheduleCheckbox.checked && !this.scheduleDatetime.value) {
          const now = /* @__PURE__ */ new Date();
          now.setMinutes(now.getMinutes() + 5);
          this.scheduleDatetime.value = now.toISOString().slice(0, 16);
        }
      });
    }
    this.announceExpirySelect = document.getElementById("announce-expiry-select");
    if (this.adminAnnounceInput) {
      this.adminAnnounceInput.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          this.sendAdminAnnounce();
        }
      });
    }
  }
  async checkAuthentication() {
    if (this.sessionToken) {
      const isValid = await this.verifyToken(this.sessionToken);
      if (isValid) {
        this.showDashboard();
      } else {
        this.showLogin();
      }
    } else {
      this.showLogin();
    }
  }
  async handleLogin(e) {
    e.preventDefault();
    const id = document.getElementById("admin-id").value;
    const password = document.getElementById("admin-password").value;
    this.loginError.classList.add("hidden");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        this.sessionToken = data.token;
        api_client_default.setToken(data.token);
        localStorage.setItem("admin_token", data.token);
        this.showDashboard();
      } else {
        this.loginError.classList.remove("hidden");
        document.getElementById("admin-id").value = "";
        document.getElementById("admin-password").value = "";
      }
    } catch (_error) {
      this.loginError.classList.remove("hidden");
    }
  }
  async verifyToken(token) {
    try {
      const response = await fetch("/api/admin/verify", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      return response.ok;
    } catch (_error) {
      return false;
    }
  }
  handleLogout() {
    const token = localStorage.getItem("admin_token");
    if (token) {
      fetch("/api/admin/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      }).catch((err) => console.error("Logout error:", err));
    }
    localStorage.removeItem("admin_token");
    this.sessionToken = null;
    api_client_default.setToken(null);
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.showLogin();
  }
  showLogin() {
    this.loginScreen.classList.remove("hidden");
    this.adminDashboard.classList.add("hidden");
  }
  showDashboard() {
    this.loginScreen.classList.add("hidden");
    this.adminDashboard.classList.remove("hidden");
    this.refreshData();
    this.refreshInterval = setInterval(() => this.refreshData(), 5e3);
  }
  async refreshData() {
    try {
      const metricsResponse = await fetch("/api/admin/metrics", {
        headers: { "Authorization": `Bearer ${this.sessionToken}` }
      });
      if (!metricsResponse.ok) {
        if (metricsResponse.status === 401) {
          this.handleLogout();
          return;
        }
        throw new Error("Failed to fetch metrics");
      }
      const metrics = await metricsResponse.json();
      this.updateMetrics(metrics);
      const sessionsResponse = await fetch("/api/admin/sessions", {
        headers: { "Authorization": `Bearer ${this.sessionToken}` }
      });
      if (sessionsResponse.ok) {
        const sessions = await sessionsResponse.json();
        this.updateActiveSessions(sessions);
      }
      const messagesResponse = await fetch("/api/admin/messages", {
        headers: { "Authorization": `Bearer ${this.sessionToken}` }
      });
      if (messagesResponse.ok) {
        const messages = await messagesResponse.json();
        this.updateRecentMessages(messages);
      }
      await this.loadBannedIPs();
      await this.loadAuditLogs();
      await this.loadAnnouncements();
      await this.loadAdminLogs();
      await this.loadChannels();
      this.updateLastUpdated();
    } catch (_error) {
    }
  }
  formatFileSize(bytes) {
    return formatFileSize(bytes);
  }
  updateLastUpdated() {
    const timeStr = `\uB9C8\uC9C0\uB9C9 \uC5C5\uB370\uC774\uD2B8: ${(/* @__PURE__ */ new Date()).toLocaleTimeString("ko-KR")}`;
    document.getElementById("last-updated").textContent = timeStr;
    const mobileLastUpdated = document.getElementById("mobile-last-updated");
    if (mobileLastUpdated) {
      mobileLastUpdated.textContent = timeStr;
    }
  }
  truncateId(id) {
    if (!id) return "Unknown";
    return id.length > 20 ? id.substring(0, 20) + "..." : id;
  }
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1e3);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}\uC2DC\uAC04 \uC804`;
    if (minutes > 0) return `${minutes}\uBD84 \uC804`;
    return `${seconds}\uCD08 \uC804`;
  }
  escapeHtml(text) {
    return escapeHtml(text);
  }
  isValidUrl(url) {
    return isValidUrl(url);
  }
  sanitizeUrl(url) {
    return sanitizeUrl(url);
  }
  startAutoRefresh(interval) {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }
    this.autoRefreshInterval = setInterval(() => this.refreshData(), interval);
  }
  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }
  showNotification(message, type = "info") {
    try {
      const containerId = "admin-notifications-container";
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        container.style.position = "fixed";
        container.style.top = "1rem";
        container.style.right = "1rem";
        container.style.zIndex = "9999";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "0.5rem";
        document.body.appendChild(container);
      }
      const colorClass = {
        success: "background: #16a34a; color: #fff;",
        error: "background: #dc2626; color: #fff;",
        warn: "background: #d97706; color: #fff;",
        info: "background: #374151; color: #fff;"
      }[type] || "background: #374151; color: #fff;";
      const el = document.createElement("div");
      el.setAttribute("role", "status");
      el.style.cssText = `padding:8px 12px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.4);max-width:320px;${colorClass}`;
      el.textContent = message;
      container.appendChild(el);
      setTimeout(() => {
        el.style.transition = "opacity 300ms ease, transform 300ms ease";
        el.style.opacity = "0";
        el.style.transform = "translateY(-6px)";
        setTimeout(() => el.remove(), 350);
      }, 3e3);
    } catch (_err) {
    }
  }
};
Object.assign(AdminDashboard.prototype, admin_data_default, admin_render_default);
window.adminDashboard = new AdminDashboard();
