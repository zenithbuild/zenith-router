import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const native = require('./zenith-router.node');
export const { generateRouteManifestNative, renderRouteNative, resolveRouteNative, generateRuntimeRouterNative, SegmentType, routerBridge } = native;
export default native;
