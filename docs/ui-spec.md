# A2 Panel UI Spec

## Product Feel

A2 Panel is a premium dark FiveM control room. The interface should feel dense, fast, and serious without looking like a generic admin template.

## Palette

- Background: `#050604`
- Panel: near-black with transparent glass overlays
- Accent: `#b7fe1a`
- Text: white and soft grays
- Danger: controlled red for destructive actions
- Warning: muted yellow for offline/attention states

## Layout

- Fixed desktop sidebar with compact icon navigation.
- Sticky top bar with server status, player count, global search, notifications, staff identity, and logout.
- Full-width page layouts, not nested card stacks.
- Cards are used for widgets, data blocks, repeated records, modals, and drawers.

## Components

- Sidebar active state uses a green glowing left indicator.
- Tables include search, sorting, pagination, loading skeletons, empty states, and row actions.
- Dangerous actions use confirmation dialogs. Ban and delete actions require typing a phrase.
- Toasts report success, warning, and error states.
- Right-side player drawer exposes identifiers, quick actions, message, and danger zone.
- Command palette opens with Ctrl+K.

## Motion

- Login and loading screens use subtle scale/glow animation on the A2 mark.
- Page transitions should feel fast and restrained.
- Hover states are visible but not noisy.

## Responsive Behavior

- Desktop is primary.
- Tablet keeps the same navigation and tables with horizontal scroll where required.
- Mobile does not expose every workflow perfectly, but no screen should break or overlap.

## Feature States

- Bridge offline: show banner and queue live commands.
- Missing framework table: show module not configured.
- Screenshot dependency missing: show safe warning for `screenshot-basic`.
- Empty data: show a clean empty state, not a broken table.
