# 🏆 Discord Leaderboard Bot

Stateless Discord leaderboard for **Marvel Rivals**, **Overwatch**, and **Deadlock**.  
Staff post rank updates in one private channel → bot processes every 15 min → three clean public leaderboards.  
State is stored as **pinned messages in your private `#lb-update` channel** — no database, no JSON visible to players.

---

## Message Format

Post in **`#lb-update`** — the bot auto-detects the game from the prefix.

### Marvel Rivals
```
LB_UPDATE_MR: @PlayerName role Rank tier PeakRank peakTier date
```
```
LB_UPDATE_MR: @Turbostar Strategist Celestial 3 Grandmaster 1 today
LB_UPDATE_MR: @Wave Vanguard One Above All 1 One Above All 1 2 days ago
```
Ranks (low→high): `Bronze Silver Gold Platinum Diamond Grandmaster Celestial Eternity One Above All`  
Tiers: `3 2 1` (1 = best within rank)

---

### Overwatch
```
LB_UPDATE_OW: @PlayerName role Rank tier SR PeakRank peakTier peakSR date
```
```
LB_UPDATE_OW: @Alpha Tank Diamond 3 3200 Master 2 3400 2 days ago
LB_UPDATE_OW: @Pro DPS Top 500 47 4800 Top 500 12 4900 today
```
Ranks: `Bronze Silver Gold Platinum Diamond Master Grandmaster Champion Top 500`  
Tiers: `5 4 3 2 1` (1 = best). For Top 500, tier = your actual rank number (e.g. 47 = #47).

---

### Deadlock
```
LB_UPDATE_DL: @PlayerName hero Rank tier value date
```
```
LB_UPDATE_DL: @Player2 Haze Archon 4 1200 Feb 14 2026
LB_UPDATE_DL: @Top Dynamo Eternus 6 250 yesterday
```
Ranks: `Initiate Seeker Alchemist Arcanist Ritualist Emissary Archon Oracle Phantom Ascendant Eternus`  
Tiers: `1 2 3 4 5 6` (6 = best — **reversed from MR/OW**)

---

### Accepted date formats
| Format | Example |
|---|---|
| Natural | `today`, `yesterday`, `just now` |
| Relative | `2 hours ago`, `3 days ago`, `1 week ago` |
| Named | `Feb 14 2026`, `January 1 2025` |
| Discord timestamp | `<t:1771587901:R>` |
| ISO | `2026-02-14T15:30:00Z` |

---

## Quick Setup (bot already created, IDs already known)

**1. Clone & install**
```bash
git clone https://github.com/YOUR_ORG/leaderboard-bot.git
cd leaderboard-bot
npm install
```

**2. Copy and fill in `.env`**
```bash
cp .env.example .env
# Add your DISCORD_TOKEN — everything else is already pre-filled
```

**3. Give the bot Manage Messages in `#lb-update`**  
_(Required to pin the state messages)_  
Server Settings → Roles → your bot role → or directly in `#lb-update` channel permissions.

**4. Validate everything works**
```bash
npm run test:secrets
```

**5. Push to GitHub**
```bash
git add . && git commit -m "setup" && git push
```
GitHub Actions will sync automatically every 15 minutes.  
To trigger immediately: **Actions → Leaderboard Sync → Run workflow**.

---

## GitHub Secrets to configure

Settings → Secrets and variables → Actions → New repository secret.

| Secret | Value |
|---|---|
| `DISCORD_TOKEN` | Bot token from Developer Portal |
| `LISTENING_CHANNEL_ID` | `1471187202594832404` |
| `MARVEL_RIVALS_WEBHOOK_URL` | *(from .env)* |
| `OVERWATCH_WEBHOOK_URL` | *(from .env)* |
| `DEADLOCK_WEBHOOK_URL` | *(from .env)* |
| `MARVEL_RIVALS_MESSAGE_ID` | `1474109819764998278` |
| `OVERWATCH_MESSAGE_ID` | `1474369678418772093` |
| `DEADLOCK_MESSAGE_ID` | `1474369688526917856` |

---

## How state storage works

```
#lb-update (private, staff only)
├── Staff message: "LB_UPDATE_MR: @Turbo ..."   ← processed then DELETED
├── 📌 Pinned: LB_STATE:MARVEL_RIVALS:{...}      ← bot's state, only staff see this
├── 📌 Pinned: LB_STATE:OVERWATCH:{...}
└── 📌 Pinned: LB_STATE:DEADLOCK:{...}

#lb-mr (public)  ← clean leaderboard only, zero JSON
#lb-ow (public)  ← clean leaderboard only
#lb-dl (public)  ← clean leaderboard only
```

---

## Running tests

```bash
npm test                # all 76 unit tests
npm run test:secrets    # live Discord API validation
```

---

## Troubleshooting

| Error | Fix |
|---|---|
| Token 401 | Regenerate token in Developer Portal → Bot |
| Webhook 401/404 | Recreate webhook in Channel Settings → Integrations |
| Channel 403 | Bot needs View Channel + Read History + Manage Messages |
| Channel 404 | Re-copy channel ID with Developer Mode on |
| Message ID 404 | Clear the `*_MESSAGE_ID` secret — bot will recreate |
| State not pinning | Bot needs Manage Messages in `#lb-update` |
| `PARSE FAILED` in logs | Check format — use plain text `@Name`, not Discord mentions |
