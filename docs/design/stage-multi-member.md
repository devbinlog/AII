# 3D Stage — multiple members per role (WS-07)

## Identity model

| Concept | Where | Example | Notes |
|---|---|---|---|
| Stage object id | `StageItem.id` | `member-guitar`, `perf-3f9a…`, `inst-81c2…` | What is rendered, selected, dragged, and undone. Unique per layout. |
| Member id | `StageItem.memberId` | `mbr-c04e…` | Who a performer is. On an instrument: whose instrument it is. Never derived from the role or the object id. |
| Role | built-in: derived from the fixed id; added: `StageItem.role` | `guitar` | Several members may share a role. |
| Instrument link | instrument `memberId` = performer `memberId` | — | Built-in pairs stay implicit (`member-guitar` ↔ `guitar`). |

A *stage member* is a performer in the lineup. It is unrelated to accounts and artist
memberships (`artist_members`); removing a stage member never touches an account.

## Schema change (additive, `version: 1` unchanged)

`StageItem` gains two optional fields:

```ts
memberId?: string;     // /^mbr-[a-z0-9]{6,32}$/  — added members and their instruments only
role?: PerformerRole;  // added performers only
```

- Built-in items (the five default members, their instruments, amps, drum kit) never
  carry these fields. Legacy drafts and published snapshots contain only built-in items
  and are read, validated and rendered exactly as before; nothing is rewritten on read.
- Added items use object ids `perf-…` (performer) or `inst-…` (instrument).
- Parsing keeps absent optional keys absent, so legacy layouts round-trip without new keys.

## Rules

- Built-in members keep their fixed spots, the backline (amps, drum kit) stays locked,
  and the lineup picker benches/returns built-in roles as before.
- Added members spawn near their role's default spot, inside the stage and clear of
  the backline, with their role's instrument next to them (vocal → mic, guitar → guitar,
  bass → bass, keys → keyboard; drummers share the fixed kit).
- Added members can be renamed, re-roled (instrument swapped, member id kept) and removed
  (performer + instrument). Built-in members can be renamed; re-roling or removing them
  happens through the lineup picker.
- At most 10 added members; the schema still caps a layout at 40 items, labels at 40 chars.
- At least one performer always stays on stage.

## Server validation (`validateAgainstReference` + `validateAddedMembers`)

Rejected with 422 (or 400 by the schema): unknown ids outside `perf-`/`inst-`, member id or
role on built-in items, added performers without role/member id, a member id used by two
performers, instruments without a matching performer, a second instrument for one member,
an instrument that does not match the member's role, added amps/drum kits, locked added
items, positions outside the stage, duplicate object ids, malformed member ids or roles.
`artistId` is always taken from the session.

## Supabase jsonb compatibility (`feat/supabase-schema-rls`, not merged)

- `stage_layouts.layout` (jsonb) stores the draft without `artistId`/`updatedAt`; the new
  item fields are extra keys inside `items[]` — no column or migration change needed.
- `stage_layout_versions.items` (jsonb array) stores published items verbatim, so published
  added members keep `memberId`/`role`; `schema_version` stays `1` (additive change).
- The `check (jsonb_typeof(layout -> 'items') = 'array')` constraint is unaffected.
- No Supabase migration was changed on this branch.
