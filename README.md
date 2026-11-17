# The Vigor Life — Fitness & Discipline Tracker

**Project continuity reference — November 17, 2026**

Live app: https://vigor-life-tracker.vercel.app  
Firebase project: `vigor-life-tracker`  
Repository: `troylalor1993/vigor-life-tracker` (main)

## Product mission
A faith-based fitness transformation and discipline experience that helps individuals and couples develop consistent exercise, nutritional discipline, sustainable habits, and biblical encouragement. Prioritize meaningful daily action over administrative complexity.

## Non-negotiable product standards
1. **Ease of use, target 10/10:** intuitive mobile-first navigation, minimal entries, no confusing or decorative controls.
2. **Functionality, target 10/10:** reliable persistence and sync, connected modules, working actions, no misleading affordances.
3. **Visual design, target 10/10:** premium responsive UI, black-and-gold default appearance, legible typography, thoughtful spacing and feedback.

## Core product requirements (continuity from prior conversations)
- **Today:** default landing view, daily top priorities, **all active habits available to swipe through**, clear progress; Done and Minimum states must display a highly noticeable gold ring or equivalent confirmation.
- **Journey / habits:** users can add/edit/delete/reorder habits they want to build or break, assign cues and minimum actions, and track consistency. After a habit is completed for the day (including Minimum), move it below unfinished habits. Never Miss Twice recovery and attainable fallback actions.
- **Fitness:** all Zone 2 minutes and all workout session logs belong in Fitness, not scattered across other sections. Edit planned workouts, log sessions, follow exercise and 8-day rotation plans. Support future optional 7-day rotation. Zone 2 goal: 150 minutes per 8-day rotation as a configurable default.
- **Nutrition:** practical system to reduce junk food and sugar, food plan, simple minimum commitments, next-meal reset, supportive progress without shame.
- **Growth:** measure weight and waist once per rotation, display trajectory, 10 attainable weight milestones, progress rewards and history.
- **Discipline / Atomic Habits:** make cues obvious, action attractive and easy, reward visible; show identity-based progress, daily preparation, consistency and Never Miss Twice interventions.
- **Couples:** accountability across iPhone and Samsung, with deliberate privacy and reliable shared/individual data boundaries.
- **Faith:** daily relevant Bible verses, prayer and scripture-based encouragement; ensure correct quotations and translations/usage rights.
- **Daily habits:** Bible reading, prayer, book reading, business work, stretching/mobility, plus editable personal habits.
- **Workouts:** strength, conditioning, running and cardio; configurable rather than hard-coded to one person's plan.
- **Device support:** iPhone Home Screen/PWA and Android/Samsung; prepare app architecture for eventual Apple App Store and Google Play distribution.
- **Themes:** preserve existing theme choices and default premium black/gold brand.

## Latest verified development state
- Most recent main commit recorded on November 17: `c96c8bded1045d115b37d231ee3321f3cfac6059`.
- The previous development session reported that Today's habit carousel includes all active habits and that Journey prioritizes unfinished habits above completed/minimum habits.
- Previous test reporting indicated the latest code changes passed checks; **real-device testing remains outstanding**.
- Previous session reported **Vercel Hobby build-rate limit blocking deployment**. A Git commit does **not** prove that changes are live.
- Firebase data should be preserved; do not change project IDs, authentication domains, storage keys, or document schema without migration and regression tests.

## Immediate prioritized backlog
### P0: release and reliability
- [ ] Confirm production build is serving commit `c96c8bd` or later.
- [ ] Review current Vercel plan limit and evaluate Firebase Hosting, which is a natural fit with existing Firebase services; do not switch until rollback and data safeguards are verified.
- [ ] Audit Firebase auth, persistence, sync, and offline/reconnect behaviour using two test accounts/devices.
- [ ] Test Today carousel, Done/Minimum gold rings, Journey reordering and completion sort, and Fitness logs on actual iPhone and Samsung.
- [ ] Validate Home Screen installation, service-worker caching/version updates, input save states and accessibility.

### P1: complete connected experience
- [ ] Ensure all Zone 2 entries and workout logs have one clear canonical home in Fitness; Today may link to the Fitness workflow.
- [ ] Audit all editable habits and workouts for save/cancel/delete/reorder across devices.
- [ ] Improve completed-habit visibility, zero-state onboarding, notification labels and responsive navigation.
- [ ] Validate rotation calculations, milestones and Never Miss Twice rules around shift changes, time zones and missed days.
- [ ] Review couples privacy, sharing permissions and account separation.

### P2: platform evolution
- [ ] Implement genuinely useful optional reminders (do not imply push notification support before implemented).
- [ ] Plan mobile distribution path (PWA vs wrapper/native), app-store compliance and account/data portability.
- [ ] Improve engagement insights and accessibility without overloading daily experience.

## Development guardrails
- Develop within this existing repository; do not overwrite the working application with a new prototype.
- Avoid data loss or incompatible local-storage/Firebase changes.
- Prefer small, reviewable commits with functional regression checks.
- Treat requirements above as product intent; verify actual live behaviour against code and real devices.
- Never claim an issue is fixed in production unless the live deployment was checked.
