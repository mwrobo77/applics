# applics

**applics helps you fill in job applications faster without losing quality.**

You answer a long, friendly interview about yourself once. applics stores your answers (in your own
words, on your own computer). Later, when an application asks "Why do you want to work here?" or
"Tell us about a time you led a team", applics suggests the parts of your own answers that fit, with
the company name and role already filled in. **You stay in control: nothing is ever typed into your
answer unless you click or press a key to put it there.**

This guide assumes no technical knowledge. If you can install a program and copy-paste a line of text,
you can run this.

---

## Contents

1. [What you will need](#1-what-you-will-need)
2. [Step 1: Install Node.js (one-time)](#2-step-1-install-nodejs-one-time)
3. [Step 2: Get the app](#3-step-2-get-the-app)
4. [Step 3: Start it](#4-step-3-start-it)
5. [Step 4: Open it in your browser](#5-step-4-open-it-in-your-browser)
6. [Stopping and restarting](#6-stopping-and-restarting)
7. [Using the app: a guided tour](#7-using-the-app-a-guided-tour)
8. [Getting the best results](#8-getting-the-best-results)
9. [Optional: turn on the AI features](#9-optional-turn-on-the-ai-features)
10. [Your data: where it lives, backups, privacy](#10-your-data-where-it-lives-backups-privacy)
11. [Troubleshooting](#11-troubleshooting)
12. [Frequently asked questions](#12-frequently-asked-questions)
13. [For developers](#13-for-developers)

---

## 1. What you will need

- A computer running Windows, macOS or Linux.
- An internet connection **for the one-time download and install**. After that, the app itself works
  offline (only the optional AI features need internet).
- About 10 minutes for set-up, then however long you want to spend on the interview. Most people spend
  30 to 90 minutes. You can stop and carry on whenever you like.
- A web browser (Chrome, Edge, Firefox or Safari).
- **Optional:** an Anthropic API key to switch on the AI features (see [section 9](#9-optional-turn-on-the-ai-features)).
  The app is fully usable without one.

## 2. Step 1: Install Node.js (one-time)

Node.js is the free engine that runs the app. You only install it once.

1. Go to **https://nodejs.org**
2. Download the **LTS** version (the big green button). It must be **version 22.18 or newer**; the
   current LTS is fine.
3. Run the downloaded installer. Click **Next** / **Continue** through every screen and accept the
   defaults.
4. When it finishes, **close any terminal or command windows you had open** (so they notice the new
   install).

**Check it worked.** Open a terminal (instructions below) and type:

    node -v

You should see something like `v22.22.0` or higher. If you see "command not found" or "not
recognised", restart your computer and try again.

### How to open a terminal

A terminal is a window where you type short text commands.

- **Windows:** press the Windows key, type `PowerShell`, press Enter.
- **Mac:** press `Cmd + Space`, type `Terminal`, press Enter.
- **Linux:** press `Ctrl + Alt + T` (or search for "Terminal").

## 3. Step 2: Get the app

You need the app's files in a folder on your computer.

**Easiest way (no extra software):**

1. Open the project page on GitHub: **https://github.com/mwrobo77/applics**
2. Click the green **Code** button, then **Download ZIP**.
   (If you were told to use a specific branch, choose it from the branch drop-down on the left
   *before* clicking Code.)
3. Find the downloaded ZIP file and **extract / unzip it**:
   - **Windows:** right-click the ZIP, choose **Extract All**, then **Extract**.
   - **Mac:** double-click the ZIP.
4. You now have a folder called something like `applics-main` (the name may differ slightly). Move it
   somewhere easy to find, for example your Documents folder.

**If you already use Git**, you can run `git clone https://github.com/mwrobo77/applics.git` instead.

## 4. Step 3: Start it

You tell the terminal to go into the app's folder, then start the app.

### Windows (PowerShell)

1. Open the `applics` folder in File Explorer, so you can see the folders `src` and `web` inside it.
2. Open a PowerShell window **in that folder**. Use whichever of these is easiest:
   - **Method A:** right-click on an empty gap inside the folder (not on a file) and choose
     **Open in Terminal** (Windows 11), or hold **Shift** while right-clicking and choose
     **Open PowerShell window here** (Windows 10).
   - **Method B:** at the very top of the File Explorer window there is a long white box showing the
     folder's location (for example `Documents > applics`). Click once in an empty part of that box, so
     the text turns into something like `C:\Users\You\Documents\applics`. Delete that text, type the word
     `powershell`, and press **Enter**.

   Either way, a dark window opens. The line of text in it should end with `applics`. That
   tells you it is in the right folder.
3. In that window, type this and press Enter:

       node src/server.ts

### Mac

1. Open Terminal.
2. Type `cd ` (the letters c, d, then a space), then **drag the applics folder from Finder into the
   Terminal window**. It fills in the folder's location. Press Enter.
3. Type this and press Enter:

       node src/server.ts

### Linux

    cd path/to/applics
    node src/server.ts

### What you should see

    applics running at http://127.0.0.1:3000  (AI: mock)

That means it is working. **Leave this window open**: closing it stops the app.

`(AI: mock)` means offline mode. It is perfectly usable; see [section 9](#9-optional-turn-on-the-ai-features)
for what changes when you add an API key.

## 5. Step 4: Open it in your browser

Open your web browser and go to:

    http://127.0.0.1:3000

(You can also type `localhost:3000`.) You should see the applics page with four tabs across the top:
**Interview**, **My twin**, **Snippets** and **Compose**.

> This address only works on your own computer. The app deliberately cannot be reached from other
> devices on your network, because it holds your personal information.

## 6. Stopping and restarting

- **To stop:** click on the terminal window and press `Ctrl + C` (on a Mac too: `Ctrl`, not `Cmd`).
  Or just close the terminal window.
- **To start again later:** repeat [Step 3](#4-step-3-start-it) and [Step 4](#5-step-4-open-it-in-your-browser).
  Everything you entered is still there, because it is saved to a file on your computer
  (see [section 10](#10-your-data-where-it-lives-backups-privacy)).
- Your answers are saved **every time you click Save**, so you will not lose work if you close
  things unexpectedly.

## 7. Using the app: a guided tour

### Tab 1: Interview

This is where you build your profile (your "digital twin").

- The app shows **one question at a time**, with a short hint describing what a strong answer
  contains (for example specific numbers, what *you* personally did, the outcome).
- Type your answer in the big box, then click **Save & next** (or press `Ctrl + Enter`, or `Cmd + Enter` on a Mac).
- Don't want to answer one? Click **Skip**. Skipped questions are not asked again.
- The **progress bar** shows how many of the 105 questions you have answered.
- **Follow-up questions.** If an answer is short or vague, the app may ask one or two follow-ups, marked
  with a "Follow-up" label, such as "What did you personally do, as opposed to the wider team?" or
  "What was the measurable result?". These are what turn a thin answer into one that is useful in a real
  application. You can answer them or click Skip.
- The questions cover: basics and contact details, right to work and availability, education, work
  experience, projects, skills, stories (teamwork, leadership, failure, pressure...), motivation,
  values, strengths and weaknesses, interests, and a few "in your own voice" prompts.
- You can do it all in one go or a little at a time. Come back any day; it picks up at your next
  unanswered question.

### Tab 2: My twin

Everything you have told the app, in one place.

- Answers are **grouped by section**. Click a section heading to open or close it.
- Click into any answer to **edit** it, then click **Save**.
- Click **Make snippet** under an answer to turn it into a reusable snippet (see the next tab). Do
  this for answers you would like to reuse in applications, such as your best stories and your
  reasons for choosing your field.
- The **Facts** table holds short facts used again and again on forms (name, email, phone, right to
  work, expected grade...). Facts are filled in automatically from certain interview questions; you can
  also edit them or add your own.

### Tab 3: Snippets

Snippets are pieces of your own writing that you want to reuse.

- Each snippet has a **title**, the **text**, some **tags** (topic words separated by commas, such as
  `leadership, teamwork`) and a **kind** (short answer, paragraph, story, or cover-letter part).
- You can write snippets from scratch with **New snippet**, or create them from interview answers with
  **Make snippet** (Tab 2).
- **Variables.** Put these words in curly brackets inside the text and the app fills them in
  automatically for each application:

  | Write this     | It becomes                          |
  |----------------|-------------------------------------|
  | `{company}`    | the company you're applying to      |
  | `{role}`       | the job title                       |
  | `{sector}`     | the industry (e.g. Banking)         |
  | `{location}`   | the office location                 |

  Example: *"I'd like to join {company} because of its work in {sector}."* turns into
  *"I'd like to join Lloyds because of its work in Banking."*

  If you haven't filled in that detail on the Compose tab, the `{placeholder}` is left visible so you
  notice and can fix it. **Always read the final text before you send it.**
- Use the search box to find snippets by title, text or tag. Snippets can be edited or deleted at any time.
- **Tip:** good tags make suggestions much better. Use words an application question would use, like
  `why-us`, `leadership`, `teamwork`, `failure`, `motivation`.

### Tab 4: Compose (the one you'll use most)

This is where you answer real application questions.

1. **Fill in the job** at the top: company, role, sector, location. Optionally open the job
   description section and paste in the advert. The app remembers these between visits, so for each
   new application you only change what is different.
2. **Paste the application question** into the "Question / field" box (for example *"Why do you want
   to work at Lloyds?"*).
3. **Suggestions appear** below as cards, best match first, with the company and role already filled
   in. Each card has three buttons:
   - **Insert**: adds that text to your answer box (below). Nothing goes in until you click this.
   - **Adapt**: asks the AI to lightly tweak the text for this company and question, **keeping your
     voice and your facts**. It shows a before/after comparison with additions and removals marked.
     Click **Accept** to use the new version or **Reject** to keep what you had. (Needs the AI
     features; see [section 9](#9-optional-turn-on-the-ai-features).)
   - **Copy**: copies the text to your clipboard so you can paste it straight into an application form.
4. **Build your answer** in the "Answer being built" box. Edit it freely. A word counter helps you
   stay within word limits. When you're happy, click **Copy all** and paste it into the application.

**Quick-expand (like TextExpander).** In the answer box, on a **new line**, start typing the beginning
of a snippet's title (at least 3 characters), or type a semicolon followed by a tag, for example
`;leadership`. A suggestion bar appears under the box:

- press **Tab** to replace what you typed with the full snippet (placeholders filled in), or
- press **Esc** to dismiss it (or click Dismiss).

It never expands on its own.

## 8. Getting the best results

- **Be specific, not impressive.** "I led a team of 4 to cut report time by 30% by automating the
  weekly spreadsheet" is far more useful than "I'm a strong leader".
- **Say what *you* did.** Applications want your contribution, not the group's.
- **Include numbers** wherever you honestly can: sizes, amounts, percentages, time saved, grades.
- **Include what went wrong and what you learned.** Employers ask about this a lot, and honest answers
  stand out.
- **Answer follow-up questions.** They are the difference between a vague answer and a usable one.
- **Write the way you speak.** Reread your "in your own voice" answers: your snippets sound best
  when they sound like you.
- **Turn your best answers into snippets, and tag them well.** A dozen strong, well-tagged snippets
  cover most applications.
- **Adapt, don't copy.** Employers can tell when the same paragraph appears everywhere. Use Insert to
  start, then change a line or two so it reflects something real about *this* company and role. The
  Adapt button helps, but mention only things that are genuinely true and that you actually find
  interesting.
- **Only claim what's true.** The app uses only what you have written. Check every final answer
  yourself before sending.

## 9. Optional: turn on the AI features

The app works without any AI. Adding an Anthropic API key switches on two extras:

| Feature | Without a key (offline mode) | With a key |
|---|---|---|
| Interview follow-ups | Simple rule-based questions (e.g. "what was the measurable outcome?") when an answer is short or has no numbers | Questions written for your specific answer |
| Adapt button | Returns your text unchanged with a note saying AI isn't available | Lightly adapts your text to the company/role/question, shown as a before/after comparison you accept or reject |
| Everything else (interview, twin, snippets, suggestions, quick-expand) | Works | Works |

**How to get a key**

1. Create an account at **https://console.anthropic.com**.
2. Add billing (the AI features are pay-as-you-go; usage here is small text requests, but check
   Anthropic's current pricing for yourself).
3. Create an API key and copy it. **Keep it private**, like a password. Never share it or put it in
   a public place.

**How to start the app with your key.** Stop the app first if it is running (`Ctrl + C`), then, in the
terminal inside the applics folder, run the lines for your system, replacing `YOUR_KEY_HERE` with your
real key:

- **Windows (PowerShell):**

      $env:ANTHROPIC_API_KEY="YOUR_KEY_HERE"
      node src/server.ts

- **Windows (Command Prompt):**

      set ANTHROPIC_API_KEY=YOUR_KEY_HERE
      node src/server.ts

- **Mac / Linux:**

      export ANTHROPIC_API_KEY="YOUR_KEY_HERE"
      node src/server.ts

You should now see `(AI: claude)` in the terminal message, and the "Offline mode" banner on the
Interview page disappears. The key only lasts for that terminal window; next time you start the
app, run those lines again.

## 10. Your data: where it lives, backups, privacy

- **Where:** everything you enter is saved in one file inside the app folder: `data/twin.json`.
  It is a plain text file. It is created the first time you save something.
- **Backing up:** with the app stopped (or even running), copy `data/twin.json` somewhere safe. To
  restore, put the copy back in the `data` folder with the same name.
- **Moving to another computer:** install Node.js and the app there, then copy `twin.json` into its
  `data` folder.
- **Starting fresh:** stop the app, delete `data/twin.json`, start the app again.
- **Privacy:**
  - Your profile **never leaves your computer** in offline mode.
  - With an API key, only the text needed for a single request is sent to Anthropic (for example, one
    answer when generating a follow-up, or one snippet plus the job details when you click Adapt).
    Your whole profile is not uploaded.
  - The app only listens on your own computer (`127.0.0.1`), so nobody else on your Wi-Fi can open it.
  - This file contains personal information (and possibly sensitive details like right-to-work or
    adjustments). Treat the `data` folder like any private document. It is excluded from Git so it is
    not accidentally uploaded to GitHub.

## 11. Troubleshooting

| Problem | What to do |
|---|---|
| `node: command not found` / `'node' is not recognized` | Node.js isn't installed or the terminal was open during install. Install it (section 2), close and reopen the terminal, try `node -v`. |
| `node -v` shows a number lower than 22 | Install the current LTS from nodejs.org, then reopen the terminal. The app needs 22.18 or newer. |
| Error mentioning `ERR_UNKNOWN_FILE_EXTENSION` or "unsupported TypeScript" | Your Node.js is too old. Update it (see the row above). |
| `Cannot find module` or `ENOENT ... src/server.ts` | The terminal isn't inside the applics folder. Redo Step 3, making sure you opened the terminal *in the folder that contains* `src`, `web` and `package.json`. If you unzipped, the files can be one folder deeper (`applics-main/applics-main`). |
| `EADDRINUSE` / "address already in use" | Something is already using port 3000 (often the app itself, still running in another window). Close the other window, or use a different port: Windows PowerShell `$env:PORT="3001"` then `node src/server.ts`; Mac/Linux `PORT=3001 node src/server.ts`. Then open `http://127.0.0.1:3001`. |
| The browser says "This site can't be reached" | The app isn't running (the terminal window was closed or stopped), or you're using the wrong address/port. Start it again and check the address matches the one printed in the terminal. |
| The page loads but shows red error messages | Check the terminal window for an error message. Stop (`Ctrl + C`) and start again. Your saved data is safe in `data/twin.json`. |
| The Adapt button says AI isn't available | You're in offline mode. See section 9 to add an API key. |
| Adapt fails with an error about the API | Check the key is correct and has billing set up, and that you have internet. Errors are shown in a red pop-up and your text is left unchanged. |
| I typed in the answer box but no suggestion appears | Quick-expand only reads your **last line** and needs at least 3 characters matching the start of a snippet's *title*, or an exact `;tag`. Make sure you've created a snippet and you're on a new line. |
| `{company}` appears in my text | That variable wasn't filled in on the Compose tab. Fill in the company field (or edit the text). |
| I lost my data | Restore `data/twin.json` from a backup (section 10). If you never backed up and deleted the file, it can't be recovered. |

If something still doesn't work, copy the message shown in the terminal window, as it usually says
exactly what is wrong, and ask whoever shared the app with you, or open an issue on the GitHub page.

## 12. Frequently asked questions

**Do I need to be online?** Only to download and install, and for the optional AI features.

**Does it apply to jobs for me?** No. It helps you write answers faster and with less repetition.
You paste the final answers into each application yourself, and you review everything.

**Will it make things up about me?** It is designed not to: suggestions are your own text, and the
Adapt instructions forbid adding facts, numbers or experiences that aren't in your text. AI can still
make mistakes, so read everything before you send it.

**Is it okay to use AI for applications?** Some employers have rules about AI use. Check the
instructions on each application. Using your own words as the source and reviewing everything yourself is
the safest approach.

**Can two people share one copy?** Each person should use their own copy of the folder, because there is
only one profile per install.

**Can I use it on my phone?** Not currently. It runs on a computer.

**Does it cost anything?** The app is free. The optional AI features use your own Anthropic account, which
bills per use.

**How do I update to a newer version?** Download the new ZIP, extract it, and copy your old
`data/twin.json` into the new folder's `data` folder.

## 13. For developers

- Requirements: Node.js >= 22.18 (runs TypeScript natively via type stripping: no build step and no
  dependencies to install). Avoid TypeScript features that need compilation (enums, constructor parameter
  properties).
- Run: `node src/server.ts` (env: `PORT`, `TWIN_PATH`, `ANTHROPIC_API_KEY`). Tests: `npm test`.
- Layout:

      src/server.ts            HTTP API + static files (loopback only, no auth)
      src/interview/bank.ts    105-question bank across 12 sections
      src/interview/interviewer.ts   adaptive follow-ups (LLM with rule-based fallback)
      src/snippets/engine.ts   BM25 ranking, variable filling, word diff, quick-expand matching
      src/snippets/adapt.ts    AI adaptation prompt (voice- and fact-preserving)
      src/twin/                schema + atomic JSON store
      src/llm/provider.ts      Claude provider + offline mock
      web/                     vanilla JS single-page UI (no framework, no build)
      test/                    node:test suites (bank, engine, end-to-end server)

- API routes are documented by usage in `src/server.ts` and `web/app.js`.
