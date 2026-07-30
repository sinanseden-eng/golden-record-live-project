# The Golden Record Blackout — Live Classroom Edition

A Netlify-ready, real-time classroom mystery for Oxford Discover Futures 4 Unit 1.

## What is included

- `index.html` — student mission page for group iPads
- `teacher.html` — live teacher dashboard for the projector
- `netlify/functions/` — secure session, checking, approval, and teacher-control endpoints
- `firebase.rules.json` — Realtime Database rules limiting students to their own group
- `netlify.toml` — Netlify publish, functions, and security-header configuration
- `tests/game-logic.test.mjs` — checks for the server-side language gates

## Classroom workflow

1. The teacher opens `/teacher.html` and creates a session.
2. The dashboard displays a code such as `MUSIC-ABC`.
3. Each group opens `/` on one iPad and joins with a group name.
4. Objective errors are returned immediately.
5. Reading explanations, trend writing, recommendations, and the final case enter the teacher approval queue.
6. Approved work unlocks evidence and codes on the group iPad and updates the projected dashboard in real time.

## Firebase setup

1. Create a Firebase project and register a Web app.
2. Create a Realtime Database.
3. In Firebase Authentication, make sure Authentication is initialized for the project. The app uses secure custom-token sign-in, so students do not need accounts or email addresses.
4. In Project settings → Service accounts, generate a private key. Keep it outside the repository.
5. Install the Firebase CLI and deploy the supplied rules:

```bash
firebase login
firebase use --add
firebase deploy --only database
```

The rules allow a teacher token to read the whole session and a student token to read only its own group plus public session status.

## Netlify setup

Connect this folder or its GitHub repository to Netlify.

- Build command: leave blank
- Publish directory: `.`
- Functions directory: already configured as `netlify/functions`

Add these environment variables in Netlify’s Environment variables page. Give the server-only fields Functions scope when scope controls are available.

```text
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_DATABASE_URL
FIREBASE_PROJECT_ID
FIREBASE_APP_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
CLASS_ADMIN_KEY
```

Use the values shown in `.env.example`. Do not commit a real private key. For `FIREBASE_PRIVATE_KEY`, paste the key with newline characters preserved or encoded as `\n`; the server normalizes either common format.

Redeploy after adding or changing environment variables.

## URLs

```text
Student groups: https://YOUR-SITE.netlify.app/
Teacher dashboard: https://YOUR-SITE.netlify.app/teacher.html
```

## Teacher controls

- start, pause, and resume the shared mission timer
- approve or return productive-language answers
- broadcast a hint to every iPad
- hide or show evidence codes on the projector
- add or remove bonus points
- reset one group
- close or reopen the session
- export progress as CSV

## Marking model

Automatically checked:

- fixed reading selections
- graph descriptions
- soundscape choices
- vocabulary matching
- basic presence of required language structures

Teacher-reviewed:

- Evidence 1 contradiction explanation
- Evidence 2 trend sentences
- Evidence 3 recommendation and prediction
- final evidence-based accusation

This prevents the website from approving sentences merely because they contain a target word.

## Local checks

```bash
npm install
npm test
netlify dev
```

`netlify dev` is needed for the Functions routes. A plain file server can display the pages but cannot create live sessions.

## Data and privacy

Use group names rather than students’ full names. Student answers are visible to the teacher and their own group only. The project does not request camera, microphone, location, contacts, or personal email addresses.
