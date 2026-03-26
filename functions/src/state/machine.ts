import { States, State } from "../config/constants";

// 許可された状態遷移の定義
const allowedTransitions: Record<State, State[]> = {
  [States.CONSTRUCTION_DATE_SCHEDULING]: [States.CANDIDATE_DATES_SENT],
  [States.CANDIDATE_DATES_SENT]: [States.WAITING_CONTRACTOR_REPLY],
  [States.WAITING_CONTRACTOR_REPLY]: [States.AI_JUDGED, States.ERROR],
  [States.AI_JUDGED]: [States.CONSTRUCTION_DATE_CONFIRMED, States.ERROR],
  [States.CONSTRUCTION_DATE_CONFIRMED]: [
    States.CUSTOMER_CONFIRMATION_SENT,
    States.CUSTOMER_CONFIRMED,
    States.ERROR,
  ],
  [States.CUSTOMER_CONFIRMATION_SENT]: [
    States.CUSTOMER_CONFIRMED,
    States.CONSTRUCTION_DATE_RESCHEDULING,
    States.ERROR,
  ],
  [States.CUSTOMER_CONFIRMED]: [],
  [States.CONSTRUCTION_DATE_RESCHEDULING]: [States.CANDIDATE_DATES_SENT],
  [States.ERROR]: [
    // エラーからはリトライで任意の状態に復帰可能
    States.CONSTRUCTION_DATE_SCHEDULING,
    States.CANDIDATE_DATES_SENT,
    States.WAITING_CONTRACTOR_REPLY,
    States.AI_JUDGED,
    States.CONSTRUCTION_DATE_CONFIRMED,
    States.CUSTOMER_CONFIRMATION_SENT,
  ],
};

// 状態遷移時に実行すべきアクションのマッピング
const stateActions: Partial<Record<State, string>> = {
  [States.CANDIDATE_DATES_SENT]: "sendCandidateDates",
  [States.WAITING_CONTRACTOR_REPLY]: "waitContractorReply",
  [States.AI_JUDGED]: "updateConstructionDate",
  [States.CONSTRUCTION_DATE_CONFIRMED]: "executePhaseB",
  [States.CUSTOMER_CONFIRMATION_SENT]: "waitCustomerReply",
  [States.CUSTOMER_CONFIRMED]: "completeWorkflow",
  [States.CONSTRUCTION_DATE_RESCHEDULING]: "reschedule",
};

export function canTransition(from: State, to: State): boolean {
  const allowed = allowedTransitions[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function getActionForState(state: State): string | null {
  return stateActions[state] ?? null;
}

export function getNextState(
  currentState: State,
  event: string
): State | null {
  switch (currentState) {
    case States.CONSTRUCTION_DATE_SCHEDULING:
      if (event === "CANDIDATE_DATES_ENTERED") return States.CANDIDATE_DATES_SENT;
      break;
    case States.CANDIDATE_DATES_SENT:
      if (event === "CANDIDATE_DATES_SENT_SUCCESS") return States.WAITING_CONTRACTOR_REPLY;
      break;
    case States.WAITING_CONTRACTOR_REPLY:
      if (event === "CONTRACTOR_REPLIED") return States.AI_JUDGED;
      break;
    case States.AI_JUDGED:
      if (event === "CONSTRUCTION_DATE_UPDATED") return States.CONSTRUCTION_DATE_CONFIRMED;
      break;
    case States.CONSTRUCTION_DATE_CONFIRMED:
      if (event === "PHASE_B_PATTERN_A_COMPLETE") return States.CUSTOMER_CONFIRMED;
      if (event === "PHASE_B_PATTERN_B_SENT") return States.CUSTOMER_CONFIRMATION_SENT;
      break;
    case States.CUSTOMER_CONFIRMATION_SENT:
      if (event === "CUSTOMER_OK") return States.CUSTOMER_CONFIRMED;
      if (event === "CUSTOMER_NG") return States.CONSTRUCTION_DATE_RESCHEDULING;
      break;
    case States.CONSTRUCTION_DATE_RESCHEDULING:
      if (event === "CANDIDATE_DATES_ENTERED") return States.CANDIDATE_DATES_SENT;
      break;
  }
  return null;
}

export function isTerminalState(state: State): boolean {
  return state === States.CUSTOMER_CONFIRMED;
}
