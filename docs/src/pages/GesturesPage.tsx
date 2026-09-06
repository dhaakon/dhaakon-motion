import { GestureGallery } from '../GestureLabs';
export default function GesturesPage() {
  return (
    <>
      <p className="route-note">
        Drag the reorder handles, not the card body. Focusable controls also support keyboard
        interaction.
      </p>
      <GestureGallery />
      <p className="route-next">
        <a href="/gesture-labs">Next: recording, scrubbing, mixing, and timeline editing ↗</a>
      </p>
    </>
  );
}
