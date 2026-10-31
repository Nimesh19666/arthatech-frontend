import { useCallback, useEffect, useState } from "react";
import { asList } from "../api/houses.js";

/** Load a list from the API. fn returns the API promise. deps are what should trigger a reload. */
export function useLoad(fn, deps = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(asList(await fn()));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, setError, reload: load };
}
