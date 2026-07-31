# Deploy the six-station parallel version

This version changes both the website and Firebase data structure. Deploy all files together.

## Files changed

- `index.html`
- `teacher.html`
- `firebase.rules.json`
- `package.json`
- `netlify.toml`
- `README.md`
- `tests/game-logic.test.mjs`
- `netlify/functions/create-session.mjs`
- `netlify/functions/join-session.mjs`
- `netlify/functions/submit-answer.mjs`
- `netlify/functions/review-answer.mjs`
- `netlify/functions/teacher-action.mjs`
- `netlify/functions/_shared/game-logic.mjs`

## Required deployment steps

1. Replace the matching files in the GitHub repository while preserving their folder paths.
2. Commit the changes. Netlify should start a new deployment automatically.
3. In Firebase Realtime Database, replace the Rules with `firebase.rules.json` and click **Publish**. The new `shared` path must be readable by authenticated class members.
4. Wait until Netlify reports **Published**.
5. Create a **new teacher session**. Sessions created by the old four-station build are not compatible.
6. Join six groups in the desired station order. The first group receives Station 1, the second receives Station 2, and so on.

## Assessment behaviour

No AI evaluates student writing.

- Fixed-answer puzzle parts are checked automatically.
- Open-ended explanations are checked only for completion and then sent to the teacher.
- The teacher approves or returns every open response, including the final accusation.
