/**
 * Re-read the record.
 *
 * These three screens show what just happened, and what just happened keeps
 * changing. Without this the only way to see a query you ran thirty seconds
 * ago is to reload the page, which also throws away every filter you set.
 *
 * Deliberately not automatic. A screen that polls makes a reader lose their
 * place mid-sentence, and an operator investigating an incident is reading
 * rather than watching.
 */

export function Refresh({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button className="btn refresh" type="button" onClick={onClick} disabled={loading}>
      {loading ? "Reading" : "Refresh"}
    </button>
  );
}
