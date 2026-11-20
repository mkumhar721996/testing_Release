/** Full-page navigation, matching how App.tsx switches on the pathname. */
export function navigate(path: string) {
  window.location.assign(path);
}
