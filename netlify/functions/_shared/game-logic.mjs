export const INVESTIGATION_STATIONS = ["s1", "s2", "s3", "s4", "s5", "s6"];

export const stationLabels = {
  s1: "The Voyager Vault",
  s2: "The Trend Control Room",
  s3: "The Soundscape Laboratory",
  s4: "The Vocabulary Mixing Desk",
  s5: "The Remix Fingerprint",
  s6: "The Access Timeline",
  final: "The Final Case"
};

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
  },
  s5: {
    code: "REMIX-B",
    evidence: {
      F: "The corrupted file matched Remix B: 108 BPM, electronic bass, a four-beat loop and a distorted ending."
    },
    targets: ["comparison-language", "deduction-language", "music-vocabulary"]
  },
  s6: {
    code: "18:11",
    evidence: {
      G: "Sam’s secondary account logged in immediately before the playlist was edited."
    },
    targets: ["sequencing-language", "past-tenses", "mystery-language"]
  }
};

function fail(feedback, details = {}) {
  return { accepted: false, autoApprove: false, feedback, details };
}

function pending(feedback, details = {}) {
  return { accepted: true, autoApprove: false, feedback, details };
}

const hasLength = (value, minimum) => String(value ?? "").trim().length >= minimum;

export function checkSubmission(station, payload = {}) {
  if (station === "s1") {
    const answers = payload.answers || {};
    const objective = answers.v1 === "b" && answers.v2 === "a" && answers.v3 === "b" && answers.v4 === "b";
    if (!objective) return fail("Recheck the four reading answers before resubmitting.", { objective: false });
    if (!hasLength(payload.reason, 25)) {
      return fail("The factual answers are correct. Add a complete explanation comparing Sam’s claim with the reading.", { objective: true, responseComplete: false });
    }
    return pending("The factual answers are correct. Your explanation is waiting for teacher judgement.", { objective: true, responseComplete: true });
  }

  if (station === "s2") {
    const answers = payload.answers || {};
    const objective = answers.trend1 === "increased dramatically" && answers.trend2 === "fell steadily" && answers.trend3 === "rose gradually" && answers.trend4 === "rose sharply and then declined";
    if (!objective) return fail("At least one graph description is incorrect. Recheck all four trends.", { objective: false });
    const complete = hasLength(payload.verbTrend, 12) && hasLength(payload.nounTrend, 12);
    if (!complete) return fail("The graph choices are correct. Complete both of your own trend sentences.", { objective: true, responseComplete: false });
    return pending("The graph choices are correct. The teacher will judge the two trend sentences.", { objective: true, responseComplete: true });
  }

  if (station === "s3") {
    const answers = payload.answers || {};
    const objective = answers.sound1 === "a" && answers.sound2 === "b" && answers.sound3 === "a";
    if (!objective) return fail("Recheck the three soundscape choices.", { objective: false });
    if (!hasLength(payload.recommendation, 35)) {
      return fail("The soundscape choices are correct. Complete your recommendation, reason and prediction.", { objective: true, responseComplete: false });
    }
    return pending("The soundscape choices are correct. Your recommendation is waiting for teacher judgement.", { objective: true, responseComplete: true });
  }

  if (station === "s4") {
    const matches = Array.isArray(payload.matches) ? [...new Set(payload.matches.map(Number))] : [];
    const objective = matches.length === 9 && matches.every(n => Number.isInteger(n) && n >= 0 && n <= 8);
    if (!objective) return fail("Restore all nine vocabulary connections before submitting.", { objective: false, matches: matches.length });
    if (!hasLength(payload.vocabUse, 45)) {
      return fail("All nine chunks are restored. Write three original sentences using three different chunks.", { objective: true, responseComplete: false });
    }
    return pending("All nine chunks are correct. The teacher will judge your original sentences.", { objective: true, responseComplete: true });
  }

  if (station === "s5") {
    const objective = String(payload.version || "").toUpperCase() === "B";
    if (!objective) return fail("The selected remix does not match every feature in the corrupted-file report.", { objective: false });
    if (!hasLength(payload.justification, 35)) {
      return fail("Remix B is correct. Explain the matching features and rule out at least one other version.", { objective: true, responseComplete: false });
    }
    return pending("The remix identification is correct. Your comparison and deduction are waiting for teacher judgement.", { objective: true, responseComplete: true });
  }

  if (station === "s6") {
    const order = Array.isArray(payload.order) ? payload.order.map(String) : [];
    const expected = ["E", "F", "A", "B", "C", "D"];
    const orderCorrect = order.length === expected.length && order.every((value, index) => value === expected[index]);
    const accessCorrect = String(payload.access || "") === "Sam Stream";
    if (!orderCorrect || !accessCorrect) {
      return fail("Recheck the event order and the account that accessed the system immediately before the edit.", { objective: false, orderCorrect, accessCorrect });
    }
    if (!hasLength(payload.explanation, 35)) {
      return fail("The sequence and account are correct. Explain how the timeline affects the alibi.", { objective: true, responseComplete: false });
    }
    return pending("The timeline is correct. Your sequencing and deduction are waiting for teacher judgement.", { objective: true, responseComplete: true });
  }

  if (station === "final") {
    const culprit = String(payload.culprit || "").trim();
    const evidence = Array.isArray(payload.evidence) ? [...new Set(payload.evidence.map(String))] : [];
    if (!culprit) return fail("Choose a suspect before submitting the final case.", { responseComplete: false });
    if (evidence.length < 4) return fail("Select at least four pieces of evidence to support your accusation.", { responseComplete: false, evidenceCount: evidence.length });
    if (!hasLength(payload.reason, 70)) return fail("Explain how your selected evidence connects to your accusation.", { responseComplete: false });
    if (!hasLength(payload.prevention, 35)) return fail("Add a complete preventive recommendation and predicted result.", { responseComplete: false });
    return pending("Your complete case is waiting for the teacher’s final verdict. The system does not decide whether your interpretation is correct.", { responseComplete: true, evidenceCount: evidence.length });
  }

  return fail("Unknown station.");
}

export function stationProgress(group = {}) {
  const stations = group.stations || {};
  const assigned = group.assignedStation;
  const investigationApproved = Boolean(assigned && stations[assigned]?.status === "approved");
  const finalApproved = stations.final?.status === "approved";
  return {
    approvedStations: investigationApproved ? 1 : 0,
    progress: (investigationApproved ? 50 : 0) + (finalApproved ? 50 : 0),
    completed: finalApproved
  };
}
