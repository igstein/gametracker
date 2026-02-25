# GameTracker — Phase 6 Concept

*Post-MVP enhancements. Phase 5 completed February 2026.*

---

## Overview

Phase 6 builds on the completed MVP to add depth and personalization. The theme is **reflection and context** — after tracking games, users should be able to look back, understand their habits, and give their library more structure.

The features below are grouped by scope. Groups 1–2 are in-app additions that share the existing stack. Group 3 is a separate native project (macOS widget).

---

## Group 1: Library Enrichment

These features add metadata to games and require small data model extensions.

### 1.1 Rating System

After finishing a game, users can leave a personal 1–5 star rating.

**Behavior:**
- Rating is optional and only meaningful for finished games, but can be set on any game
- Shown as filled/empty stars on the game detail page and optionally on the card
- Sortable in the game list ("Rating: High to Low")
- Feeds into the statistics dashboard (average rating, best-rated games)

**Data model change:**
```sql
ALTER TABLE games ADD COLUMN rating SMALLINT CHECK (rating BETWEEN 1 AND 5);
```

**UI:**
- Star row (1–5) in the game detail modal, below the progress bar
- Stars are clickable; clicking the current rating clears it
- Compact display on game cards (only shown when a rating exists)

---

### 1.2 Platform Tags

Track which platform each game is being played on.

**Behavior:**
- Each game gets one platform tag (single-select)
- Predefined list: PC, PlayStation 5, PlayStation 4, Xbox, Nintendo Switch, iOS, macOS, Other
- Shown as a small badge on the game card and detail page
- Filterable in the sidebar ("Platform" filter group)

**Data model change:**
```sql
ALTER TABLE games ADD COLUMN platform TEXT;
```

No constraint — free text allows custom values beyond the predefined list.

**UI:**
- Dropdown in the add game form and edit form
- Small platform badge on the game card (below title)
- Optional sidebar filter section: "By Platform"

---

### 1.3 Genre Tags

Categorize games with one or more genre tags.

**Behavior:**
- Multi-select from a fixed list: Action, RPG, Strategy, Puzzle, Platformer, Adventure, Simulation, Horror, Sports, Visual Novel, Other
- Shown as small chips on the game detail page
- Filterable in the sidebar
- Feeds into statistics ("Most played genre")

**Data model change:**
```sql
ALTER TABLE games ADD COLUMN genres TEXT[] DEFAULT '{}';
```

**UI:**
- Chip-style multi-select in the add/edit form
- Genre chips on the game detail modal
- Sidebar filter: "By Genre" collapsible section

---

## Group 2: Statistics Dashboard

A dedicated `/stats` route showing playtime patterns and completion data.

### 2.1 Overview Metrics

Top-level numbers displayed as cards at the top of the stats page:

| Metric | Description |
|---|---|
| Total playtime | Sum of all `played_hours` across all games |
| Games finished | Count of status = 'finished' |
| Completion rate | Finished / (Finished + Abandoned) × 100% |
| Average playtime | Average `played_hours` for finished games |
| Average rating | Mean of all ratings (if rating feature is enabled) |

### 2.2 Playtime Over Time

A bar chart showing total hours logged per month for the past 12 months.

- X axis: months (Jan–Dec or rolling 12)
- Y axis: hours
- Data source: `last_played` timestamp on game updates

**Limitation:** The current schema only stores `last_played` as a single timestamp per game, not a full session log. To make this chart accurate, a `sessions` table would be needed (see §2.5). Without it, the chart can show *games last touched* per month as a proxy.

### 2.3 Status Breakdown

A donut/pie chart showing the distribution of games across Playing / Backlog / Finished / Abandoned.

Simple to implement with existing data — no schema changes required.

### 2.4 Top Games

Small ranked lists:
- **Longest played:** Top 5 by `played_hours`
- **Closest to done:** Top 5 by remaining hours (ascending), status = playing/backlog
- **Best rated:** Top 5 by `rating` (descending), requires rating feature

