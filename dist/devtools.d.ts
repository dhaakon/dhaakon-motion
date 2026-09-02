import { d as Transport } from './track-CKxBNm8F.js';

interface MountInspectorOptions {
    container?: HTMLElement;
    collapsed?: boolean;
    theme?: 'ink' | 'paper';
}
/** A dependency-free, plain-DOM transport bar + timeline lanes overlay. Attach it while developing; it never ships as part of a production bundle unless you import it. */
declare function mountInspector(transport: Transport, options?: MountInspectorOptions): {
    unmount(): void;
};

export { type MountInspectorOptions, mountInspector };
