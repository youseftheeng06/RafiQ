# Frontend Change Notes

This file lists the frontend changes made for rooms, WebSocket chat, members, message history, and per-user profile storage.

## Files changed

- `room.html`
- `JS/master.js`

## Change list

- `room.html:165` Added SockJS and STOMP script imports for backend WebSocket support.
- `room.html:170` Added shared socket/subscription state for room switching.
- `room.html:180` Added socket cleanup before reconnect/unload.
- `room.html:195` Added room-topic subscription logic for live messages.
- `room.html:215` Added WebSocket message normalization into the existing room UI.
- `JS/master.js:174` Updated room creation to create backend rooms first and fall back locally only on failure.
- `JS/master.js:274` Updated room opening to load old backend messages and room members before rendering.
- `JS/master.js:323` Updated text sending to use WebSocket for backend rooms.
- `JS/master.js:364` Updated message rendering to show `senderName` above text messages.
- `JS/master.js:443` Added old-message loading from `GET /api/messages/room/{roomId}`.
- `JS/master.js:477` Added room member list rendering.
- `JS/master.js:499` Added room member fetch for the selected backend room.
- `JS/master.js:532` Added member add flow using staff ID.
- `JS/master.js:570` Added member remove flow.
- `JS/master.js:600` Added backend room loading on startup.
- `JS/master.js:837` Updated app bootstrap to wait for backend rooms before rendering.
- `JS/master.js:875` Added per-user profile storage helpers to stop profile mixing between accounts.
- `JS/master.js:1238` Updated navbar profile loading to use per-user storage.
- `JS/master.js:1609` Updated profile photo removal to affect only the current user.
- `JS/master.js:1626` Updated cover photo removal to affect only the current user.

## Send to team

Use the line-referenced assistant summary after this file is generated, or copy the file links directly from the final handoff message.
