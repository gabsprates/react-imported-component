import {useCallback, useContext, useEffect, useState, lazy, useRef, LazyExoticComponent, ComponentType} from 'react';
import {streamContext} from "./context";
import {settings} from "./config";
import {getLoadable, isItReady} from "./loadable";
import {useMark} from "./marks";
import {DefaultComponentImport, DefaultImport, DefaultImportedComponent, Loadable} from './types';
import {es6import} from "./utils";
import {isBackend} from "./detectBackend";

function loadLoadable(loadable: Loadable<any>, callback: (l: any) => void) {
  const upd = () => callback({});

  loadable
    .loadIfNeeded()
    .then(upd, upd);
}

const WEAK_MAP = new WeakMap<Loadable<any>, any>();


function executeLoadableEventually(loadable: Loadable<any>, cb: any) {
  const tracker = {};
  WEAK_MAP.set(loadable, tracker);

  // execute loadable after some timeout to let HMR propagate thought
  setTimeout(() => {
    if (WEAK_MAP.get(loadable) === tracker) {
      loadable.reload().then(cb);
    }
  }, 16);
}

interface ImportedShape<T> {
  imported?: T;
  error?: any;
  loading?: boolean;

  loadable: Loadable<any>;

  retry(): void;
}

interface HookOptions {
  import?: boolean;
  track?: boolean;
}

export function useLoadable<T>(loadable: Loadable<T>, options: HookOptions = {}) {
  const UID = useContext(streamContext);
  const [, forceUpdate] = useState(() => {
    // use mark
    if (options.import !== false) {
      if (options.track !== false) {
        useMark(UID, loadable.mark);
      }
      loadable.loadIfNeeded();
    }

    return {};
  });

  useEffect(() => {
    if (options.import !== false) {
      if (options.track !== false) {
        useMark(UID, loadable.mark);
      }
      loadLoadable(loadable, forceUpdate);
    }
  }, [loadable, options.import]);

  if (isBackend && !isItReady() && loadable.isLoading()) {
    console.error('react-imported-component: trying to render not ready component. Have you `await whenComponentsReady()`?')
  }

  // use mark
  // retry
  const retry = useCallback(() => {
    if (!loadable) {
      return;
    }
    loadable.reset();
    forceUpdate({});
    loadLoadable(loadable, forceUpdate);
  }, [loadable]);

  if (process.env.NODE_ENV !== 'production') {
    if (isBackend) {
      if (!loadable.done) {
        console.error('react-imported-component: using not resolved loadable. You should `await whenComponentsReady()`.')
      }
    }
  }

  return {
    loadable,
    retry,
    update: forceUpdate,
  };
}

export function useImported<T, K = T>(importer: DefaultImport<T> | Loadable<T>, exportPicker: (x: T) => K = es6import, options: HookOptions = {}): ImportedShape<K> {
  const [topLoadable] = useState(getLoadable(importer));
  const postEffectRef = useRef(false);
  const {
    loadable,
    retry,
    update,
  } = useLoadable<T>(topLoadable, options);

  // kick loading effect
  useEffect(() => {
    if (postEffectRef.current) {
      executeLoadableEventually(
        loadable,
        () => settings.updateOnReload && update({}));
    }

    postEffectRef.current = true;
  }, ['hot']);

  if (loadable.error) {
    return {
      error: loadable.error,
      loadable,
      retry,
    }
  }

  if (loadable.done) {
    return {
      imported: exportPicker(loadable.payload as T),
      loadable,
      retry,
    }
  }

  return {
    loading: loadable.isLoading(),
    loadable,
    retry,
  };
}

export function useLazy<T>(importer: DefaultComponentImport<T>): LazyExoticComponent<ComponentType<T>> {
  const [{resolve, reject, lazyComponent}] = useState(() => {
    let resolve: any;
    let reject: any;
    const promise = new Promise<DefaultImportedComponent<T>>((rs, rej) => {
      resolve = rs;
      reject = rej;
    });

    return {
      resolve,
      reject,
      lazyComponent: lazy(() => promise),
    }
  });

  const {error, imported} = useImported(importer);

  useEffect(() => {
    if (error) {
      reject!(error)
    }
    if (imported) {
      resolve!(imported);
    }
  }, [error, imported]);

  return lazyComponent;
}