export interface AdventureCatalogItem {
  adventure_id: string;
  title: string;
  description: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface RoomPlayer {
  player_id: string;
  user_id: string;
  character_id: string;
  name: string;
  is_host: boolean;
  is_online: boolean;
}

export interface RoomState {
  code: string;
  player_count: number;
  online_count: number;
  max_players: number;
  required_players: number;
  play_mode: "coop" | "solo";
  players: RoomPlayer[];
}

export interface AdventureListItem {
  room_code: string;
  player_id: string;
  character_id: string;
  character_name: string;
  adventure_id: string;
  adventure_title: string;
  is_host: boolean;
  is_online: boolean;
  player_count: number;
  online_count: number;
  max_players: number;
  required_players: number;
  play_mode: "coop" | "solo";
  turn_number: number;
  completed: boolean;
  turn_pending: boolean;
  director_request_active: boolean;
  director_retry_required: boolean;
  ending_label: string;
  scene_id: string;
  scene_title: string;
  players: RoomPlayer[];
}

export interface ChoiceCheck {
  difficulty: number;
  skill: string | null;
  stat: string | null;
  base_difficulty?: number | null;
  challenge_tier?: string | null;
  effective_party_level?: number | null;
  level_adjustment?: number;
  adventure_adjustment?: number;
}

export interface SceneChoice {
  id: string;
  label: string;
  description: string;
  archetype: string;
  tone: string;
  risk_level: string;
  reward_level: string;
  impact_level: string;
  possible_gains: string[];
  possible_costs: string[];
  check: ChoiceCheck | null;
  xp_reward: number;
}

export interface SceneState {
  id: string;
  title: string;
  body: string;
  ascii_art: string;
  choices: SceneChoice[];
}

export interface ReadinessPlayer {
  player_id: string;
  user_id: string;
  character_id: string;
  name: string;
  online: boolean;
  ready: boolean;
}

export interface PartyHeroSnapshot {
  player_id: string;
  character_id: string;
  name: string;
  bio: string;
  level: number;
  experience: number;
  max_health: number;
  health: number;
  is_alive: boolean;
  xp_current: number;
  xp_level_floor: number;
  xp_next_level: number;
  xp_into_level: number;
  xp_needed_for_next_level: number;
  xp_level_span: number;
  xp_progress_percent: number;
  xp_level_multiplier: number;
  stats: Record<string, number>;
  effects: Array<Record<string, unknown>>;
}

export interface IntermissionStat {
  player_id: string;
  name: string;
  wins: number;
}

export interface PendingIntermission {
  game_id: string;
  play_mode: "coop" | "solo";
  intermission_stats: IntermissionStat[];
  submitted_player_ids: string[];
}

export interface CheckEffectDetail {
  name?: string;
  modifier?: number;
  target_kind?: string;
  target?: string;
  [key: string]: unknown;
}

export interface CheckResult {
  character_id: string;
  character_name: string;
  difficulty: number;
  base_difficulty?: number | null;
  challenge_tier?: string | null;
  effective_party_level?: number | null;
  level_adjustment?: number;
  adventure_adjustment?: number;
  roll: number;
  stat: string;
  stat_value: number;
  skill: string | null;
  skill_value: number;
  equipment_modifier: number;
  situation_modifier: number;
  performance_modifier: number;
  effect_modifier: number;
  effect_details: CheckEffectDetail[];
  talent_modifier: number;
  talent_details: Array<{ id: string; label: string; modifier: number }>;
  total_modifier: number;
  total: number;
  outcome: "critical_failure" | "failure" | "success" | "critical_success" | string;
  succeeded: boolean;
  critical: boolean;
}

export interface TurnResult {
  player_id: string;
  user_id: string;
  character_id: string;
  player_name: string;
  choice_id: string;
  choice_label: string;
  choice_risk_level: string;
  xp_reward: number;
  xp_breakdown: Record<string, unknown>;
  check: CheckResult | null;
}

export interface HeroEffect {
  effect_id?: string;
  source_key?: string;
  name?: string;
  description?: string;
  category?: string;
  active?: boolean;
  stat_modifiers?: Record<string, number>;
  skill_modifiers?: Record<string, number>;
  remaining_turns?: number | null;
  remaining_checks?: number | null;
  permanence?: string;
  [key: string]: unknown;
}

export interface HealthEvent {
  event_key?: string;
  description?: string;
  health_impact?: number;
  health_delta?: number;
  [key: string]: unknown;
}

export interface HeroProgressionUpdate {
  character_id: string;
  level: number;
  experience: number;
  xp_current: number;
  xp_level_floor: number;
  xp_next_level: number;
  xp_into_level: number;
  xp_needed_for_next_level: number;
  xp_level_span: number;
  xp_progress_percent: number;
  xp_level_multiplier: number;
  xp_gained: number;
  xp_breakdown: Record<string, unknown>;
  level_before: number;
  level_after: number;
  leveled_up: boolean;
  levels_gained: number;
  health: number;
  max_health: number;
  health_before: number;
  health_after: number;
  health_change: number;
  health_events: HealthEvent[];
  at_zero_health: boolean;
  is_alive: boolean;
  died_this_turn: boolean;
  death_record: Record<string, unknown> | null;
  new_effects: HeroEffect[];
  expired_effects: HeroEffect[];
  effects: HeroEffect[];
}

export interface FinaleHero {
  player_id: string;
  character_id: string;
  character_name: string;
  is_host: boolean;
  starting_level: number;
  ending_level: number;
  levels_gained: number;
  xp_earned: number;
  checks_total: number;
  checks_succeeded: number;
  critical_successes: number;
  critical_failures: number;
  success_rate: number;
  rank: string;
  rank_score: number;
  level_ups: Record<string, unknown>[];
  is_alive: boolean;
  health: number;
  max_health: number;
  death_record: Record<string, unknown> | null;
  advancement_stat_points_earned: number;
  advancement_skill_points_earned: number;
  advancement_talent_points_earned: number;
  unspent_stat_points: number;
  unspent_skill_points: number;
  unspent_talent_points: number;
  talents: string[];
  advancement_stat_cap: number;
  advancement_skill_cap: number;
  stats: Record<string, number>;
  skills: Record<string, number>;
}

export interface FinalePayload {
  room_code: string;
  adventure_id: string;
  adventure_title: string;
  play_mode: "coop" | "solo";
  ending_label: string;
  final_scene_title: string;
  final_resolution: string;
  turn_count: number;
  party_rank: string;
  party_rank_score: number;
  heroes: FinaleHero[];
}

export interface TurnResolvedPayload {
  room_code: string;
  preliminary?: boolean;
  adventure_id?: string;
  previous_scene_id?: string;
  scene_id?: string;
  resolution?: string;
  results?: TurnResult[];
  turn_number?: number;
  resolved_turn_number?: number;
  world_flags?: Record<string, unknown>;
  hero_progression?: Record<string, HeroProgressionUpdate>;
  completed?: boolean;
  ending_label?: string;
  finale?: FinalePayload;
}

export interface QuickEventOption {
  id: string;
  label: string;
  description: string;
}

export interface QuickEventEffect {
  name: string;
  description: string;
  modifier: number;
  target_kind: "stat" | "skill" | "";
  target: string;
  duration_turns: number;
}

export interface QuickEventOutcome {
  player_id: string;
  player_name: string;
  option_id: string;
  option_label: string;
  result: string;
  tag: string;
  success: boolean;
  effect: QuickEventEffect | null;
  effect_applied: boolean;
}

export interface QuickEvent {
  id: string;
  created_from_turn: number;
  created_at_ms: number;
  expires_at_ms: number;
  timeout_seconds: number;
  scene_title: string;
  story_context: string;
  kind: string;
  title: string;
  prompt: string;
  options: QuickEventOption[];
  odds_denominator: number;
  success_effect: QuickEventEffect | null;
  failure_effect: QuickEventEffect | null;
  responses: Record<string, string>;
  resolved: boolean;
  resolution: string;
  correct_option_label: string;
  outcomes?: QuickEventOutcome[];
}

export interface MicroEventUpdatedPayload {
  room_code: string;
  event: QuickEvent;
  completed: boolean;
  timed_out?: boolean;
}

export interface TurnHistoryChoice {
  player_name: string;
  choice_label: string;
  outcome: string;
  roll: number | null;
  total: number | null;
  difficulty: number | null;
}

export interface TurnHistoryEntry {
  turn_number: number;
  scene_title: string;
  next_scene_title: string;
  resolution: string;
  choices: TurnHistoryChoice[];
}

export interface GameState {
  room_code: string;
  play_mode: "coop" | "solo";
  required_players: number;
  started: boolean;
  can_start_solo: boolean;
  can_begin_adventure: boolean;
  adventure_id: string;
  adventure_title: string;
  turn_number: number;
  scene: SceneState;
  readiness: ReadinessPlayer[];
  party_heroes: PartyHeroSnapshot[];
  last_resolution: string | null;
  turn_history: TurnHistoryEntry[];
  last_turn_result: TurnResolvedPayload | null;
  director_complete: boolean;
  ai_directed: boolean;
  minimum_turns: number | null;
  target_turns: number | null;
  max_turns: number | null;
  wrap_up_available: boolean;
  wrap_up_active: boolean;
  wrap_up_turns_remaining: number;
  wrap_up_votes: string[];
  turn_pending: boolean;
  director_request_active: boolean;
  director_retry_required: boolean;
  pending_intermission: PendingIntermission | null;
  pending_micro_event: QuickEvent | null;
  micro_event_history: Record<string, unknown>[];
  director_usage: Record<string, unknown> | null;
  story_state_summary: Record<string, unknown> | null;
  intermission_stats: IntermissionStat[];
  last_intermission_result: IntermissionResult | null;
}

export interface ChatMessage {
  id: string;
  player_name: string;
  text: string;
  timestamp: string;
}

export interface RoomJoinedPayload {
  room: RoomState;
  player_name: string;
  player_id: string;
  character_id: string;
  adventure_id?: string;
  adventure_title?: string;
}

export interface ResumeSuccessPayload {
  room: RoomState;
  player_name: string;
  player_id: string;
  character_id: string;
  completed?: boolean;
  finale?: FinalePayload;
}

export interface ServerErrorPayload {
  room_code?: string;
  message: string;
  retryable?: boolean;
}

export interface ChoiceAcceptedPayload {
  room_code: string;
  choice_id: string;
  choice_label: string;
}

export interface TurnLockCountdownPayload {
  room_code: string;
  turn_number: number;
  duration_seconds: number;
  play_mode: "coop" | "solo";
}

export interface StoryAdvancingPayload {
  room_code: string;
  turn_number: number;
  game_id: string;
  play_mode: "coop" | "solo";
  intermission_stats: IntermissionStat[];
  submitted_player_ids?: string[];
}

export interface IntermissionScore {
  player_id: string;
  name: string;
  score: number;
  wins: number;
}

export interface IntermissionResult {
  room_code?: string;
  turn_number: number;
  game_id: string;
  solo?: boolean;
  tie: boolean;
  winner_player_id: string | null;
  winner_name: string | null;
  scores: IntermissionScore[];
}

export interface ServerToClientEvents {
  adventure_catalog: (payload: { adventures: AdventureCatalogItem[] }) => void;
  adventure_list: (payload: { adventures: AdventureListItem[] }) => void;
  room_joined: (payload: RoomJoinedPayload) => void;
  resume_success: (payload: ResumeSuccessPayload) => void;
  room_state: (payload: RoomState) => void;
  game_state: (payload: GameState) => void;
  chat_history: (payload: { room_code: string; messages: ChatMessage[] }) => void;
  chat_message: (payload: ChatMessage) => void;
  room_error: (payload: ServerErrorPayload) => void;
  game_error: (payload: ServerErrorPayload) => void;
  chat_error: (payload: ServerErrorPayload) => void;
  adventure_view_exited: (payload: { room_code: string | null }) => void;
  adventure_left: (payload: { room_code: string; character_id: string }) => void;
  adventure_abandoned: (payload: { room_code: string; message: string }) => void;
  solo_started: (payload: { room_code: string; play_mode: "solo" }) => void;
  adventure_started: (payload: { room_code: string; turn_number: number }) => void;
  wrap_up_vote_recorded: (payload: ServerErrorPayload & {
    player_id: string;
    votes: number;
    required: number;
  }) => void;
  wrap_up_approved: (payload: ServerErrorPayload & {
    turns_remaining: number;
  }) => void;
  turn_lock_countdown: (payload: TurnLockCountdownPayload) => void;
  story_advancing: (payload: StoryAdvancingPayload) => void;
  intermission_result: (payload: IntermissionResult & { room_code: string }) => void;
  micro_event_updated: (payload: MicroEventUpdatedPayload) => void;
  choice_accepted: (payload: ChoiceAcceptedPayload) => void;
  turn_receipt_ready: (payload: TurnResolvedPayload) => void;
  turn_resolved: (payload: TurnResolvedPayload) => void;
  player_notification: (payload: PlayerNotificationPayload) => void;
}


export type PlayerNotificationKind =
  | "room_invite"
  | "partner_joined"
  | "partner_locked"
  | "your_turn"
  | "results_ready";

export interface PlayerNotificationPayload {
  id: string;
  kind: PlayerNotificationKind;
  room_code: string;
  character_id: string;
  title: string;
  message: string;
  adventure_title?: string;
  actor_name?: string;
  route: string;
}

export interface RoomInviteAck {
  ok: boolean;
  message: string;
}

export interface ClientToServerEvents {
  request_adventure_catalog: (payload?: Record<string, never>) => void;
  send_room_invite: (
    payload: { room_code: string; identifier: string },
    ack: (response: RoomInviteAck) => void,
  ) => void;
  create_room: (payload: { character_id: string; adventure_id: string }) => void;
  join_room: (payload: { character_id: string; room_code: string }) => void;
  resume_adventure: (payload: { room_code: string; character_id: string }) => void;
  exit_adventure_view: (payload?: Record<string, never>) => void;
  leave_adventure: (payload: { room_code: string; character_id: string }) => void;
  abandon_adventure: (payload: { room_code: string }) => void;
  start_solo: (payload: { room_code: string }) => void;
  start_adventure: (payload: { room_code: string }) => void;
  request_wrap_up: (payload: { room_code: string }) => void;
  sync_adventure_state: (payload: { room_code: string }) => void;
  submit_choice: (payload: { choice_id: string }) => void;
  retry_pending_turn: (payload: { room_code: string }) => void;
  submit_intermission_score: (payload: {
    room_code: string;
    turn_number: number;
    game_id: string;
    score: number;
  }) => void;
  submit_micro_event_choice: (payload: {
    room_code: string;
    option_id: string;
  }) => void;
  send_chat: (payload: { text: string }) => void;
}
