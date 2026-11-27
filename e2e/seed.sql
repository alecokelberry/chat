-- Chats the e2e tests read (e2e/sidebar.spec.ts), loaded into the fresh
-- local D1 before the test server starts (playwright.config.ts): writing
-- them while it runs locks the database under the other tests. The
-- accounts are made here so the rows have owners; Dev's sign-in and the
-- owner's /setup find them (Dev by email, the owner as the oldest other
-- account, whatever its email, as live: Dev is older, so setup must skip
-- it). The 1,000 chats are the owner's, so
-- the tests that chat as Dev don't render them on every page.
-- Dev and its numbered twins, one per e2e worker (dev+N@chat.test, all
-- named Dev; e2e/session.ts signs worker N in as dev+N), so parallel tests
-- never see each other's chats. Each gets the same seeded chats below.
-- Workers past 16 would get a fresh twin with none of them.
create table devs as
with recursive n(i) as (select 0 union all select i + 1 from n where i < 15)
select 'e2e-dev' as id, 'dev@chat.test' as email
union all select 'e2e-dev-' || i, 'dev+' || i || '@chat.test' from n;

insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
select id, 'Dev', email, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z' from devs;
insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt") values
  ('e2e-owner', 'Alec Okelberry', 'owner@example.com', 0, '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z');

-- Each Dev's chats. The same ids for each is fine: a chat is keyed by its
-- owner and id, and so is its agent (src/lib/chat/route.ts).
create table seeds ("id", "title", "at", "pinned", "indexed");
insert into seeds values
  ('00000000-0000-4000-8000-000000000000', 'Seeded for an agent', 1795000000000, 0, 0),
  -- Older than every other seeded chat, so only its pin puts it above Today.
  ('00000000-0000-4000-8000-000000000005', 'Seeded pinned', 1767225600000, 1, 0),
  -- Already titled, as a rename leaves it: Lightning must not rename it.
  -- Marked indexed, so Search's backfill leaves its seeded words below be
  -- (its agent holds no messages).
  ('00000000-0000-4000-8000-000000000006', 'Seeded kept title', 1795000000000, 0, 1),
  -- Around midnight in Auckland on Mar 10, 2026 (UTC+13), which is still
  -- Mar 9 in UTC until 11:00 there.
  ('00000000-0000-4000-8000-000000000001', 'Seeded just after midnight', 1773055800000, 0, 0),
  ('00000000-0000-4000-8000-000000000002', 'Seeded late last night', 1773052200000, 0, 0),
  ('00000000-0000-4000-8000-000000000003', 'Seeded three days ago', 1772830800000, 0, 0),
  ('00000000-0000-4000-8000-000000000004', 'Seeded a month ago', 1770498000000, 0, 0);
insert into "chat" ("userId", "id", "title", "createdAt", "updatedAt", "pinned", "indexed")
select devs.id, seeds.id, title, at, at, pinned, indexed from devs, seeds;

-- Seeded kept title's words, in Search's index (src/lib/chat/message-index.ts):
-- only Dev finds them (e2e/search.spec.ts), never the owner (e2e/sidebar.spec.ts).
insert into "message_text" ("userId", "chatId", "messageId", "text")
select id, '00000000-0000-4000-8000-000000000006', 'seeded-question', 'Where do zanzibarite crystals grow?' from devs;

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

drop table devs;
drop table seeds;
