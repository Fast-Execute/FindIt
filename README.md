# FindIt

FindIt is a consent-based device recovery platform designed to help people locate and protect their own enrolled devices.

## Product principle

FindIt does not secretly locate phones or bypass device security. A device must be enrolled and authorized by its owner (or an authorized account administrator).

A web service cannot universally live-track a phone after it has been completely powered off. FindIt therefore separates:

- **Live location** — authorized location reported while the device is online.
- **Last known location** — the most recent authorized location before the device went offline.
- **Offline recovery** — integrations with legitimate operating-system/vendor capabilities where available.
- **Reconnect alerts** — notify the account when an enrolled device becomes reachable again.

## Planned stack

- Next.js + TypeScript
- Responsive web dashboard
- Authentication and device enrollment
- Subscription billing
- Location event storage
- Lost-device mode and reconnect alerts
- Privacy, consent, and audit controls

## Development progress

**Phase 1 — Foundation: 50%**

- [x] Repository verified and initialized
- [x] Product safety/consent model defined
- [x] Core location states defined
- [x] Web application scaffold
- [ ] Authentication
- [ ] Subscription checkout
- [x] Device management UI (enrollment flow pending backend)
- [x] Location dashboard UI
- [ ] Lost mode and reconnect alerts
- [ ] Production deployment

## Local development

The application scaffold will be added in the next implementation step.
