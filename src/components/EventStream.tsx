import React from 'react';

interface Event {
  id: string;
  type: string;
  message: string;
  timestamp: number;
}

interface EventStreamProps {
  events: Event[];
}

export function EventStream({ events }: EventStreamProps) {
  return (
    <div className="event-stream">
      <h3>Event Stream</h3>
      <div className="event-list">
        {events.slice(-50).reverse().map(event => (
          <div key={event.id} className="event-item">
            <span className="event-time">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
            <span className="event-type">{event.type}</span>
            <span className="event-message">{event.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
