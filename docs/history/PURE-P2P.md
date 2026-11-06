> 历史资料：仅记录导入版本的实现过程。当前操作见 [玩家指南](../PLAYER-GUIDE.md)、[联机指南](../MULTIPLAYER.md) 和 [发布 SOP](../../SOP.md)。历史协议和中继说明不作为当前指导。

# v1.21.1 / protocol 25 / no game server

`DirectRoom` uses the WebRTC transport/codec from v1.20 but exchanges complete SDP via copied invitation/response envelopes. Each invitation reserves a separate peer ID and connection. Envelopes are compressed, size-limited and bound to protocol, room ID, host ID, assigned guest ID and generation. ICE gathering is bounded; STUN supplies addresses only, and no TURN service or central game signaling is used.

The host owns the roster, slot/character assignment, ready state, seed and match lifecycle. These messages travel over an ordered reliable peer channel. Inputs and incremental snapshots use the existing unordered peer channel, with private traps filtered per receiving slot. Input sanitization, wall-time movement credits, sequence numbers, baseline recovery and request-ID deduplication remain.

There is no gameplay relay path: DirectRoom overrides the parent send, signal, retries, ACKs, lifecycle and final-state behavior; its inherited relay function is a counted no-op. Main-process net-connect returns an explicit disabled response, net-send has no network implementation, and legacy Node room/relay/STUN/TLS files are excluded from the EXE. Tests intercept those IPC calls and require zero attempts.

The final private state and result use one compressed reliable peer message, with per-peer ordered send and decode queues, so results cannot overtake final state. Lost direct channels never fall back to TCP relay; movements stop while reconnecting, skill presses are rejected instead of being deferred through a server, and prolonged loss releases the slot to AI. New admission after a lost connection uses a fresh manual handshake in the lobby.

Remote service was paused by marking server.pause=paused, adding a reversible guard to the existing startup helper, and stopping only the verified game loop/node PIDs. Existing crontab entries for unrelated applications were preserved. start-server.sh was invoked while paused to verify it did not restart TCP/UDP 29804.

Validation includes five native peer connections with no game-server IPC, manual reconnect, no relay after interruption, private traps, duplicate-action suppression, missing delta recovery, final-result ordering and a second match; actual 3D UI and a second physical machine are tested separately. Temporary browser oracles bind debugging/HTTP only to loopback and are not game room servers.

Movement loss recovery and current validation are described in P2P-LOSS-FIX.md.
