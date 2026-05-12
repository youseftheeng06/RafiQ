# Full Project Changelog

This file combines the main project changes made across the recent work on rooms, WebSocket chat, room members, profile separation, room calls, OAuth login, and the later live file and voice-note fixes.

Date range covered:
- 27/04
- 28/04
- 29/04
- 03/05

## Summary

The main direction of the work was to move the room feature from local-browser behavior to real backend behavior.

The biggest goals were:
- make rooms work with backend IDs
- make room chat use WebSocket instead of only `localStorage`
- load old room messages after refresh
- manage room members through backend APIs
- make room media uploads appear live without refresh
- stop voice notes from being local-only browser blobs
- separate browser profile state per logged-in user
- add room call support
- add Google/GitHub login and bridge it into the frontend session model

## Feature Story: Rooms and WebSocket From Start to End

At the beginning of this feature, the room system looked like a room system in the UI, but most of it was still local browser behavior.

What existed early:
- the backend already had WebSocket config and chat handling
- the frontend already had room pages and room UI
- some room data existed in browser storage

What was broken early:
- the room page was not properly connected to WebSocket
- rooms were still being treated as local browser objects
- messages were being stored locally instead of really shared
- opening the page again could make the room look empty
- the members section was not truly connected to backend membership
- uploaded files and images were not live
- voice notes were not really sent to other users

The rest of this file explains how those problems were fixed step by step.

## 1. Rooms and WebSocket Integration

Why:
- rooms and chat were previously mostly local browser data
- WebSocket backend existed, but the frontend was not properly connected

### Frontend

#### `Company_System_4-front/room.html`
- Added SockJS and STOMP imports so the room page can open a real WebSocket connection.
- Added socket state for the active room subscription.
- Added cleanup logic when switching rooms or leaving the page.
- Added room-topic subscription logic.
- Added incoming room-message mapping into the existing room UI.

#### `Company_System_4-front/JS/master.js`
- Changed room creation to create backend rooms first so each room has a real DB `id`.
- Changed room opening to preload room messages and room members before rendering.
- Changed text sending to use WebSocket for backend rooms.
- Kept only fallback behavior for unsaved local rooms.
- Updated message rendering to show the sender name.
- Added backend room loading on page startup.

### Backend

#### `Company_System_4-backend/src/main/java/com/example/demo/controller/ChatController.java`
- Added `GET /api/messages/room/{roomId}` using the existing chat payload shape.

Purpose:
- makes room chat actually shared instead of only local
- fixes the issue where refreshing the room page could hide visible chat history
- keeps live WebSocket messages and REST history aligned

## 2. Room Membership

Why:
- rooms needed real membership support instead of only UI text
- membership was needed for room management and later room calls

### Backend

#### `Company_System_4-backend/src/main/java/com/example/demo/model/Room.java`
- Added the `members` relation with `@ManyToMany`.

#### `Company_System_4-backend/src/main/java/com/example/demo/service/RoomService.java`
- Made the room creator the first member automatically.
- Added add-member logic.
- Added remove-member logic.
- Restricted room-member management by role.
- Explicitly blocked developers from adding or removing members.

#### `Company_System_4-backend/src/main/java/com/example/demo/controller/RoomController.java`
- Added `GET /api/rooms/{roomId}/members`
- Added `POST /api/rooms/{roomId}/members/by-staff/{staffId}`
- Added `DELETE /api/rooms/{roomId}/members/{memberId}`

### Frontend

#### `Company_System_4-front/room.html`
- Added room member action buttons in the right-side panel.

#### `Company_System_4-front/JS/master.js`
- Added member-list rendering.
- Added room-member fetching.
- Added add-member flow using `staffId`.
- Added remove-member flow.

Purpose:
- lets rooms manage real members through the database
- connects the members panel to real backend data

### Membership problems solved

- At first, member management did not exist in the backend.
- Then the add-member flow depended on internal numeric `userId`, which did not match the visible project identity flow.
- The add flow was changed to use `staffId`, which matches the rest of the project better.

## 3. Room History After Refresh

Why:
- the room could look empty after refresh even though messages were already saved

### Frontend

#### `Company_System_4-front/JS/master.js`
- Made room opening load old room messages from the backend before rendering the room.

### Backend

#### `Company_System_4-backend/src/main/java/com/example/demo/controller/ChatController.java`
- Exposed old room messages through `GET /api/messages/room/{roomId}`.

Purpose:
- restores room history after refresh
- keeps saved room messages visible when reopening a room

## 4. Live File, Image, and Voice-Note Delivery

Why:
- text chat was live, but uploaded images and files were not live
- uploaded media often needed page refresh to appear
- recorded voice notes were not truly sent to other users

### Problem before the fix

