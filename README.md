Floatle
Write it. Float it. See it. Keep what matters in view.
Floatle is a floating sticky-note board, made by a teacher for teachers. Post the day's objective, agenda and homework where the whole class can see them, without claiming wall or whiteboard space in a shared classroom. It also works for anyone who needs reminders kept in view while they work.
Live site: floatle.com
Built as a single self-contained index.html. No build step, no framework, no npm install.
________________________________________
What it does
Notes
•	Move and resize. Drag a note by its top bar and resize from the bottom-right corner, with a mouse, trackpad or finger.
•	Note types: 
o	Objective, Homework, Reminder and Blank notes for plain text.
o	Agenda and Checklist notes, with items you can check off live during class.
o	Timed: list tasks with minutes for each, then run a countdown or visual timer beside the note. Built for time estimation and time blindness.
o	Image or slide: paste a screenshot or a slide copied from PowerPoint or Google Slides, so there's nothing to retype.
o	Flashcards: flip, shuffle and step through a deck.
o	Dictionary: look up a word, with definition and read-aloud.
•	Minimize any note to a slim bar showing its title and first line. Notes can also be made bigger or smaller and recolored.
•	Undo and redo, plus a Trash for deleted notes and boards.
Boards
•	Multiple boards, one tab per class, period or project, each with its own notes and background.
•	Backgrounds: Koi pond, Slate, Chalkboard, Whiteboard and Corkboard.
•	Duplicate this board copies a lesson to the next section.
•	Schedule boards by class period so the right board shows at the right time.
•	Export and import all boards as a backup file.
Showing it to the class
•	Present mode hides the editing controls, goes full screen, and shows the board name and date for projecting.
•	Float window (Chrome and Edge on a computer) opens a small always-on-top window, so the objective stays visible over slides or video. On Safari or iPad, use Split View instead.
•	Scales to the screen. Note positions and text size scale, so a board arranged on a laptop looks the same on a projector or an iPad.
•	Phones: notes become a stacked list of bars; tap one to expand it.
Sub days
•	Share with a sub. Any board can be shared with a QR code and a short link. The sub opens it without logging in and sees it update live.
•	End-of-day report. The sub sends the teacher a quick report: work completed, behavior concerns, drills or interruptions, and attendance notes. The form asks for first names or initials only.
•	Sub reports inbox in the teacher's board menu, with a count of new reports.
Accounts
•	Sign in with email and password. Boards sync to every device. Signing out clears boards from the browser, which matters on shared classroom computers.
•	Use without an account to keep boards in that browser only. Export and Import move them between devices.
________________________________________
Tech
Piece	What it is
Front end	One HTML file: vanilla JS, no dependencies to install
Auth, database, image storage	Supabase (@supabase/supabase-js loaded from jsDelivr)
Hosting	GitHub Pages, from main / root
Domain	floatle.com (custom domain in CNAME)
Fonts	Atkinson Hyperlegible and Nunito from Google Fonts, with system-font fallbacks
QR codes	qrcode-generator from jsDelivr
Dictionary note	Free Dictionary API (dictionaryapi.dev) and Datamuse
Analytics	Google Analytics (gtag)
Offline fallback: if Supabase is unreachable, the app keeps working from localStorage and syncs when the connection comes back.
________________________________________
Repository layout
index.html   the whole app
404.html     short-link redirect: floatle.com/ABC123 → floatle.com/?s=ABC123
CNAME        custom domain for GitHub Pages
assets/      logo, koi, lily pad and lotus art, pond background, favicons
GitHub Pages only serves a custom 404 page if the file is named exactly 404.html. Short links depend on it.
________________________________________
Setup
1. Supabase
The app expects these in the Supabase project:
Name	Kind	Used for
boards	table	One row per teacher holding all of their boards
shared_boards	table	A copy of each board shared with a sub, keyed by its 6-character code
sub_reports	table	End-of-day reports from subs
note-images	storage bucket	Images and slides pasted into Image notes
get_shared_board(code)	function	Lets a sub open one shared board without listing or guessing others
submit_sub_report(...)	function	Lets a sub send a report (rate-limited, only for boards still shared)
purge_old_sub_reports()	function	Clears old reports
Every table needs Row Level Security turned on, so each teacher can only read and write their own rows. Subs reach shared boards and reports only through the two functions above.
TODO: add the SQL for these tables, policies and functions to this repo as supabase-setup.sql, so the database can be rebuilt from scratch.
Then, in Project Settings → API, copy the Project URL and the publishable (anon) key into the top of the script in index.html:
const SUPABASE_URL = "https://yourproject.supabase.co";
const SUPABASE_KEY = "your-publishable-key";
The publishable key is meant to be public. Row Level Security is what protects the data. Never put the service_role or secret key in this file; it bypasses every policy.
In Authentication → URL Configuration, set the Site URL to https://floatle.com and add it to Redirect URLs, so confirmation and password-reset emails land on the right page.
2. Hosting
index.html sits at the repository root. Settings → Pages deploys from main / root, with floatle.com as the custom domain and Enforce HTTPS on. To update the site, push to main; the deploy takes a minute or two.
________________________________________
Data model
All of a teacher's boards are stored together as one JSON object:
boards
  user_id     uuid    primary key, references auth.users
  data        jsonb   { v, active, boards: [ { id, name, bg, notes: [...], shareCode?, sched? } ], trash, updatedAt }
  updated_ms  bigint  milliseconds, used to decide which copy is newer
Writes are debounced about 900 ms. On sign-in, the newer of the device copy and the server copy wins. A brand-new account keeps whatever is already on the device.
Because the server keeps one copy per teacher, edits made on two devices while one is offline can overwrite each other; the most recent save wins.
________________________________________
Privacy
Floatle stores teacher account emails, lesson content, and the images teachers paste into notes. It is not meant for student records. Boards are projected to the whole class, so teachers should keep student names out of notes. Sub reports ask for first names or initials only. Student-specific sub binder items (rosters, seating charts, health or behavior plans) should stay on paper.
Districts adopting Floatle formally in New York may require a data privacy agreement under Education Law 2-d. Keeping data to teacher content keeps that simpler.
________________________________________
Known limits
•	Some school web filters block free shared hosts (*.netlify.app, *.github.io). That's why the site runs on its own domain. If a district still blocks it, ask its IT to allowlist floatle.com and the *.supabase.co address the app uses for sign-in.
•	The Float window uses the Document Picture-in-Picture API, available in Chrome and Edge on desktop only.
•	Supabase's built-in email sender is rate-limited and meant for testing. Connect a custom SMTP provider before opening sign-ups widely.
________________________________________
Coming next
•	Floatle Pro: a paid tier alongside the free one. Free keeps up to 3 boards, every note type, sub sharing for one board, and all accessibility options. Pro adds unlimited boards and shared boards, theme packs and custom backgrounds, the "Out today" sub switch, a printable sub packet, board history and folders.
•	Payments and a server-side check for the free-plan board limit.
•	School and department licenses.
________________________________________
Made by a teacher. © Floatle
