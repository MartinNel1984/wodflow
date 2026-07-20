import base64, os

BASE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(BASE, "shots")
FONTS = os.path.join(BASE, "fonts")

def b64_font(filename):
    with open(os.path.join(FONTS, filename), "rb") as f:
        return base64.b64encode(f.read()).decode()

def b64_img(filename):
    with open(os.path.join(SHOTS, filename), "rb") as f:
        return base64.b64encode(f.read()).decode()

ANTON = b64_font("anton.woff2")
HANKEN = b64_font("hanken.woff2")
MONO_REG = b64_font("spacemono-regular.woff2")
MONO_BOLD = b64_font("spacemono-bold.woff2")

# (section_title | None, screenshot_file, caption_title, caption_body)
CONTENT = [
    ("1. Overview", None, None, None),
    ("2. Getting Started", "01-homepage.jpg", "The homepage",
     "Every athlete's starting point. Shows all published/live events, each carrying its own brand kit colours and tagline. Athlete, Judge, and Organizer sign-in are all one tap away."),
    (None, "02-login.jpg", "Organizer sign-in",
     "wodflow.co.za/login — sign in with your organizer email and password. This takes you straight to the Dashboard."),
    ("3. Organizer — Dashboard", "03-dashboard.jpg", "Dashboard: event health at a glance",
     "The very first thing you see after signing in. Every event you're running, its status (Draft/Published/Live), how many pre-event checklist items are still outstanding, and a live payment reconciliation summary (paid vs pending, total revenue) — no more clicking into every event just to check if it's ready."),
    ("4. Organizer — Events", "04-events.jpg", "Events list",
     "Create new events, publish/unpublish them, and assign a Brand Kit to each one right from this list. An event's status controls whether athletes can see and register for it on the homepage."),
    (None, "05-checklist-top.jpg", "Pre-event checklist",
     "Built directly from the lesson of the ScoreIT failure: an event days away with no address, contact details, or configuration filled in. This page flags exactly what's still missing before you go live."),
    (None, "06-checklist-settings-waiver.jpg", "Scoring model & waiver text",
     "Scroll down on the checklist page to find two critical settings: the Scoring model (Centralized — only the Head Judge enters scores, or Distributed — every judge scores their own heats), and the full waiver/indemnity text shown to every athlete at registration. Editing this later never changes what past athletes already agreed to — their signature snapshots the exact wording at the moment they signed."),
    ("5. Organizer — Brand Kits", "09-brandkits.jpg", "Brand Kits",
     "Create once, reuse every year. Each kit carries a name, logo, tagline, and three brand colours. Assign a kit to an event from the Events list and it automatically re-skins that event's registration page, indemnity page, leaderboard, and homepage card — Rumble Indy, Rumble Remix, and Rumble \"The Big One\" can each have their own identity without touching a line of code."),
    ("6. Organizer — Divisions & Scoring Formula", "07-divisions.jpg", "Divisions",
     "Each division (Individual, Mixed Pairs, etc.) gets its own team size, pricing, lane count, and — new — its own points formula. Choose \"Rank sum\" (today's default, entrants minus position plus one) or \"Gap formula\" — the 100-points-with-a-shrinking-gap model, exactly as described: winner scores 100, and every place down loses a fixed gap of 100 divided by the number of entrants, rounded."),
    ("7. Organizer — Workout / Scoresheet Builder", "08-workouts.jpg", "Building a workout",
     "Define a workout's time cap, scoring type, and whether a tiebreak applies — then add each movement with its RX and Scaled rep or load scheme, and how many rounds. The cumulative rep-reference table (the same \"/03 /08 /16...\" numbers printed on paper scoresheets) is generated automatically underneath, giving the Head Judge a quick-tally guide during scoring without anyone having to work it out by hand."),
    ("8. Organizer — Judges", "10-judges.jpg", "Judges & the Head Judge",
     "Create judge accounts with a 4-digit PIN for fast event-day sign-in. Tick \"Head Judge\" to create a centralized scorer — someone who can see and score every heat, and lock/correct scores after the fact — exactly the \"guardian\" role described for how Tjokkie runs scoring personally."),
    ("9. Organizer — Heats", "11-heats.jpg", "Heats",
     "Auto-generate heats from your roster with a chosen lane count and heat duration — regenerating never touches heats that have already started or finished. Each heat shows a live scored-count badge so you always know which lanes are still outstanding."),
    ("10. Organizer — Athletes", "12-athletes-directory.jpg", "Athletes directory (all events)",
     "Every athlete who's ever registered for any of your events, searchable by name, event, or ID number, with waiver and payment status at a glance. This is where you check \"has everyone signed?\" across your whole calendar, not just one event at a time."),
    (None, "13-division-athletes.jpg", "Athletes per division",
     "The same view, scoped to a single division — useful for a final check-in-sheet pass the day before an event."),
    ("11. Organizer — Reports", "14-all-waivers.jpg", "All signed waivers",
     "One printable report listing every signed waiver for an event — full name, ID number, minor/guardian details where relevant, the exact wording they agreed to, and their signature, timestamp, and IP address. Print or Save as PDF for your public liability records. The Events checklist page also offers a one-click CSV export of every registration for check-in sheets or payment reconciliation."),
    ("12. Organizer — Series (the 2027 Rumble Series)", "15-series-detail.jpg", "Building a season",
     "Create a Series (e.g. \"Rumble Series 2027\") and assign any number of events to it. Wodflow tracks each athlete's overall placement at every event in the series and turns it into season points automatically."),
    (None, "16-series-leaderboard.jpg", "Season leaderboard",
     "The accumulated points table across the whole season — one athlete, ranked by total points across however many events they've entered. Points are tracked against the athlete's own account, so it doesn't matter which team name or division they used at any single event."),
    ("13. Judging — Sign-in", "17-judge-login-picker.jpg", "Judge sign-in",
     "wodflow.co.za/judge-login — every judge (and the Head Judge) picks their name from a searchable list. Head Judges are clearly labelled."),
    (None, "18-judge-pin-keypad.jpg", "PIN entry",
     "A fast 4-digit PIN keypad, designed for a phone or tablet on the competition floor. No typing a password on event day."),
    ("14. Judging — Score Entry", "19-score-entry-empty.jpg", "Score entry screen",
     "The Head Judge sees every heat across the event (not just their own assignments) and picks one to score."),
    (None, "20-score-entry-locked.jpg", "Scoring a heat",
     "For each lane: an RX/Scaled toggle, a Finished/Capped toggle, the score itself, and — when the workout calls for it — a tiebreak field. The heat's status is shown clearly, with a one-tap Lock/Unlock control once scoring for that heat is complete."),
    (None, "21-score-entry-confirm-correction.jpg", "Correcting a locked heat",
     "Once a heat is locked, submitting a new score requires a deliberate second tap (\"Locked — confirm?\") rather than silently overwriting anything — corrections are always possible, but never accidental."),
    ("15. Athlete — Registration", "22-register-step1.jpg", "Choosing a division",
     "Athletes reach registration straight from the homepage. Every division for the event is listed with its price and team size."),
    (None, "23-register-minor.jpg", "Athlete details",
     "Full name, email, and ID number are required for every athlete. Ticking \"Under 18\" reveals the parent/guardian name and ID number fields, matching the real indemnity form exactly."),
    (None, "24-register-waiver.jpg", "The real waiver",
     "The actual indemnity agreement text is shown in full — not a placeholder — with a checkbox to confirm and a typed signature. What gets signed is permanently snapshotted against that athlete's record."),
    ("16. Athlete — Accounts & Portal", "25-athlete-signup.jpg", "Creating an athlete account",
     "Full name, email, phone, ID number, and a password — a real, persistent account, separate from the old one-off registration flow."),
    (None, "26-athlete-login.jpg", "Athlete sign-in",
     "wodflow.co.za/athlete-login. Once signed in, every future registration pre-fills the athlete's name, email, and ID number automatically."),
    (None, "27-portal.jpg", "My Wodflow — the athlete portal",
     "Best Finishes (an athlete's real placement in every division they've competed in), My Registrations (past and upcoming, with a link straight to that event's leaderboard), and a personalised \"Register for an event\" list of everything they haven't already entered."),
    ("17. Athlete — Team Invites", "29-confirmation-invite-links.jpg", "Team registration confirmation",
     "Once a team registration is paid, the captain is given a unique sign-up link for every teammate. Each teammate should sign in or create their own account through this link — not just be entered by the captain."),
    (None, "28-invite-signin-prompt.jpg", "Opening a teammate's invite link",
     "If the teammate isn't signed in yet, they're prompted to sign in or create an account first — the invite link itself is the one-time key, so no account is required in advance."),
    (None, "30-invite-prefilled.jpg", "Confirming their own details",
     "Once signed in, the teammate sees their details already pre-filled from what the captain entered — fully editable — and signs their own copy of the waiver with their own name, replacing the captain's placeholder signature. Their account is linked to this registration from this point on, so it shows up in their own portal too."),
    ("18. Public Leaderboard", "31-leaderboard-overall.jpg", "Overall standings",
     "Live, public, no login required — anyone can watch the leaderboard update in real time as scores are entered."),
    (None, "32-leaderboard-workout.jpg", "Per-workout view",
     "Switch to any individual workout to see time/reps, points, and tiebreaker for that WOD specifically, alongside the overall combined standings."),
]

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") if s else s

