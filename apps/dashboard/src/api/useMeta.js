import { useEffect, useState } from 'react';
import { get } from './http.js';

export function useMeta() {
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    get('/v1/meta').then(setMeta).catch(() => {});
  }, []);
  return meta;
}
