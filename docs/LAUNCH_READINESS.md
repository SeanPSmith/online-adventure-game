# Tales of Two — launch-readiness architecture and commercial test plan

Updated 2026-10-14. **Planning decisions, not shipped purchase/character features.**

## Authoritative game/economy decisions

- Three launch adventure duration targets: **short 30–60 min**, **medium ~2 hr**, **long 4+ hr**. These are targets, not enforced wall-clock timers. Long must pause/resume; credits pay for a clearly described completed experience, not individual AI calls. Persist an explicit generation/turn budget and bounded graceful finale so open-ended user actions cannot produce unlimited billable turns.
- **Host pays for the adventure entitlement, co-op guest pays zero.** Charge once, server-side, on adventure creation or committed start according to explicit refund rules. Reconnect, retries, and different personal narration voices must never debit again. Use an immutable idempotency key keyed to adventure instance and transaction purpose; host identity immutable even if room host changes.
- Shared **Story Credits**: unlock entire adventures and permanent additional Hero slots. Account/transaction ledger must distinguish purchased, promotional, subscription, refunded, and expired credits; transactional debits, replay protection, cancellation/refunds, concurrency tests. Begin with sandbox-only / nonmonetary test balances; do not expose public Stripe billing until abuse controls and actual per-adventure costs are validated.
- **Deceased Heroes vacate active slots** without losing history. Graveyard/legacy Heroes remain available for viewing, previous Chronicle ownership, memorial lore and world consequences. Only living active Heroes count against account slots. Purchased permanent slots survive subscription cancellation. Deletion and revive/retire semantics require explicit server rules.
- Hero creation is valuable *without paywalling personality*: structured, Fallout-inspired in-world questions about motive, temperament, fear, virtue, loyalty, risk, violence, moral dilemmas, humor and intended play style. Answer combinations produce an editable structured personality profile, with optional freeform biography and safety/input-length guardrails; no forced normative alignment. Players can deliberately create self-inserts, fools, or bloodthirsty characters.
- Deliberately off-world Heroes stay recognizable. A barbarian in a 1920s noir mystery should provoke consistent world reactions and genre-aware adaptation, not silent replacement of Hero abilities/backstory. Distinguish world rules from individual character identity; enforce power scaling and gear compatibility explicitly.
- Future **permanent/persistent campaigns** can be a high-value subscription after measured launch success; not included in initial economy.
- Worlds publish distinct adventures. Following a World triggers opt-in new-release notifications after separate editorial approval. Public introductory demos and private trials must not create unbounded inference spend.

## Immediate hardening — Pass 62A.1

`POST /api/narration/speech` now requires a six-character room code referencing an existing room, an **online authenticated member**, a **started session with a server-revealed scene**, and exact authorized story/choice chunks. Authorization runs before shared cache, S3, GPU wake, and synthesis. Room codes alone do not authorize anything. Personal narrator voice selection remains unrestricted across the supported English voices. Recorded Chronicle replay and preprepared voice demos use their existing separate authenticated read-only routes without waking GPU.

This reduces an expensive proxy-abuse route; **it is not comprehensive anti-abuse protection**. In particular, the 50-requests/5-min speech limiter is process-local, and an authorized player may still generate multiple voice variants. Launch still requires atomic distributed rate/budget enforcement (per account, adventure, room, and global), correlated usage trails and administrator alerting. No infrastructure or frontend changes were made in 62A.1; deploy backend code and test live room requests.

## Shipped partial protections — Pass 62A.2

Narrator calls now use backend-owned shared DynamoDB admission and daily
per-user/global inference reservations, with an admin-only seven-day monitoring
view. See `docs/STORY_TIME_COST_GUARDRAILS.md` for exact limits and important
remaining protections. Full financial accounting, AWS WAF, anomaly alert
delivery, unified Director/game quotas and a sandbox credit ledger are still
pending; do not treat this as public-payments launch approval.

## Next work packages (in order)

1. **62A.2 Distributed metering and abuse response:** atomic per-user/day speech admission; per-room concurrency and model generation budgets; aggregated, privacy-conscious operator telemetry; warning / suspension / emergency stop. Distinguish cached, first-time generated, and speculative prefetch. Prevent abandoned room leases from keeping the GPU awake unnecessarily. Audit billing ceilings versus actual spending, including AWS fixed costs.
2. **62B Adventure cost laboratory:** run complete, representative solo and co-op adventures at each length; instrument OpenAI tokens, cache, retries, narrator compute, S3 and infrastructure overhead. Record median, p90 and worst-case costs, first-audio delay, latency, continuity and finale quality. Do **not** change default Director models until A/B test results support it.
3. **62C Character depth / world compatibility:** structured personality questionnaire, deliberate genre mismatches, world-specific balance, Hero slot/graveyard lifecycle. Extend test narratives to expose Hero traits and longitudinal memory in later adventures.
4. **62D Test wallet and co-op host purchase:** nonmonetary credits, atomic server entitlement for adventure instance, free joiner, permanent +slot purchases, cancellation/refund/reconnect tests. Validate players understand how a purchase works before using real money.
5. **62E Worlds catalog, demo releases and following:** editorial release workflow and opt-in notifications, marketing landing pages, signup and onboarding experiment, conversion and repeat-play tracking.
6. **62F Paid billing:** Stripe only after full cost/abuse/beta acceptance; Stripe Checkout and webhook idempotency, ledger reconciliation, receipts, refund, cancellation, tax and subscriber access handling. Configure independent payment-processing spending/charge limits as appropriate.

## GPT-6 evaluation

The current Director defaults remain on GPT-5.6 Sol, economy/repair paths on their existing models. Standard short-context token prices for future *evaluation* were added to `app/usage/pricing.py`: GPT-6.1 Sol $2 input / $0.10 cached input / $10 output per million, GPT-6 Sol $2 / $0.20 / $10, GPT-6 Luna $0.10 / $0.01 / $0.50, GPT-6 Astra $10 / $1 / $50 (OpenAI API docs, checked 2026-10-14). Billing variations (cache writes, longer context, service tier, tools, regional uplift) still need ledger extensions/reconciliation. These entries do not call models, alter quality, or change runtime selection. Compare GPT-5.6 Sol vs GPT-6.1 Sol on identical seeds/structured inputs: lore fidelity, consequence persistence, prompt-injection resilience, tokens, retries, end-to-end time, and cost per **completed adventure**, not price per individual request. API model availability and account quotas must be verified when tests run.
