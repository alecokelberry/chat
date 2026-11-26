-- Chats the e2e tests read (e2e/sidebar.spec.ts), loaded into the fresh
-- local D1 before the test server starts (playwright.config.ts): writing
-- them while it runs locks the database under the other tests. The
-- accounts are made here so the rows have owners; Dev's sign-in and the
-- owner's /setup find them by email. The 1,000 chats are the owner's, so
-- the tests that chat as Dev don't render them on every page.
insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt") values
  ('e2e-dev', 'Dev', 'dev@chat.test', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('e2e-owner', 'Alec', 'owner@chat.test', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

insert into "chat" ("userId", "id", "title", "createdAt", "updatedAt") values
  ('e2e-dev', '00000000-0000-4000-8000-000000000000', 'Seeded for an agent', 1795000000000, 1795000000000);

-- Older than every other seeded chat, so only its pin puts it above Today.
insert into "chat" ("userId", "id", "title", "createdAt", "updatedAt", "pinned") values
  ('e2e-dev', '00000000-0000-4000-8000-000000000005', 'Seeded pinned', 1767225600000, 1767225600000, 1);

-- Already titled, as a rename leaves it: Lightning must not rename it.
insert into "chat" ("userId", "id", "title", "createdAt", "updatedAt") values
  ('e2e-dev', '00000000-0000-4000-8000-000000000006', 'Seeded kept title', 1795000000000, 1795000000000);

-- Around midnight in Auckland on Mar 10, 2026 (UTC+13), which is still
-- Mar 9 in UTC until 11:00 there.
insert into "chat" ("userId", "id", "title", "createdAt", "updatedAt") values
  ('e2e-dev', '00000000-0000-4000-8000-000000000001', 'Seeded just after midnight', 1773055800000, 1773055800000),
  ('e2e-dev', '00000000-0000-4000-8000-000000000002', 'Seeded late last night', 1773052200000, 1773052200000),
  ('e2e-dev', '00000000-0000-4000-8000-000000000003', 'Seeded three days ago', 1772830800000, 1772830800000),
  ('e2e-dev', '00000000-0000-4000-8000-000000000004', 'Seeded a month ago', 1770498000000, 1770498000000);

-- The owner's: worst-case titles, then numbered chats a minute apart,
-- 1,000 in all, from an hour ago back.
insert into "chat" ("userId", "id", "title", "createdAt", "updatedAt")
with recursive n(i) as (select 1 union all select i + 1 from n where i < 1000),
at(i, ms) as (select i, cast(unixepoch('subsec') * 1000 as integer) - 3600000 - 60000 * i from n)
select 'e2e-owner', printf('00000000-0000-4000-9000-%012d', i),
  case i
    when 1 then 'An unreasonably long chat title that goes on and on and on and on and on and on and on and on'
    when 2 then 'SupercalifragilisticexpialidociousSupercalifragilisticexpialidociousSupercalifragilistic'
    when 3 then 'X'
    when 4 then '🦊🦊🦊 Emoji and 漢字 and العربية'
    else 'Seeded chat ' || (i - 4)
  end,
  ms, ms
from at;
