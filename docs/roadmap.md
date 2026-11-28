# Roadmap

What's next, from the open issues. Order within a list is not priority. When an issue closes, remove its line.

## Now

Keep live up, recoverable and private.

- Hourly check that live is up: #235
- Workers Issues on, structured reply and title failure logs, no query strings or chat text in logs: #243, #244, #245, #246
- Deploy-failure email: #248
- Recovery page and migration rule: #253, #255 (audit #251)
- Harden page headers and trim what each turn sends the model: #227, #229
- Small visual tweaks go straight to a PR: #236

## Next

Polish and speed, from the audits.

- Phone feel: #123 iPhone keyboard, #131 Return adds a line, #132 hide "Open in new tab" in the Home Screen app
- Match Grok: #209 chat content, #212 sidebar and ⌘K type
- Front-end audit gaps: #202; quality audit fixes: #118; improve audit findings: #220
- Faster loads and switches: #137 minify and cache, #139 math only when needed, #140 lighter startup, #127 one call per chat switch, #128 re-render only the streaming reply
- Smaller model input: #133 stop resending old pages and thinking
- Data bugs: #125 delete vs a chat that came back, #138 keep a reply cut off by a deploy, #126 one Keenable client

## Later

- Switch the model by typing `/`: #19
- Find why the phone Settings sheet sometimes never fully opens in e2e: #208
