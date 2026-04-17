const ACTIONS = {
  JOIN: "join",
  JOINED: "joined",
  DISCONNECTED: "disconnected",
  CODE_CHANGE: "code-change",
  SYNC_CODE: "sync-code",
  LEAVE: "leave",
  LANGUAGE_CHANGE: "language-change",
  // Video Conferencing events
  JOIN_VIDEO: "join-video",
  VIDEO_USER_JOINED: "video-user-joined",
  VIDEO_OFFER: "video-offer",
  VIDEO_ANSWER: "video-answer",
  VIDEO_ICE: "video-ice",
  LEAVE_VIDEO: "leave-video",
  VIDEO_USER_LEFT: "video-user-left",
  // Admin events
  ROOM_ADMIN: "room-admin",
  LOCK_EDITOR: "lock-editor",
  MUTE_ALL_VIDEO: "mute-all-video",
  LOCK_ALL_CAMERAS: "lock-all-cameras"
};

module.exports = ACTIONS;