### 2.5 Session Logging (Optional Extension)

For accurate over-time charts, a session log table could be added:

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    hours DECIMAL NOT NULL,
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Playtime updates in the game detail modal would then insert a session row alongside updating `played_hours`. This is optional but enables meaningful time-series data.

### 2.6 Tech Approach

- New route: `src/routes/stats/+page.svelte`
- Sidebar navigation entry: "📊 Stats"
- Charts: [Chart.js](https://www.chartjs.org/) via `npm install chart.js` — lightweight, no framework required, works with Svelte via `<canvas>` + `onMount`
- All aggregation is done client-side from a single Supabase query (no stored procedures needed for MVP-level stats)

---

## Group 3: Reminders

Nudge users about games they haven't touched in a while.

**Behavior:**
- If a game has status = 'playing' and `last_played` is more than N days ago, show a reminder
- N is configurable per-game (default: 14 days)
- Reminders appear as a dismissible banner or a dedicated "Nudges" section on the dashboard
- No push notifications (iOS PWA doesn't support them without a native wrapper); reminders are in-app only, shown on next visit

**Data model change:**
```sql
ALTER TABLE games ADD COLUMN reminder_days SMALLINT DEFAULT 14;
```

**UI:**
- "Remind me after X days of inactivity" setting on the game detail page
- "You haven't played [Game] in 18 days" cards in a collapsible section above "Next Up"
- Dismiss button hides the reminder until `last_played` is updated again

---

## Group 4: macOS Widget (Separate Project)

A native macOS widget that shows your current game and progress bar on the home screen / notification center.

This is a **separate Swift project** — it cannot share the SvelteKit codebase.

### Concept

```
┌─────────────────────────────────┐
│  🎮 GameTracker                 │
│                                  │
│  NOW PLAYING                     │
│  The Legend of Zelda: TotK      │
│  ▓▓▓▓▓▓▓▓▓░░░░░  65%           │
│  45h played · 23h to go         │
└─────────────────────────────────┘
```

### Tech Approach

- **WidgetKit** (SwiftUI) — the standard macOS/iOS widget framework
- **Data source:** Supabase REST API, polled on widget refresh (every ~15 min)
- **Auth:** Supabase anon key + user JWT stored in macOS Keychain
- **Size:** Small and medium widget sizes
- The widget shows the game with status = 'playing' and highest priority (or shortest remaining time)

### Scope

This is explicitly post-Phase-6 unless there is specific demand, given the Swift toolchain is a separate setup from the SvelteKit project.

---

## Suggested Implementation Order

| Priority | Feature | Reason |
|---|---|---|
| 1 | Rating system | Small schema change, high user value, feeds stats |
| 2 | Platform tags | Small schema change, useful for filtering |
| 3 | Genre tags | Slightly more complex (array column), good for filtering |
| 4 | Statistics dashboard | Depends on rating for full value; no schema changes if sessions table is skipped |
| 5 | Reminders | Useful but lower urgency; requires `reminder_days` column |
| 6 | Session logging | Optional; enables richer stats over time |
| 7 | macOS widget | Separate project; independent of everything else |

---

## Schema Migration Summary

All Phase 6 in-app changes together:

```sql
-- Rating (1–5 stars)
ALTER TABLE games ADD COLUMN rating SMALLINT CHECK (rating BETWEEN 1 AND 5);

-- Platform tag
ALTER TABLE games ADD COLUMN platform TEXT;

-- Genre tags (array)
ALTER TABLE games ADD COLUMN genres TEXT[] DEFAULT '{}';

-- Reminder threshold (days)
ALTER TABLE games ADD COLUMN reminder_days SMALLINT DEFAULT 14;

-- Optional: session log for time-series stats
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    hours DECIMAL NOT NULL,
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sessions" ON sessions
    FOR ALL USING (auth.uid() = user_id);
```

---

*Created: February 2026*
*Project: GameTracker — Phase 6 Planning*