Files and voice notes were already stored through the backend file flow, but:
- uploads were handled by REST only
- the room was not notified live after upload
- recorded voice notes were saved as local browser `blob:` URLs
- other users could not use those local `blob:` URLs

So the sender could think a voice note was sent, while in reality it only existed in that browser session.

### Frontend

#### `Company_System_4-front/JS/master.js`
- Refactored room-file upload into a shared upload helper.
- Changed normal room uploads to use the shared helper consistently.
- Changed recorded voice notes to upload as real files instead of staying local object URLs.
- Removed the sender-side local insert for uploaded media to avoid duplicate messages after the room broadcast.

#### `Company_System_4-front/room.html`
- Extended incoming room WebSocket mapping so file events can render as:
  - image
  - video
  - audio
  - generic file

### Backend

#### `Company_System_4-backend/src/main/java/com/example/demo/controller/FileResourceController.java`
- After upload, the backend now broadcasts a room WebSocket event.

#### `Company_System_4-backend/src/main/java/com/example/demo/websocket/ChatMessage.java`
- Extended the room chat payload to carry file event data such as file name and file type.

Purpose:
- fixes the issue where images only appeared after refresh
- fixes the issue where voice notes were only local and not really shared
- makes media delivery behave like real room chat instead of separate hidden storage

## 5. Profile Isolation Fix

Why:
- different users logging in on the same browser were seeing the same profile state

### Frontend

#### `Company_System_4-front/JS/master.js`
- Changed browser profile storage behavior so each logged-in user has separate profile state.
- Updated navbar/profile loading to respect the current user.
- Updated profile and cover removal flows to affect only the current user.

Purpose:
- prevents one browser account from visually overwriting another
- keeps browser profile state separate per logged-in user

### Problem solved here

Before this fix, two different users could log in on the same browser and still look like one profile. After this fix, that browser-side mix-up stopped happening.

## 6. ZEGOCLOUD Room Call Support

Why:
- room calls needed a backend-issued session tied to room membership

### Backend

#### `Company_System_4-backend/src/main/java/com/example/demo/service/RoomService.java`
- Added ZEGOCLOUD config fields.
- Added room call-session creation logic.

#### `Company_System_4-backend/src/main/java/com/example/demo/controller/RoomController.java`
- Added `POST /api/rooms/{roomId}/video-call-session`

#### `Company_System_4-backend/src/main/resources/application.properties`
- Added ZEGOCLOUD configuration properties.

### Frontend

#### `Company_System_4-front/room.html`
- Added the room call overlay and SDK import.

#### `Company_System_4-front/JS/master.js`
- Added room-call start flow that requests the backend session and opens the call UI.

Purpose:
- makes room calls tied to backend room identity instead of frontend-only assumptions

## 7. Google and GitHub Login

Why:
- the project needed social login
- the frontend also needed to understand that a successful OAuth login means a real logged-in app user

### Backend

#### `Company_System_4-backend/pom.xml`
- Added Spring Boot OAuth2 client support.

#### `Company_System_4-backend/src/main/resources/application.properties`
- Added OAuth client configuration fields.

#### `Company_System_4-backend/src/main/java/com/example/demo/config/SecurityConfig.java`
- Added OAuth success handling.
- Redirected successful OAuth login back into the frontend flow.

#### `Company_System_4-backend/src/main/java/com/example/demo/service/AuthService.java`
- Added logic to link or create a local app user for OAuth accounts.
- Added logic to build the frontend success payload.

### Frontend

#### `Company_System_4-front/login.html`
- Added Google and GitHub buttons.

#### `Company_System_4-front/login_page/master.css`
- Added social-login styling matching the current login design.

#### `Company_System_4-front/JS/master.js`
- Added social-login redirect start.
- Added OAuth-success parsing and session creation in the browser.

Purpose:
- lets Google/GitHub login become part of the same frontend app-session model used elsewhere

## 8. Email OTP Login Verification

Why:
- the project needed an email verification step in login

### Backend

#### `Company_System_4-backend/src/main/java/com/example/demo/service/EmailService.java`
- Added login OTP email sending.

#### `Company_System_4-backend/src/main/java/com/example/demo/service/EmailOtpService.java`
- Added OTP generation, verification, and cleanup.

#### `Company_System_4-backend/src/main/java/com/example/demo/service/AuthService.java`
- Added login initiation, login verification, login cancellation, and masked email handling.

#### `Company_System_4-backend/src/main/java/com/example/demo/controller/AuthController.java`
- Added login-initiate, login-verify, and login-cancel endpoints.

#### `Company_System_4-backend/src/main/java/com/example/demo/controller/ApiExceptionHandler.java`
- Added readable runtime error responses.

### Frontend

#### `Company_System_4-front/JS/master.js`
- Added the two-step login flow.
- Added pending login data stored between login page and OTP page.
- Added OTP submission and cancellation logic.

