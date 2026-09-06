async function request(path, options) {
  const response = await fetch(path, options);
  if (!response.ok && response.status !== 502) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const api = {
  state: () => request("/api/state"),
  sync: () => request("/api/sync", { method: "POST" }),
  markSeen: () => request("/api/seen", { method: "POST" }),
};
