import { PendingRequestItem } from './PendingRequestItem'

export function PendingRequestsPanel({ requests, onRespond, busyId }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Friend requests</h2>
        {requests.length ? <span className="pill">{requests.length}</span> : null}
      </div>
      <p className="lead">Approve friends here when they use your invite code.</p>

      {requests.length === 0 ? (
        <p className="muted">No requests yet.</p>
      ) : (
        <div className="stack">
          {requests.map((item) => (
            <PendingRequestItem
              key={item.id}
              item={item}
              onRespond={onRespond}
              busyId={busyId}
            />
          ))}
        </div>
      )}
    </section>
  )
}