#### `Company_System_4-front/twofactor.html`
- Added the email verification page.

Purpose:
- splits login into main credentials first, then email verification

## What Was Done Today For Rooms/WebSocket

Todayâ€™s room/chat work focused on the final live-delivery problems rather than the original text WebSocket hookup.

Completed today:
- analyzed why voice notes were not being sent properly
- confirmed that file and voice-note records were already stored through backend file storage
- fixed the voice-note path so recorded audio no longer stays only as a local browser URL
- fixed the image/file live-update problem by broadcasting file uploads over the room WebSocket
- extended the room WebSocket message mapping so file events are rendered immediately

The practical result for the room feature now is:
- text messages work live
- room history can load after refresh
- room members are backend-managed
- uploaded files and images can appear live
- voice notes now follow the backend upload flow instead of staying browser-local

## What We Did Together In Chat

This is the plain-language story of the work done together for this feature:

1. We checked whether the room/WebSocket issue was backend or frontend.
2. We confirmed the main break was frontend integration, while backend still had some missing pieces.
3. We wired the room frontend to the existing WebSocket backend.
4. We added backend-backed room-member management.
5. We switched the add-member flow to use `staffId`.
6. We fixed the browser profile mix-up where different users looked like the same profile.
7. We added old-room-message loading so refresh would not make the room look empty.
8. We added room call/session support.
9. We added Google/GitHub login and made the frontend understand the OAuth login state.
10. We investigated why voice notes and uploaded images were not behaving like live room messages.
11. We fixed live file broadcasting and voice-note sending so room media behaves like shared chat.

## Main Problems Encountered During This Feature

- The room UI existed before the room backend integration was fully wired.
- WebSocket backend support existed before the room page actually subscribed and sent to it.
- Refreshing the room page hid old messages because the frontend rebuilt room state locally.
- Member management first lacked a backend flow.
- Staff-based identity in the UI did not match the early user-ID-based member flow.
- File uploads were stored through REST, but they were not announced live to the room.
- Voice notes looked sent in the sender browser but were really just local object URLs.
- Shared browser profile storage made different users look like the same account.

## End State Of The Rooms/WebSocket Feature

By the end of the room/WebSocket work, the feature moved from mostly local mock behavior to a backend-connected room system with:
- backend room creation and loading
- room member APIs
- room history loading
- live text chat through WebSocket
- live file/image/audio event rendering
- uploaded voice notes using backend file storage instead of local-only browser blobs

What still remains outside the core room feature:
- some unrelated `localStorage` usage still exists in `master.js`
- backend access control can still be tightened more in some places
- deployment and config cleanup is still needed for production use

## Main Files Changed Across This Work

### Backend
- `Company_System_4-backend/pom.xml`
- `Company_System_4-backend/src/main/java/com/example/demo/config/SecurityConfig.java`
- `Company_System_4-backend/src/main/java/com/example/demo/model/Room.java`
- `Company_System_4-backend/src/main/java/com/example/demo/service/RoomService.java`
- `Company_System_4-backend/src/main/java/com/example/demo/service/AuthService.java`
- `Company_System_4-backend/src/main/java/com/example/demo/service/EmailService.java`
- `Company_System_4-backend/src/main/java/com/example/demo/service/EmailOtpService.java`
- `Company_System_4-backend/src/main/java/com/example/demo/controller/RoomController.java`
- `Company_System_4-backend/src/main/java/com/example/demo/controller/ChatController.java`
- `Company_System_4-backend/src/main/java/com/example/demo/controller/FileResourceController.java`
- `Company_System_4-backend/src/main/java/com/example/demo/controller/AuthController.java`
- `Company_System_4-backend/src/main/java/com/example/demo/controller/ApiExceptionHandler.java`
- `Company_System_4-backend/src/main/resources/application.properties`

### Frontend
- `Company_System_4-front/room.html`
- `Company_System_4-front/JS/master.js`
- `Company_System_4-front/login.html`
- `Company_System_4-front/login_page/master.css`
- `Company_System_4-front/twofactor.html`

## Current Behavioral Notes

- A brand-new OAuth-created user is currently created with role `DEVELOPER`.
- Because room creation is manager-only, new OAuth users cannot create rooms unless their role is changed later.
- The room system is much more backend-connected now, but `master.js` still contains `localStorage` usage for unrelated features and some fallback behavior.
- The OAuth redirect base URL is still a local URL and should be updated if the hosting structure changes.
- Sensitive values in config should be rotated or moved to environment variables before sharing publicly.

This file is the combined timeline-style summary that now includes:
- the original room/WebSocket work
- room members and room history
- live file and voice-note delivery fixes
- profile isolation
- room calls
- Google/GitHub login changes