sections_html = []
for section, shot, title, body in CONTENT:
    if section:
        sections_html.append(f'<div class="section-break"><h1>{esc(section)}</h1></div>')
    if shot:
        img_b64 = b64_img(shot)
        sections_html.append(f'''
<div class="entry">
  <h2>{esc(title)}</h2>
  <p class="body">{esc(body)}</p>
  <div class="shot-frame"><img src="data:image/jpeg;base64,{img_b64}" /></div>
</div>
''')

html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@font-face {{
  font-family: 'Anton';
  src: url(data:font/woff2;base64,{ANTON}) format('woff2');
  font-weight: 400;
}}
@font-face {{
  font-family: 'Hanken Grotesk';
  src: url(data:font/woff2;base64,{HANKEN}) format('woff2');
  font-weight: 400 700;
}}
@font-face {{
  font-family: 'Space Mono';
  src: url(data:font/woff2;base64,{MONO_REG}) format('woff2');
  font-weight: 400;
}}
@font-face {{
  font-family: 'Space Mono';
  src: url(data:font/woff2;base64,{MONO_BOLD}) format('woff2');
  font-weight: 700;
}}

@page {{ size: A4; margin: 20mm 16mm; }}

* {{ box-sizing: border-box; }}
body {{
  font-family: 'Hanken Grotesk', -apple-system, Arial, sans-serif;
  color: #16171c;
  margin: 0;
  font-size: 10.5pt;
  line-height: 1.5;
}}
h1, h2 {{
  font-family: 'Anton', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  font-weight: 400;
  margin: 0 0 4mm 0;
}}
h1 {{ font-size: 22pt; color: #f5470c; }}
h2 {{ font-size: 13pt; margin-top: 0; }}
.body {{ margin: 0 0 4mm 0; color: #333; max-width: 165mm; }}
.entry {{ break-inside: avoid; margin-bottom: 10mm; }}
.section-break {{ break-before: page; padding-top: 4mm; }}
.shot-frame {{
  border: 1px solid #e2e2de;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}}
.shot-frame img {{ display: block; width: 100%; }}

.cover {{
  height: 257mm;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}}
.cover .plate {{ width: 90px; height: 90px; margin-bottom: 10mm; }}
.cover .wordmark {{
  font-family: 'Anton', sans-serif;
  font-size: 52pt;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  display: flex;
  align-items: baseline;
  gap: 2mm;
}}
.cover .plate-inline {{ width: 0.72em; height: 0.72em; transform: translateY(0.06em); }}
.cover .subtitle {{
  font-family: 'Space Mono', monospace;
  font-size: 13pt;
  color: #f5470c;
  margin-top: 6mm;
  letter-spacing: 0.02em;
}}
.cover .meta {{
  margin-top: 40mm;
  font-size: 10pt;
  color: #888;
}}
.toc {{ break-after: page; }}
.toc ul {{ list-style: none; padding: 0; columns: 1; }}
.toc li {{
  padding: 2mm 0;
  border-bottom: 1px solid #eee;
  font-size: 10.5pt;
}}
.toc .num {{ font-family: 'Space Mono', monospace; color: #f5470c; margin-right: 3mm; }}

.appendix table {{ width: 100%; border-collapse: collapse; font-size: 9.5pt; }}
.appendix td {{ padding: 1.5mm 2mm; border-bottom: 1px solid #eee; vertical-align: top; }}
.appendix .url {{ font-family: 'Space Mono', monospace; font-size: 8.5pt; color: #f5470c; word-break: break-all; }}

.callout {{
  background: #fdf4e3;
  border: 1px solid #f0dfb0;
  border-radius: 6px;
  padding: 4mm 5mm;
  margin: 4mm 0;
  font-size: 9.5pt;
}}
</style>
</head>
<body>

<div class="cover">
  <svg class="plate" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="#f5470c"/><rect x="0" y="41" width="100" height="18" fill="#f7f7f4"/></svg>
  <div class="wordmark">
    <span>W</span>
    <svg class="plate-inline" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="#f5470c"/><rect x="0" y="41" width="100" height="18" fill="#f7f7f4"/></svg>
    <span>DFLOW</span>
  </div>
  <div class="subtitle">RUMBLE SERIES PLATFORM — FULL TRAINING MANUAL</div>
  <div class="meta">Organizer · Head Judge / Judge · Athlete<br>Everything covered — dashboard to season leaderboard<br>20 July 2026</div>
</div>

<div class="toc">
<h1>What's Inside</h1>
<ul>
<li><span class="num">01</span>Overview — what's new since the first demo</li>
<li><span class="num">02</span>Getting started</li>
<li><span class="num">03</span>Organizer — Dashboard</li>
<li><span class="num">04</span>Organizer — Events, checklist, waiver text, scoring mode</li>
<li><span class="num">05</span>Organizer — Brand Kits</li>
<li><span class="num">06</span>Organizer — Divisions &amp; scoring formula</li>
<li><span class="num">07</span>Organizer — Workout / scoresheet builder</li>
<li><span class="num">08</span>Organizer — Judges &amp; the Head Judge role</li>
<li><span class="num">09</span>Organizer — Heats</li>
<li><span class="num">10</span>Organizer — Athletes directory</li>
<li><span class="num">11</span>Organizer — Reports (CSV, waivers)</li>
<li><span class="num">12</span>Organizer — Series &amp; the 2027 Rumble Series</li>
<li><span class="num">13</span>Judging — Sign-in</li>
<li><span class="num">14</span>Judging — Score entry, locking, corrections</li>
<li><span class="num">15</span>Athlete — Registration</li>
<li><span class="num">16</span>Athlete — Accounts &amp; portal</li>
<li><span class="num">17</span>Athlete — Team invites</li>
<li><span class="num">18</span>Public leaderboard</li>
<li><span class="num">19</span>Appendix — quick reference &amp; URLs</li>
</ul>
</div>

<div class="section-break" style="break-before: auto;">
<h1>1. Overview</h1>
<p class="body">Wodflow started as a single-event MVP built after a competitor's platform broke live mid-event. Since the first demo, the platform has grown into a full Rumble Series management system: every competition can carry its own branding, a real workout/scoresheet builder replaces free-text entry, one centralized Head Judge can score an entire event exactly the way it's really run, real indemnity forms are captured digitally, athletes get their own persistent accounts and portal, teams can invite each other to sign independently, organizers get a proper control center, and the points formula — including the 100-points-with-a-shrinking-gap model — is fully configurable per division. This manual walks through every one of those pieces, screen by screen, using real data from the live platform.</p>
<div class="callout"><strong>A note on this guide:</strong> every screenshot in this document was captured live from wodflow.co.za in a real browser session — nothing here is mocked up or simulated.</div>
</div>

{''.join(sections_html)}

<div class="section-break">
<h1>19. Appendix — Quick Reference</h1>
<h2>Key URLs</h2>
<table class="appendix">
<tr><td>Homepage</td><td class="url">wodflow.co.za</td></tr>
<tr><td>Organizer sign-in</td><td class="url">wodflow.co.za/login</td></tr>
<tr><td>Dashboard</td><td class="url">wodflow.co.za/dashboard</td></tr>
<tr><td>Events</td><td class="url">wodflow.co.za/events</td></tr>
<tr><td>Brand Kits</td><td class="url">wodflow.co.za/brand-kits</td></tr>
<tr><td>Judges</td><td class="url">wodflow.co.za/judges</td></tr>
<tr><td>Athletes directory</td><td class="url">wodflow.co.za/athletes</td></tr>
<tr><td>Series</td><td class="url">wodflow.co.za/series</td></tr>
<tr><td>Judge sign-in</td><td class="url">wodflow.co.za/judge-login</td></tr>
<tr><td>Score entry (after judge sign-in)</td><td class="url">wodflow.co.za/score</td></tr>
<tr><td>Athlete sign-up</td><td class="url">wodflow.co.za/athlete-signup</td></tr>
<tr><td>Athlete sign-in</td><td class="url">wodflow.co.za/athlete-login</td></tr>
<tr><td>Athlete portal</td><td class="url">wodflow.co.za/portal</td></tr>
</table>
<div class="callout">
<strong>Head Judge PIN:</strong> the "Tjokkie" Head Judge account currently uses PIN <strong>9999</strong> for testing — set during development, not something Tjokkie chose himself. Change this to a private PIN (or have him set his own from the Judges page) before it's used at a real event.
</div>
</div>

</body>
</html>
"""

with open(os.path.join(BASE, "guide.html"), "w") as f:
    f.write(html)

print(f"HTML built: {len(html)} chars, {len(CONTENT)} entries")
