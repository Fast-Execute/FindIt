# FindIt Product Specification

## 1. Purpose

FindIt helps a device owner recover an enrolled phone and understand its last known state when it goes offline.

## 2. Trust model

A user must authenticate and explicitly enroll a device. FindIt must not provide a feature that accepts an arbitrary phone number and secretly returns another person's location.

## 3. Device states

### ONLINE
The enrolled device is reachable and has recently submitted an authorized location event.

### OFFLINE
The service has not received a recent heartbeat. The dashboard displays the last known location and the time it was recorded.

### POWERED OFF / UNREACHABLE
The service cannot claim a fresh live GPS position from a completely powered-off device. The product should clearly distinguish this state from a verified location.

### RECONNECTED
The device has returned online and submitted a fresh authorized event.

## 4. Core dashboard

Each enrolled device should expose:

- device name/model
- online/offline state
- last seen timestamp
- last known location
- battery percentage when available
- network/connectivity information when available
- location history
- lost mode
- reconnect notification settings

## 5. Subscription model

The website will use a monthly subscription model. Initial plan structure:

- Basic — one device and core recovery features
- Plus — multiple devices and extended history
- Family — family device management

Final pricing and payment provider will be selected after validating the target market and current payment APIs.

## 6. Privacy requirements

- Explicit device enrollment
- Clear location-permission messaging
- User-accessible location history controls
- Secure authentication
- Audit trail for sensitive account/device actions
- No covert tracking
- No claims of universal live tracking while powered off

## 7. Future device architecture

The website is the account and control plane. Reliable background location collection will require an authorized device component, such as a native mobile application, subject to platform permissions and operating-system rules.
