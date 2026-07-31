import assert from "node:assert/strict";
import { checkSubmission, stationProgress } from "../netlify/functions/_shared/game-logic.mjs";

const s1 = checkSubmission("s1", {
  answers: { v1: "b", v2: "a", v3: "b", v4: "b" },
  reason: "Sam's claim does not match the reading because the collection included music from different cultures."
});
assert.equal(s1.accepted, true);
assert.equal(s1.autoApprove, false);

const s2 = checkSubmission("s2", {
  answers: {
    trend1: "increased dramatically",
    trend2: "fell steadily",
    trend3: "rose gradually",
    trend4: "rose sharply and then declined"
  },
  verbTrend: "Streaming increased dramatically from 2010 to 2020.",
  nounTrend: "There was a dramatic increase in streaming."
});
assert.equal(s2.accepted, true);
assert.equal(s2.autoApprove, false);

const s4 = checkSubmission("s4", {
  matches: [0,1,2,3,4,5,6,7,8],
  vocabUse: "The track has a steady beat. It also has a catchy melody. The distracting lyrics make it unsuitable for studying."
});
assert.equal(s4.accepted, true);
assert.equal(s4.autoApprove, false);

const s5 = checkSubmission("s5", {
  version: "B",
  justification: "Version B has the same tempo, electronic bass and distorted ending as the corrupted file, unlike Version A."
});
assert.equal(s5.accepted, true);

const s6 = checkSubmission("s6", {
  order: ["E", "F", "A", "B", "C", "D"],
  access: "Sam Stream",
  explanation: "Sam's account logged in after the console was locked and immediately before the playlist was edited."
});
assert.equal(s6.accepted, true);

const finalCase = checkSubmission("final", {
  culprit: "Sam Stream",
  evidence: ["A", "B", "E", "G"],
  reason: "The statements in Evidence A and B are unreliable, while Evidence E identifies the upload device and Evidence G places Sam's account on the system immediately before the edit. Together, these clues support our accusation.",
  prevention: "We recommend individual access codes and automatic login records because they will make future changes easier to trace."
});
assert.equal(finalCase.accepted, true);
assert.equal(finalCase.autoApprove, false);

assert.deepEqual(stationProgress({ assignedStation: "s3", stations: { s3: { status: "approved" }, final: { status: "locked" } } }), {
  approvedStations: 1,
  progress: 50,
  completed: false
});

console.log("Game logic tests passed.");
