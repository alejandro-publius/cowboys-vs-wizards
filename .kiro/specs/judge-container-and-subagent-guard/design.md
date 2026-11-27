# Judge verification and the Stop receipt guard

The judge devcontainer uses the Node 22 Bookworm image and the Python 3.12 feature. Creation runs `npm ci`. Ports 4179 and 8080 are available for the Saloon and staged site when a judge starts the respective servers.

An ordinary `Stop` registration runs the receipt guard in a checkout. Kiro CLI 3.6 introduced the separate `SubagentStop` event for V3 sessions. Its registration is an opt-in example until a real dispatched subagent has produced a receipt. The guard reports the delivered event name and maps either event to the existing Saloon `Stop` phase.

The guard enumerates committed evidence bundle paths and checks the working copies with `bundleSealIntact`. It also requires at least one property entry and verifies the receipt with the scorecard's `auditPropertyReceipt`. Each counted fast-check source must also be present at the cited commit. CI fetches the tested commit before invoking the guard in its shallow checkout. The guard itself needs only local Git objects.

The publishable block of the build story includes the hackathon wording. The author owns publication on a third-party platform.
