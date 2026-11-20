export function useDiagnostics() {
  const summary = useState("towerlab-diagnostics", () => "");
  function setSummary(value: string) {
    summary.value = value;
  }
  return { summary, setSummary };
}
