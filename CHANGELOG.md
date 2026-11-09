# Changelog

## 1.2.0 - 2026-11-09

- **Presets.** Save any theme as a named preset (up to 20), apply it from any theme
  editor, or hand it out from the dropdown under each person in People. Applying
  copies the look, so editing a preset later never changes anyone you gave it to.
  Images in presets are kept safe from the image tidy.
- **Small tiles** (Display, new). Bots, or anyone you set small in People, go in a
  strip of tiles half or a third the size of everyone else's, or as **Chips**: one
  slim line each with their avatar, name and mute icons, still Discord's own tile
  underneath, so click, right-click and the speaking ring work as before. Below or
  above the grid, and the people you're talking to keep the space. Off by default.
- **The Stage tab.** The background behind every tile: Discord's own, the Everyone
  theme's stage, or your own. Follow grid in the chat and before you join follows
  it. The pre-call screen's settings move here as Before you join.
- **Channel list button** (Stage, off by default). « in the call's bottom-left
  controls folds the channel list away so the stage fills the window; » brings it
  back. Only while you're watching the call. Your user section stands in the server
  list as a slim strip: the green ping icon, then your avatar (decoration and all,
  and it still opens your profile), mute, deafen and settings, over your nameplate
  turned on its side. All of it is Discord's own, just laid out upright.
- Hide invite prompts no longer carries the New tag; Bots get small tiles, Chip and
  the Channel list button carry it now.
- **Health**, on Limelight's settings page. Every part of Limelight with whether
  it's working this session: Working, Ready (in place, runs when you open it),
  Waiting (Discord hasn't loaded that part yet) or Not working (Discord changed it,
  and its own version shows instead). It updates live, and Copy report gives a
  plain-text summary with the Limelight, Discord and Equicord versions.
- **Health is in the panel too**, behind a cog beside Close. A red dot on the cog
  means a part of Limelight isn't working, so a break shows without opening it.
- Behind the scenes, every Discord class Limelight's styles depend on is now
  checked against Discord's live code before each release, in the exact part of
  Discord it belongs to. The theme break fixed in 1.0.2 would have been caught
  this way.

## 1.1.0 - 2026-11-08

- **Hide invite prompts** (Display tab). Takes away the Invite to Voice row under
  your voice channel, and the empty tile with Invite to Voice and Choose Activity
  that Discord adds when you're alone in a call, so your own tile fills the stage.
  Off by default.

## 1.0.2 - 2026-11-07

- **Themes paint again.** Discord's new client build changed how its class names
  are written, and Limelight's tile backgrounds stopped matching, so no theme
  showed on anyone. Limelight now matches Discord's classes by the name they start
  with, whatever the hash after it looks like. The filmstrip, the go-live morph and
  the pill's placement were hit by the same change and are fixed too.
- **Builds on the latest Equicord**, which removed the `Button` export the reset
  confirmation used.
- **Dropping a file onto a picked channel uploads it there**, not to the call's own
  chat.
- The "channel picker couldn't attach" toast no longer shows when the picker is
  working fine.

## 1.0.1 - 2026-10-28

- **The channel picker is back.** A Discord update added another screen that
  shares the call chat's sidebar, and Limelight attached to that one instead, so
  the picker disappeared from the call chat's title. Limelight now finds the call
  chat by its own floating layer and checks every match, so a lookalike can't take
  its place again.
- If the picker ever can't attach after a Discord update, you get a toast saying
  so instead of it quietly going missing.

## 1.0.0 - 2026-10-21

The first release.

### Themes
- **Themes for each person**, and an **Everyone** theme for anyone without one.
  Backgrounds can be their profile colours, a solid colour, a gradient or your own
  image, with an overhead spotlight and a speaking ring colour.
- Themes are saved per person and come back whenever they're in a call with you.
- Curated swatches plus a full colour picker with a hex field.
- Images are resized on your PC and kept locally. Ones no theme uses get tidied away.

### Tiles and streams
- **A pill on every tile**: name, status icons and activity, sized to the tile.
- **One tile per person.** A streamer's tile becomes their stream, and Discord's extra
  preview tile is gone.
- Watch Stream plays inside the tile. Click again to maximise, as Discord does.
- In the maximised view the pill shrinks to an avatar until you hover, and the
  filmstrip keeps one mini tile per person.
- Any number of people can stream at once, each in their own tile.

### The panel
- A palette button in the call controls opens the panel: People, Everyone, Chat,
  Pre-call and Display.
- Editing someone dims every other tile, so you can see whose tile is changing.
- Display: grid zoom, tile corners, tile spacing, **Disable all user themes** and
  **Auto maximise livestream upon joining**.
- The plugin's settings page has the same controls and **Reset all Limelight themes**.

### Chat
- **Three looks**: Discord, Follow grid (the call and chat share one stage) and Own
  theme, with a readability scrim behind the text.
- **Three joins**: Seamless, As a tile and Line.
- **Theme dots** beside names in the call chat.
- **Channel picker** in the call chat's title. Open any text or announcement channel
  in the server beside the call, with Discord's full chat and composer. It follows
  your channel list, permissions and notification settings.
- A channel link clicked inside the call chat opens there.

### Pre-call screen
- The screen before you join can take the Discord, Follow grid or Own look.
- A Limelight button beside Join Voice that takes its colour from your theme and is
  contrast checked against what's behind it.

### Under the hood
- Eight small patches, each one failing on its own without taking anything else down.
- Every surface sits in an error boundary, with Discord's own element as the fallback.
- Settings are stored per account and rebuilt from known values on every load.
- No network requests of its own.
