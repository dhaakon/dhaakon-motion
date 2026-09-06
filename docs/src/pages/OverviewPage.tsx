import { routes } from '../routes';
export default function OverviewPage() {
  return (
    <>
      <div className="overview-intro">
        <div>
          <p className="eyebrow">DHAAKON MOTION / FEATURE ATLAS</p>
          <h2>
            Pick a system.
            <br />
            <em>Give it the stage.</em>
          </h2>
          <p>
            Tweens become sequences. Sequences become shows. The same timebase drives each renderer,
            live or offline.
          </p>
          <code>npm i @dhaakon/motion</code>
        </div>
        <a className="overview-feature" href="/css-ui">
          <span>NEW / CSS + DHAAKON UI</span>
          <div className="atlas-mark" aria-hidden="true">
            ◇
          </div>
          <h3>Intent, then motion.</h3>
          <p>Shared tokens. Native CSS playback. Accessible interaction.</p>
          <b>Open the UI study ↗</b>
        </a>
      </div>
      <div className="architecture-strip">
        <span>
          AUTHOR <b>Values + cue sheets</b>
        </span>
        <i>→</i>
        <span>
          RESOLVE <b>Timeline + transport</b>
        </span>
        <i>→</i>
        <span>
          RENDER <b>Live or offline</b>
        </span>
      </div>
      <div className="route-cards">
        {routes
          .filter((route) => route.path !== '/')
          .map((route, index) => (
            <a href={route.path} key={route.path}>
              <span>
                {String(index + 1).padStart(2, '0')} / {route.group}
              </span>
              <h2>{route.label} ↗</h2>
              <p>{route.description}</p>
            </a>
          ))}
      </div>
      <p className="route-note">
        No demos run on this overview. Feature pages are loaded on demand; changing routes disposes
        their animation resources.
      </p>
    </>
  );
}
