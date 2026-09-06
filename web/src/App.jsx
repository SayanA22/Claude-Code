import React, { useCallback, useEffect, useRef, useState } from "react";

import Section from "./components/Section.jsx";
import { api } from "./api.js";
import { relativeTime } from "./format.js";

const REFRESH_UI_MS = 30_000;

export default function App() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const seenRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setState(await api.state());
      setError(null);
    } catch (cause) {
      setError(cause.message);
    }
  }, []);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await api.sync();
      if (result.state) setState(result.state);
      setError(result.ok ? null : result.error);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSyncing(false);
    }
  }, []);

  // Initial load, then poll the local API. The server does its own GitHub
  // syncing on a timer; this just picks up whatever it already stored.
  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_UI_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Clear "new" badges once the dashboard has actually been looked at, but
  // only after the first render so the badges are visible at least once.
  useEffect(() => {
    if (!state || seenRef.current) return;
    seenRef.current = true;
    const timer = setTimeout(() => api.markSeen().catch(() => {}), 4000);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "r" && !event.metaKey && !event.ctrlKey) refresh();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refresh]);

  if (!state) {
    return (
      <div className="loading">
        {error ? `Could not reach the API: ${error}` : "Loading…"}
      </div>
    );
  }

  const { sections, viewer, sync, counts } = state;
  const syncFailed = sync && !sync.ok;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          <div>
            <h1>PR Radar</h1>
            <p className="tagline">
              {counts.attention === 0
                ? "Nothing is blocked on you."
                : `${counts.attention} ${counts.attention === 1 ? "thing needs" : "things need"} you.`}
            </p>
          </div>
        </div>

        <div className="topbar-right">
          {viewer.login && (
            <span className="viewer">
              {viewer.avatarUrl && (
                <img className="avatar" src={viewer.avatarUrl} alt="" />
              )}
              {viewer.login}
            </span>
          )}
          <button className="refresh" onClick={refresh} disabled={syncing}>
            {syncing ? "Syncing…" : "Refresh"}
            <kbd>r</kbd>
          </button>
        </div>
      </header>

      {(error || syncFailed) && (
        <div className="banner">
          <strong>Sync problem.</strong> {error || sync.error}
        </div>
      )}

      <main>
        <Section
          accent="red"
          title="Needs you"
          subtitle="Blocked on your action right now."
          items={sections.attention}
          emptyMessage="Clear. Nothing is waiting on you."
        />
        <Section
          accent="blue"
          title="Your review requested"
          subtitle="Other people's work waiting on your eyes."
          items={sections.needsReview}
          emptyMessage="No review requests."
        />
        <Section
          accent="green"
          title="Your open PRs"
          subtitle="Everything you have in flight."
          items={sections.mine}
          emptyMessage="No open pull requests."
        />
      </main>

      <footer className="footer">
        <span>
          {sync?.lastGoodAt
            ? `Last synced ${relativeTime(sync.lastGoodAt)} · ${sync.prCount} PRs`
            : "Never synced successfully"}
          {syncFailed && sync?.lastGoodAt ? " · retrying" : ""}
        </span>
        <span>
          Auto-syncs every {state.settings.syncIntervalMinutes} min
          {state.rateLimitRemaining
            ? ` · ${state.rateLimitRemaining} API points left this hour`
            : ""}
        </span>
      </footer>
    </div>
  );
}
