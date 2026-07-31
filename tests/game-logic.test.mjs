import assert from "node:assert/strict";
import { checkSubmission } from "../netlify/functions/_shared/game-logic.mjs";

const s1 = checkSubmission("s1", {
  answers: { v1: "b", v2: "a", v3: "b", v4: "b" },
  reason: "According to the reading, Sam claimed the record contained only Western classical music, but it included different genres such as rock and Mariachi."
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
  verbTrend: "Streaming increased dramatically between 2010 and 2020.",
  nounTrend: "There was a dramatic increase in streaming between 2010 and 2020."
});
assert.equal(s2.accepted, true);

const wrongTrend = checkSubmission("s2", {
  answers: {
    trend1: "increased dramatically",
    trend2: "fell steadily",
    trend3: "rose gradually",
    trend4: "rose sharply and then declined"
  },
  verbTrend: "Streaming declined dramatically.",
  nounTrend: "There was a dramatic decline in streaming."
});
assert.equal(wrongTrend.accepted, false);

const s4 = checkSubmission("s4", { matches: [0,1,2,3,4,5,6,7,8] });
assert.equal(s4.autoApprove, true);

console.log("Game logic tests passed.");
