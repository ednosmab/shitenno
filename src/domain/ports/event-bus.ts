/**
 * event-bus.ts — EventBus port for Clean Architecture.
 *
 * Domain layer defines the interface; infrastructure provides the implementation.
 */

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

export interface EventBus {
  publish<T>(eventType: string, payload: T): void;
  subscribe<T>(eventType: string, handler: EventHandler<T>): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
}
