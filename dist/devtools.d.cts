import { d as Transport } from './track-D8CkFR8E.cjs';

interface MountInspectorOptions {
    container?: HTMLElement;
    collapsed?: boolean;
    theme?: 'ink' | 'paper';
    /** Draw active pointer trails, their velocity vectors, and the winning gesture arena. */
    gestures?: boolean;
}
/** A dependency-free, plain-DOM transport bar + timeline lanes overlay. Attach it while developing; it never ships as part of a production bundle unless you import it. */
declare function mountInspector(transport: Transport, options?: MountInspectorOptions): {
    unmount(): void;
};

export { type MountInspectorOptions, mountInspector };
