import {
  warn,
  error,
  assert,
  hasOwn,
  deepMerge,
  getRenderNode,
  isPlainObject,
} from '@garfish/utils';
import { AppInfo } from './module/app';
import { interfaces } from './interface';

const invalidNestedAttrs = [
  'sandbox',
  'autoRefreshApp',
  'disableStatistics',
  'disablePreloadApp',
];

export const filterNestedConfig = (
  garfish: interfaces.Garfish,
  config: interfaces.Options,
  id: number,
) => {
  if (config.nested) {
    invalidNestedAttrs.forEach((key) => {
      if (key in config) {
        delete config[key];
        warn(`Nested scene does not support the configuration "${key}".`);
      }
    });
  }

  garfish.hooks.lifecycleKeys.forEach((key) => {
    const fn = config[key];
    const canCall = (info) => (info.nested = id);
    const isInfo = (info) => isPlainObject(info) && hasOwn(info, 'name');

    if (typeof fn === 'function') {
      config[key] = function (...args) {
        const info = args.find((v) => isInfo(v));
        if (!info) return fn.apply(this, args);
        if (canCall(info)) return fn.apply(this, args);
      };
    }
  });
  return config;
};

// Merge `oldConfig` and `newConfig`
export const deepMergeConfig = (o, n) => {
  let tempO = o;
  let tempN = n;
  const oHasProps = o && hasOwn(o, 'props');
  const nHasProps = n && hasOwn(n, 'props');

  if (oHasProps) {
    tempO = Object.assign({}, o);
    delete tempO.props;
  }
  if (nHasProps) {
    tempN = Object.assign({}, n);
    delete tempN.props;
  }
  const result = deepMerge(tempO, tempN);
  if (oHasProps || nHasProps) {
    result.props = n.props || o.props;
  }
  return result;
};

export const generateAppOptions = async (
  appName: string,
  garfish: interfaces.Garfish,
  appOptions: Partial<interfaces.AppInfo> | string = {},
) => {
  let appInfo = garfish.appInfos[appName];
  // `Garfish.loadApp('appName', 'https://xx.html');`
  if (typeof appOptions === 'string') {
    appOptions = {
      name: appName,
      basename: '/',
      entry: appOptions,
    } as interfaces.AppInfo;
  }

  appInfo = appInfo
    ? deepMergeConfig(appInfo, appOptions)
    : deepMergeConfig(garfish.options, appOptions);
  // Does not support does not have remote resources application
  assert(
    appInfo.entry,
    `Can't load unexpected child app "${appName}", ` +
      'Please provide the entry parameters or registered in advance of the app.',
  );
  appInfo.name = appName;
  // Initialize the mount point, support domGetter as promise, is advantageous for the compatibility
  if (appInfo.domGetter) {
    appInfo.domGetter = await getRenderNode(appInfo.domGetter);
  }
  return appInfo as AppInfo;
};

// Each main application needs to generate a new configuration
export const createDefaultOptions = (nested = false) => {
  const config: interfaces.Options = {
    apps: [],
    props: {},
    basename: '/',
    customLoader: null, // deprecated
    autoRefreshApp: true,
    disableStatistics: false,
    disablePreloadApp: false,
    sandbox: {
      snapshot: false,
      disableWith: false,
      strictIsolation: false,
    },
    // Load hooks
    beforeLoad: () => {},
    afterLoad: () => {},
    // Code eval hooks
    beforeEval: () => {},
    afterEval: () => {},
    // App mount hooks
    beforeMount: () => {},
    afterMount: () => {},
    beforeUnmount: () => {},
    afterUnmount: () => {},
    // Error hooks
    errorLoadApp: (e) => error(e),
    errorMountApp: (e) => error(e),
    errorUnmountApp: (e) => error(e),
    // Router
    onNotMatchRouter: () => {},
    // Use an empty div by default
    domGetter: () => document.createElement('div'),
  };

  if (nested) {
    invalidNestedAttrs.forEach((key) => delete config[key]);
  }
  return config;
};
