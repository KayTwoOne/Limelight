# Changelog

## 1.3.0 - 2026-11-11

Four new ways to shape a call, and a speaking ring that finally eases.

- **Focus on the speaker** (Display). Everyone who isn't talking dims, slowly enough
  that a pause between words doesn't flicker, and lights up quickly as they speak.
  Streams stay lit.
- **Spotify on pills and chips.** Someone listening on Spotify shows the track and
  its album art. A pill shows the game someone is playing first, then their song.
- **Theme codes.** Copy theme code, under any preset bar, gives the look you're
  editing as a short code a friend can paste into Use a code. Image themes have no
  code, since the picture lives only on your PC.
- **Match avatar.** When you're editing a person, one click builds their theme from
  their avatar's colours.
- **The speaking ring eases on and off.** 1.2.3 meant to do this and didn't: Discord
  keeps the ring on every tile and redraws it as someone's volume changes, so it now
  eases between those changes instead of fading in once.

## 1.2.3 - 2026-11-10

Motion that shows where things go, and a stage that reaches the controls.

- **The channel list folds where you can see it.** It narrows into the server list
  instead of vanishing, and the strip fades in at its foot.
- **Speaking rings ease in** instead of blinking on.
- **Chips rise into place** as someone joins.
- **The shading behind the call's header and controls takes your stage's colour.**
  Discord's black bands use the stage's darkest colour, darkened so white text
  stays readable. Discord's own stage keeps the black.
- With reduced motion on, all of it is instant.

## 1.2.2 - 2026-11-10

A calmer panel. Nothing new to learn; everything is a little quieter and more
consistent.

- **Less lime.** A chosen option is a raised surface with lime text, not a solid lime
  block. Solid lime is kept for each view's one main action and for switches that
  are on.
- **Health shows problems first.** Working parts carry a quiet tick, so the badges
  that remain are the ones worth reading: Ready, Waiting and Not working.
- **A quieter « » button.** A lime glyph at rest, like Discord's own buttons beside
  it, with its box on hover and keyboard focus.
- **The stage preview shows the stage in use:** two tiles in your Everyone theme and
  a chip, so you can judge a background before you pick it.
- **Swatches stay on one row.** The custom colour swatch no longer wraps onto a
  line of its own when the panel scrolls.
- **The palette button's icon stays visible while the panel is open.** It turned
  dark on a dark button.
- Field labels (Colour, From, To) are quieter than the section above them, chip
  names match the weight of the name pills, and every colour, corner and timing
  now comes from one set of values, so the panel, pills, chips and stage controls
  match.

## 1.2.1 - 2026-11-09

- **The user strip holds its shape alongside other plugins.** Plugins that restyle
  Discord's user section (CollapsibleUI pins it full width) could outrank the strip
  and stretch it across the window. The strip's rules now carry the strength of an
  ID, which no other plugin's class or attribute rules can beat, and set a minimum
  width as well as a maximum, so CollapsibleUI's 264px minimum on hover can't widen
  it either.

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
