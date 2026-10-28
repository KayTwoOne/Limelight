# Changelog

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
