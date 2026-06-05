/**
 * @fileoverview Shared type definitions for server-client message contracts.
 * All message types exchanged between the client and Cloudflare Worker/Durable Objects.
 *
 * @typedef {Object} ReplyInfo
 * @property {string} messageId - ID of the message being replied to
 * @property {string} sessionId - Session ID of the original message sender
 * @property {string} nickname - Nickname of the original sender
 * @property {string} content - Truncated content preview of the replied message
 * @property {string} [contentType] - Type of the replied message content
 *
 * @typedef {Object} ReactionInfo
 * @property {string} emoji - The reaction emoji character
 * @property {string[]} sessionIds - Array of session IDs who added this reaction
 * @property {number} count - Number of users who reacted with this emoji
 *
 * @typedef {Object} FileInfo
 * @property {string} url - File download/view URL
 * @property {string} filename - Sanitized file name
 * @property {number|null} filesize - File size in bytes
 * @property {string} filetype - MIME type or extension
 *
 * @typedef {Object} ServerMessage
 * @property {"chat"|"announcement"|"system"|"error"|"reaction"|"typing"|"pong"} type - Message category
 * @property {string} id - Unique message ID
 * @property {string} sessionId - Sender's session ID
 * @property {string} nickname - Sender's display name
 * @property {"text"|"image"|"file"} contentType - Content format
 * @property {string} content - Message body text
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {FileInfo} [file] - Single file attachment
 * @property {FileInfo[]} [files] - Multiple file attachments
 * @property {boolean} [isEdited] - Whether the message has been edited
 * @property {number} [editedAt] - Timestamp of last edit
 * @property {ReplyInfo} [replyTo] - Reply chain information
 * @property {Object<string,ReactionInfo>} [reactions] - Reactions keyed by emoji
 *
 * @typedef {Object} ClientMessage
 * @property {"chat"|"reaction"|"typing"|"search"|"export"|"ping"|"edit"|"delete"} type - Action type
 * @property {string} [content] - Message text content
 * @property {"text"|"image"|"file"} [contentType] - Content format
 * @property {FileInfo} [file] - Single file attachment
 * @property {FileInfo[]} [files] - Multiple file attachments
 * @property {string} [replyTo] - Message ID being replied to
 * @property {string} [query] - Search query string
 * @property {string} [exportFormat] - Export format ("csv"|"json")
 * @property {string} [messageId] - Target message ID for edit/delete/reaction
 * @property {string} [emoji] - Reaction emoji character
 * @property {boolean} [isTyping] - Typing indicator state
 *
 * @typedef {Object} Announcement
 * @property {string} id - Unique announcement ID
 * @property {string} content - Announcement text
 * @property {"normal"|"emergency"} type - Announcement priority
 * @property {number} timestamp - Creation timestamp
 * @property {boolean} [isActive] - Whether currently displayed
 *
 * @typedef {Object} ChannelInfo
 * @property {string} slug - Channel identifier slug
 * @property {string} name - Display name
 * @property {number} userCount - Current connected user count
 * @property {number} messageCount - Total messages in channel
 * @property {number} createdAt - Channel creation timestamp
 *
 * @typedef {Object} BanInfo
 * @property {string} target - IP address or session ID
 * @property {"ip"|"session"} type - Ban target type
 * @property {string} reason - Reason for ban
 * @property {number} bannedAt - Ban timestamp
 * @property {number} [duration] - Ban duration in milliseconds (null = permanent)
 * @property {number} [bannedUntil] - Expiry timestamp
 *
 * @typedef {Object} SessionMetadata
 * @property {string} ip - Client IP address
 * @property {number} joinTime - Connection timestamp
 * @property {number} messageCount - Messages sent this session
 * @property {number} lastMessageTime - Timestamp of last message
 * @property {string} [nickname] - User's selected nickname
 * @property {number} [lastActive] - Last activity timestamp
 *
 * @typedef {Object} AuditLogEntry
 * @property {"edit_message"|"admin_delete_message"|"admin_kick"|"ban"|"unban"|"send_announcement"|"edit_announcement"|"delete_announcement"|"delete_channel"} type - Action type
 * @property {string} description - Human-readable description
 * @property {Object<string,*>} [data] - Additional context data
 * @property {number} timestamp - Action timestamp
 *
 * @typedef {Object} ErrorLogEntry
 * @property {string} message - Error message
 * @property {string} [stack] - Error stack trace
 * @property {Object<string,*>} [context] - Additional error context
 * @property {number} timestamp - Error occurrence timestamp
 */

export default {};
