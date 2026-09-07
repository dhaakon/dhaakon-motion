# Dhaakon UI system reference

Read this reference when selecting components, styling UI, composing application or
editorial pages, or checking accessibility. Confirm the installed version before using
an export; the repository registry and generated type declarations are authoritative
for the checked-out source, not necessarily for a published consumer.

## Entry points

| Entry | Responsibility | Typical use |
| --- | --- | --- |
| `@dhaakon/ui` | Accessible primitives | actions, forms, containment, feedback, navigation |
| `@dhaakon/ui/app` | Research/application composites | shells, headers, grids, logs, metrics, experiment workflows |
| `@dhaakon/ui/site` | Editorial identity | section systems, field notes, process and programme pages |
| `@dhaakon/ui/tokens` | Token data without CSS | charts, Canvas, generated media, non-DOM output |
| `@dhaakon/ui/styles.css` | Runtime tokens, fonts and component styles | import once at application entry |
| `@dhaakon/ui/theme.css` | Optional Tailwind v4 token bridge | utility-based consumers only |

Start with the consumer's installed `dist/*.d.ts` or the source exports. In the kit
repository, `src/index.ts`, `src/app/index.ts`, `src/site/index.ts` and
`docs/src/lib/registry.ts` form the useful discovery map.

## Root and tokens

```tsx
import '@dhaakon/ui/styles.css';
import { DhaakonProvider } from '@dhaakon/ui';

createRoot(root).render(
  <DhaakonProvider theme="dark" density="comfortable" locale="en-US">
    <App />
  </DhaakonProvider>,
);
```

Provider theme, density and locale may be scoped to a subtree. Portalled overlays
inherit their provider scope. Prefer runtime semantic CSS variables such as surface,
text, accent-text, focus and status roles. `tokens.motion` exposes:

```ts
{
  ease: 'cubic-bezier(0.16, 1, 0.3, 1)',
  durationFast: '120ms',
  duration: '200ms',
  durationSlow: '360ms',
}
```

CSS remains the runtime theme source of truth. Token data mirrors it for places that
cannot inherit CSS. When overriding an accent background, update its readable
foreground as a pair.

## Component decisions

- Use `Button` for actions and a real link for navigation. Preserve native submit
  behavior unless the design intentionally changes it.
- Use `Field` to associate a visible label, hint, error and form control. A placeholder
  is not a label.
- Use `Switch` for a setting that applies immediately; `Checkbox` for independent form
  choices; `RadioGroup` for a small visible exclusive choice; `Select`/`ComboBox` for
  longer value lists.
- Use `Dialog`, `Modal`, `Drawer`, `Popover`, `Menu` and `Tooltip` rather than rebuilding
  overlay keyboard/focus behavior. Give dialogs concise titles and return focus.
- Use `Card`, `Tabs`, `Accordion`, tables and lists according to content semantics, not
  solely visual resemblance.
- Reach for `/app` composites when the request describes an operational workflow,
  research instrument or dense data surface. Reach for `/site` when it describes
  editorial storytelling or the dhaakon.com voice.

## Accessibility acceptance

Verify actual outcomes rather than markup presence: accessible name and description,
keyboard operation, focus placement/restoration, disabled or invalid state, RTL when
locale matters, and portal theme inheritance. Keep IDs instance-safe and SSR-safe.
Essential content remains available under reduced motion. Do not nest interactive
elements or make a whole complex card clickable when it contains other controls.

Use the kit's repository gates when changing kit source:

```sh
npm run check
npm --prefix docs run build
npm run build-storybook
npm --prefix docs run check:routes
```
