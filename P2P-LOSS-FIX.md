# v1.21.1 / protocol 25

The v1.21.0 input sender repeated 120 ms of commands. Burst loss could exceed that window. Host fallback advanced the actor without advancing the command ACK, so the client replayed movement that was already present in an authoritative snapshot. Reliable key edges also acknowledged commands without simulating their movement.

The sender now repeats up to 600 ms of unconfirmed commands. Host wall-time credits and the 120 ms execution queue remain bounded. Fallback records speculative simulation time; arriving commands settle that time instead of moving the actor again. Snapshots include inputLead so reconciliation excludes already simulated fallback time. Key edges no longer acknowledge unapplied movement. Host state, collisions, capture and teleports remain authoritative.

Protocol 25 prevents mixed clients from interpreting the new movement accounting differently. Everyone must update and exchange fresh invitations.

The deterministic test compares the same seeded loss, jitter and 450 ms burst gaps. Its 35% loss / 12 FPS scenario previously had a 1.628 m maximum reconciliation correction and a 0.398 m backward step. After the fix, those values are 0.140 m and zero. This is an artificial test, not a promise about internet packet loss.

The actual 3D test injects loss after native WebRTC DataChannel receipt, adds 65–115 ms of delay, and limits the host renderer to 12 FPS. It also checks release-to-stop and normal gameplay. Results and sampled positions are shipped separately. Five native peers verify no game-server calls, action deduplication, private traps, manual rejoin, final-state ordering and a second match.

Connection troubleshooting also gains an independent STUN source, a 15-second bounded candidate collection window, and diagnostics containing candidate counts and ICE error codes without addresses or SDP. A virtual-interface hint is evidence to investigate VPN routing, not proof of a specific VPN fault. STUN does not relay gameplay, and restricted networks can still fail to connect without TURN.

Official endpoint documentation: https://developers.cloudflare.com/realtime/sfu/get-started/connection-patterns/ and https://developers.home.google.com/tools/webrtc-validator .

The cloud game service remains paused. No TURN, gameplay relay or central room service was enabled for this release.
