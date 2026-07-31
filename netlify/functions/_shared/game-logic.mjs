const lower = value => String(value ?? "").toLowerCase();
const hasAny = (text, items) => items.some(item => lower(text).includes(item));
const countAny = (text, items) => items.reduce((n, item) => n + (lower(text).includes(item) ? 1 : 0), 0);

export const evidenceForStation = {
  s1: {
    code: "1977",
    evidence: {
      A: "Sam falsely claimed that the Golden Record contained only Western classical music."
    },
    targets: ["evidence-language", "reading-concepts", "mystery-language"]
  },
  s2: {
    code: "RISE",
    evidence: {
      B: "Streaming increased dramatically, so Sam’s claim that it declined was impossible."
    },
    targets: ["trend-language"]
  },
  s3: {
    code: "FOCUS-8",
    evidence: {
      C: "Hana Harmony was conducting the library soundscape experiment.",
      D: "Theo Tempo was leading the aerobics class in front of witnesses."
    },
    targets: ["recommendation", "prediction", "sound-vocabulary"]
  },
  s4: {
    code: "CONSOLE-4",
    evidence: {
      E: "The corrupted loop was uploaded from STREAM-CONSOLE-4."
    },
    targets: ["music-vocabulary"]
  }
};

function fail(feedback, details = {}) {
  return { accepted: false, autoApprove: false, feedback, details };
}

function pending(feedback, details = {}) {
  return { accepted: true, autoApprove: false, feedback, details };
}

function approved(feedback, details = {}) {
  return { accepted: true, autoApprove: true, feedback, details };
}

export function checkSubmission(station, payload = {}) {
  if (station === "s1") {
    const answers = payload.answers || {};
    const objective = answers.v1 === "b" && answers.v2 === "a" && answers.v3 === "b" && answers.v4 === "b";
    if (!objective) return fail("Recheck the four reading answers before resubmitting.", { objective: false });
    const reason = String(payload.reason || "");
    const evidencePhrase = hasAny(reason, ["according to", "the evidence suggests", "contradicts", "contradiction"]);
    const contrast = hasAny(reason, ["only western", "only classical"]) && hasAny(reason, ["different", "variety", "beethoven", "rock", "mariachi", "genres", "cultures"]);
    if (reason.trim().length < 45 || !evidencePhrase || !contrast) {
      return fail("Your reading answers are correct. Revise the explanation so it clearly contrasts Sam’s claim with the different genres or cultures named in the reading and uses evidence language.", { objective: true });
    }
    return pending("Objective answers passed. Your explanation is waiting for teacher approval.", { objective: true, languageGate: true });
  }

  if (station === "s2") {
    const answers = payload.answers || {};
    const objective = answers.trend1 === "increased dramatically" && answers.trend2 === "fell steadily" && answers.trend3 === "rose gradually" && answers.trend4 === "rose sharply and then declined";
    if (!objective) return fail("At least one graph description is incorrect. Recheck all four trends.", { objective: false });
    const verb = lower(payload.verbTrend);
    const noun = lower(payload.nounTrend);
    const verbOK = verb.includes("streaming") && hasAny(verb, ["increased", "rose", "grew"]) && hasAny(verb, ["dramatically", "significantly", "sharply"]) && !hasAny(verb, ["decreased", "declined", "fell"]);
    const nounOK = noun.includes("streaming") && hasAny(noun, ["there was", "there has been"]) && hasAny(noun, ["dramatic", "significant", "sharp"]) && hasAny(noun, ["increase", "rise", "growth"]);
    if (!verbOK || !nounOK) {
      return fail("The graph choices are correct. Revise both trend sentences: one must use verb + adverb, and the rewrite must use adjective + trend noun.", { objective: true, verbOK, nounOK });
    }
    return pending("Trend structures passed the automatic check and are waiting for teacher approval.", { objective: true, verbOK: true, nounOK: true });
  }

  if (station === "s3") {
    const answers = payload.answers || {};
    const objective = answers.sound1 === "a" && answers.sound2 === "b" && answers.sound3 === "a";
    if (!objective) return fail("Recheck the three soundscape choices.", { objective: false });
    const text = lower(payload.recommendation);
    const recommendation = hasAny(text, ["i would recommend", "i recommend", "i propose that", "how about if", "it might be a good idea"]);
    const reason = text.includes("because") || text.includes("since");
    const prediction = hasAny(text, ["it's likely", "it is likely", "i expect", "i'm convinced", "i am convinced", "wouldn't be surprised", "will"]);
    const soundWords = countAny(text, ["soothing", "relaxing", "upbeat", "energizing", "distracting", "stressful", "tempo", "rhythm", "lyrics", "instrumental"]);
    if (!recommendation || !reason || !prediction || soundWords < 2) {
      return fail("Your choices are correct. Revise the report to include a recommendation, a reason, a predicted outcome, and at least two sound-related target words.", { objective: true, recommendation, reason, prediction, soundWords });
    }
    return pending("Soundscape choices and language features passed. Your recommendation is waiting for teacher approval.", { objective: true, recommendation: true, reason: true, prediction: true, soundWords });
  }

  if (station === "s4") {
    const matches = Array.isArray(payload.matches) ? [...new Set(payload.matches.map(Number))] : [];
    if (matches.length !== 9 || !matches.every(n => Number.isInteger(n) && n >= 0 && n <= 8)) {
      return fail("Restore all nine vocabulary connections before submitting.", { matches: matches.length });
    }
    return approved("All nine natural chunks were restored. Evidence E is unlocked automatically.", { matches: 9 });
  }

  if (station === "final") {
    const culprit = String(payload.culprit || "");
    const evidence = Array.isArray(payload.evidence) ? payload.evidence.map(String) : [];
    const reason = String(payload.reason || "");
    const prevention = String(payload.prevention || "");
    const objective = culprit === "Sam Stream" && evidence.length >= 3 && evidence.includes("E") && (evidence.includes("A") || evidence.includes("B"));
    if (!objective) return fail("Reconsider the culprit or select at least three relevant clues, including Evidence E and either A or B.", { objective: false });
    const reasoning = reason.trim().length >= 75 && hasAny(reason, ["according to", "evidence suggests", "contradicts", "contradiction", "therefore"]);
    const recommendation = hasAny(prevention, ["recommend", "propose", "good idea"]) && hasAny(prevention, ["because", "since"]) && hasAny(prevention, ["it's likely", "it is likely", "i expect", "will"]);
    const vocabulary = countAny(`${reason} ${prevention}`, ["evidence", "contradiction", "alibi", "sabotage", "transmission", "streaming", "golden record", "playlist", "track", "outcome", "predict", "culprit"]);
    if (!reasoning || !recommendation || vocabulary < 4) {
      return fail("Strengthen the final case with evidence-linking language, a justified recommendation, a predicted outcome, and at least four target terms.", { objective: true, reasoning, recommendation, vocabulary });
    }
    return pending("The case meets the automatic criteria and is waiting for the teacher’s final verdict.", { objective: true, reasoning: true, recommendation: true, vocabulary });
  }

  return fail("Unknown station.");
}

export function stationProgress(group = {}) {
  const stations = group.stations || {};
  const approved = ["s1", "s2", "s3", "s4"].filter(k => stations[k]?.status === "approved").length;
  const finalApproved = stations.final?.status === "approved";
  return {
    approvedStations: approved,
    progress: Math.round(((approved + (finalApproved ? 1 : 0)) / 5) * 100),
    completed: finalApproved
  };
}
